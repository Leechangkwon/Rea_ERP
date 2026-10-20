const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/inventory-core.js'),F=require('../dist/form-core.js');
const {environment}=require('./helpers/request-env.cjs');
const input=()=>({type:'request',date:C.today(),warehouse:'W001',partner:'V001',lines:[{item:'M001',qty:2,price:100}]});
const fixture=()=>{const d=C.empty();d.masters=C.clone(C.seed().masters);return d;};
const ids=docs=>docs.map(d=>d.id);
test('date ranges include KST leap-day boundaries and combine creation with last modification',()=>{
 const docs=[{id:'before',type:'request',createdAt:'2024-02-28T14:59:59.999Z',modifiedAt:'2024-03-01T01:00:00.000Z'},{id:'first',type:'request',createdAt:'2024-02-28T15:00:00.000Z',modifiedAt:'2024-03-01T01:00:00.000Z'},{id:'last',type:'request',createdAt:'2024-02-29T14:59:59.999Z',modifiedAt:'2024-03-02T01:00:00.000Z'},{id:'after',type:'request',createdAt:'2024-02-29T15:00:00.000Z',modifiedAt:'2024-03-01T01:00:00.000Z'}],db={documents:docs},before=JSON.stringify(db);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{createdFrom:'2024-02-29',createdTo:'2024-02-29'})),['first','last']);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{createdFrom:'2024-02-29',createdTo:'2024-02-29',modifiedTo:'2024-03-01'})),['first']);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{createdFrom:'2024-03-01'})),['after']);
 assert.equal(JSON.stringify(db),before);
});
test('missing metadata uses only retained events of the same type and never fabricates dates',()=>{
 const docs=[{id:'a',type:'request'},{id:'b',type:'request',createdAt:'invalid'},{id:'c',type:'request',createdAt:'2024-02-29T00:00:00.000Z'}],db={documents:docs,documentHistory:{records:[{documentId:'a',type:'request',action:'신규',at:'2024-02-28T15:00:00.000Z'},{documentId:'a',type:'request',action:'수정',at:'2024-03-01T00:00:00.000Z'},{documentId:'b',type:'purchase',action:'신규',at:'2024-02-29T00:00:00.000Z'}]}},before=JSON.stringify(db);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{createdFrom:'2024-02-29',createdTo:'2024-02-29'})),['a','c']);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{modifiedFrom:'2024-03-01',modifiedTo:'2024-03-01'})),['a']);
 assert.deepEqual(ids(C.filterDocumentDates(db,docs,{})),['a','b','c']);assert.equal(JSON.stringify(db),before);
});
test('invalid or reversed periods fail even with no rows and before any list is replaced',()=>{
 for(const filter of [{createdFrom:'2023-02-29'},{modifiedTo:'2024-13-01'},{createdFrom:'2024-03-01',createdTo:'2024-02-29'},{modifiedFrom:'2024-03-01',modifiedTo:'2024-02-29'}])assert.throws(()=>C.filterDocumentDates({},[],filter),/일자|수정일시/);
});
test('first successful save records one shared instant and supplied timestamps cannot change creation metadata',()=>{
 let r=C.command(fixture(),'document',{...input(),createdAt:'2000-01-01T00:00:00.000Z',modifiedAt:'2000-01-01T00:00:00.000Z'}),db=r.db,d=db.documents[0];assert.equal(d.createdAt,d.modifiedAt);assert.notEqual(d.createdAt,'2000-01-01T00:00:00.000Z');
 const created=d.createdAt,before=JSON.stringify(db);r=C.command(db,'document',{...d,createdAt:'1999-01-01T00:00:00.000Z',modifiedAt:'1999-01-01T00:00:00.000Z'});assert.deepEqual(r.db.documents,db.documents);assert.deepEqual(r.db.documentHistory,db.documentHistory);
 r=C.command(db,'document',{...d,memo:'changed',createdAt:'1999-01-01T00:00:00.000Z'});assert.equal(r.db.documents[0].createdAt,created);assert.equal(r.db.documentHistory.sequence,db.documentHistory.sequence+1);
 assert.throws(()=>C.command(db,'document',{...d,lines:[]}),/품목/);assert.equal(JSON.stringify(db),before);
});
test('legacy backup and no-op save preserve unknown creation time; conversion receives its own timestamp',()=>{
 let r=C.command(fixture(),'document',input()),db=r.db;delete db.documents[0].createdAt;delete db.documents[0].modifiedAt;delete db.documentHistory;
 const before=JSON.stringify(db);assert.equal(JSON.stringify(C.validateBackup(db)),before);r=C.command(db,'document',db.documents[0]);assert.deepEqual(r.db.documents,db.documents);assert.equal(r.db.documentHistory,undefined);
 r=C.command(db,'convert',{id:db.documents[0].id,type:'plan',date:C.today(),quantities:{M001:1}});const plan=r.db.documents.find(d=>d.type==='plan');assert.equal(plan.createdAt,plan.modifiedAt);assert.ok(plan.createdAt);assert.equal(Object.hasOwn(r.db.documents.find(d=>d.type==='request'),'createdAt'),false);
});
function uiFixture(f){let db=f.stored();delete db.documentHistory;const docs=db.documents.filter(d=>d.type==='request');docs.forEach((d,i)=>{d.date=C.today();d.createdAt=i===0?'2024-02-28T15:00:00.000Z':i===1?'2024-02-29T14:59:59.999Z':'2024-02-29T15:00:00.000Z';d.modifiedAt=i===0?'2024-03-01T00:00:00.000Z':'2024-03-02T00:00:00.000Z';});f.w.InventoryUI.replace(db);f.host.replaceChildren();f.render();return db;}
test('F8 applies both metadata ranges and the voucher date; invalid edits retain selection and applied results',()=>{
 const f=environment();try{uiFixture(f);const before=JSON.stringify(f.stored());f.click('Search(F3)');f.change('최초작성일자 시작','2024-02-29');f.change('최초작성일자 종료','2024-02-29');f.change('최종수정일시 종료','2024-03-01');assert.equal(f.host.querySelectorAll('tbody input[type=checkbox]').length,2);f.click('검색(F8)');assert.equal(f.host.querySelectorAll('tbody input[type=checkbox]').length,1);assert.ok(f.host.textContent.includes(f.ids[0]));f.change('전표 선택 '+f.ids[0],true);
 f.click('Search(F3)');f.change('최초작성일자 시작','2024-03-02');f.click('검색(F8)');assert.match(f.toasts.at(-1),/최초작성일자 시작일/);assert.equal(f.control('전표 선택 '+f.ids[0]).checked,true);assert.equal(f.host.querySelectorAll('tbody input[type=checkbox]').length,1);assert.equal(f.host.querySelector('.inv-filters').hidden,false);
 f.change('최초작성일자 시작','2024-02-29');f.change('시작일','2024-02-29');f.change('종료일','2024-02-29');f.click('검색(F8)');assert.equal(f.host.querySelectorAll('tbody input[type=checkbox]').length,0);assert.equal(JSON.stringify(f.stored()),before);
 }finally{f.w.close();}
});
test('read-only date search preserves saved field labels, visibility, defaults and stored data',()=>{
 const f=environment();try{let db=uiFixture(f);db.settings.customization=F.save(db.settings.customization,'doc:request','search',{id:'kept-search',name:'기존 날짜 양식',fields:[F.field('from','원래 시작','date'),F.field('to','원래 종료','date'),F.field('createdFrom','맞춤 작성일 시작','date',{visible:false,defaultValue:'2024-02-29'})]});f.w.InventoryUI.replace(db);f.w.AuthUI.can=p=>p==='inventory.read';f.host.replaceChildren();f.render();const before=JSON.stringify(f.stored());assert.equal(f.control('맞춤 작성일 시작').value,'2024-02-29');assert.equal(f.control('맞춤 작성일 시작').parentElement.hidden,true);f.click('Search(F3)');f.change('최초작성일자 종료','2024-02-29');f.click('검색(F8)');assert.equal(f.host.querySelectorAll('tbody input[type=checkbox]').length,2);assert.equal(JSON.stringify(f.stored()),before);
 }finally{f.w.close();}
});
