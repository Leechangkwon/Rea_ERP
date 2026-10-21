"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../dist/inventory-core.js'),Q=require('../dist/price-request-core.js');
const copy=x=>JSON.parse(JSON.stringify(x));
test('batch received prices persist once with exact zero/decimal values and unrelated data preserved',()=>{
 let {db,id}=fixture();db=C.command(db,'document',{...db.documents.find(d=>d.id===id),lines:[{lineId:'a',item:'M001',qty:1,price:10},{lineId:'b',item:'M001',qty:2,price:20},{lineId:'c',item:'M001',qty:3,price:30}]}).db;db=start(db,id).db;
 const before=copy(db),out=edit(db,id,'replyMany',{vendorCode:'V001',replies:[{lineKey:'id:a',price:'0'},{lineKey:'id:b',price:'1.9999999999'}]}),after=out.db;
 assert.deepEqual(preserved(after),preserved(before));assert.equal(after.sequence,before.sequence+1);assert.equal(after.logs.length,before.logs.length+1);assert.equal(Q.view(after,id,C).revision,1);
 assert.deepEqual(after.settings.priceRequests.records[0].comparison.vendors[0].received.map(r=>r.price),['0','1.9999999999',null]);assert.deepEqual(after.settings.priceRequests.records[0].comparison.vendors[1],before.settings.priceRequests.records[0].comparison.vendors[1]);
 assert.deepEqual(Q.view(C.validateBackup(copy(after)),id,C),Q.view(after,id,C));assert.deepEqual(db,before);
});
test('batch reply rejects malformed or late invalid rows atomically',()=>{
 let {db,id}=fixture();db=start(db,id).db;const lineKey='id: A ',valid={lineKey,price:'12'};
 const batches=[[],[valid,valid],[valid,{lineKey:'missing',price:1}],[{lineKey,price:'1.00000000001'}],[{lineKey,price:'-1'}],[{lineKey,price:'1e3'}],[{lineKey,price:Infinity}],[{lineKey,price:'2',extra:1}],new Array(1),Array.from({length:501},()=>valid)];
 for(const replies of batches)rejectUnchanged(db,()=>edit(db,id,'replyMany',{vendorCode:'V001',replies}));
 for(const extra of [{vendorCode:'missing',replies:[valid]},{vendorCode:'V001',replies:[valid],expectedRevision:99},{vendorCode:'V001',replies:[valid],extra:1}])rejectUnchanged(db,()=>edit(db,id,'replyMany',extra));
});
test('batch reply preserves selected price and refuses closed, stale source or unavailable vendor',()=>{
 const data=populated(),valid={vendorCode:'V002',replies:[{lineKey:'id: A ',price:'25001'}]};
 rejectUnchanged(data.db,()=>edit(data.db,data.id,'replyMany',valid),/확정단가/);
 const same=edit(data.db,data.id,'replyMany',{...valid,replies:[{lineKey:'id: A ',price:'25000.0'}]}).db;assert.deepEqual(same.settings.priceRequests.records[0].comparison.selections,data.db.settings.priceRequests.records[0].comparison.selections);
 for(const mode of ['closed','source','vendor']){let db=copy(data.db);if(mode==='closed')db=edit(db,data.id,'close',{vendorCode:'V001',closed:true}).db;if(mode==='source')db.documents.find(d=>d.id===data.id).memo='newer';if(mode==='vendor')db.masters.partners.find(v=>v.code==='V001').disabled=true;rejectUnchanged(db,()=>edit(db,data.id,'replyMany',{vendorCode:'V001',replies:[{lineKey:'id: A ',price:'3'}]}));}
});
test('500-row received-price batch saves once and late failure changes nothing',()=>{
 let {db,id}=fixture();db=C.command(db,'document',{...db.documents.find(d=>d.id===id),lines:Array.from({length:500},(_,i)=>({lineId:'line'+i,item:'M001',qty:1,price:1}))}).db;db=start(db,id).db;
 const replies=Array.from({length:500},(_,i)=>({lineKey:'id:line'+i,price:String(i)})),before=copy(db);const out=edit(db,id,'replyMany',{vendorCode:'V001',replies}).db;
 assert.equal(Q.view(out,id,C).revision,1);assert.equal(out.sequence,db.sequence+1);assert.equal(Q.view(out,id,C).rows[499].received[0].price,'499');
 replies[499].price='invalid';rejectUnchanged(db,()=>edit(db,id,'replyMany',{vendorCode:'V001',replies}));assert.deepEqual(db,before);
});
function fixture(){
 let db=C.seed();db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'Second supplier',kind:'매입'}}).db;
 const out=C.command(db,'document',{type:'pricerequest',date:'2026-10-21',partner:'V001',warehouse:'W001',status:'진행',vatRate:10,lines:[{item:'M001',qty:100,price:50000,lineId:' A '}]});
 return {db:out.db,id:out.result.id};
}
const run=(db,id,action,extra={})=>C.command(db,'priceRequest',{action,documentId:id,...extra});
const start=(db,id)=>run(db,id,'start',{vendorCodes:['V001','V002']});
const edit=(db,id,action,extra={})=>run(db,id,action,{expectedRevision:Q.view(db,id,C).revision,...extra});
function populated(){let {db,id}=fixture();db=start(db,id).db;db=edit(db,id,'reply',{vendorCode:'V002',lineKey:'id: A ',price:'25000'}).db;db=edit(db,id,'select',{source:'vendor',vendorCode:'V002',lineKey:'id: A '}).db;return {db,id};}
function preserved(db){const snapshot=copy(db);delete snapshot.settings.priceRequests;snapshot.logs=[];snapshot.sequence=0;return snapshot;}
function rejectUnchanged(db,fn,pattern){const before=JSON.stringify(db);assert.throws(fn,pattern);assert.equal(JSON.stringify(db),before);}

test('legacy database read and backup do not create comparison storage',()=>{
 const {db,id}=fixture(),before=JSON.stringify(db);assert.equal(Q.view(db,id,C),null);const restored=C.validateBackup(copy(db));assert.equal(Object.hasOwn(restored.settings,'priceRequests'),false);assert.equal(JSON.stringify(db),before);
});
test('start, received price and explicit selection persist without touching vouchers, special prices or forms',()=>{
 let {db,id}=fixture();const before=preserved(db),sequence=db.sequence;db=start(db,id).db;
 db=edit(db,id,'reply',{vendorCode:'V002',lineKey:'id: A ',price:'25000.000'}).db;
 assert.equal(Q.view(db,id,C).rows[0].confirmed,null);
 db=edit(db,id,'select',{source:'vendor',vendorCode:'V002',lineKey:'id: A '}).db;
 assert.deepEqual(preserved(db),before);assert.equal(db.sequence,sequence+3);const view=Q.view(db,id,C);assert.equal(view.status,'ready');assert.equal(view.rows[0].requestedPrice,'50000');assert.equal(view.rows[0].confirmed.price,'25000');assert.equal(view.rows[0].received[0].price,null);
 const restored=C.validateBackup(copy(db));assert.deepEqual(restored.settings.priceRequests,db.settings.priceRequests);assert.deepEqual(Q.view(restored,id,C),view);
});
test('comparison start requires a saved active request and active registered vendors',()=>{
 const {db,id}=fixture();for(const vendorCodes of [[],['missing'],['V001','V001'],Array(6).fill('V001')])rejectUnchanged(db,()=>run(db,id,'start',{vendorCodes}));
 const disabled=copy(db);disabled.masters.partners.find(p=>p.code==='V002').disabled=true;rejectUnchanged(disabled,()=>start(disabled,id),/거래처/);
 for(const status of ['취소','보류','미확인']){const inactive=copy(db);inactive.documents.find(d=>d.id===id).status=status;rejectUnchanged(inactive,()=>start(inactive,id),/활성/);}
 rejectUnchanged(db,()=>start(db,'missing'));rejectUnchanged(db,()=>start(db,db.documents.find(d=>d.type==='purchaseorder').id));
});
test('duplicate start and generic settings cannot erase stored replies or inject a store',()=>{
 const {db,id}=populated();rejectUnchanged(db,()=>start(db,id),/초기화/);
 for(const priceRequests of [null,{},undefined,{version:1,records:[]}])rejectUnchanged(db,()=>C.command(db,'settings',{priceRequests}),/전용/);
});
test('stale revision loses no replies, selections, logs or unrelated state',()=>{
 const {db,id}=populated();rejectUnchanged(db,()=>run(db,id,'reply',{expectedRevision:0,vendorCode:'V001',lineKey:'id: A ',price:1}),/수정번호/);
});
test('non-finite prices cannot be normalized into clearing an existing quote at the InventoryCore boundary',()=>{
 let {db,id}=fixture();db=start(db,id).db;db=edit(db,id,'reply',{vendorCode:'V001',lineKey:'id: A ',price:'30'}).db;
 for(const price of [NaN,Infinity,-Infinity,undefined])rejectUnchanged(db,()=>edit(db,id,'reply',{vendorCode:'V001',lineKey:'id: A ',price}));
 const cleared=edit(db,id,'reply',{vendorCode:'V001',lineKey:'id: A ',price:null});assert.equal(Q.view(cleared.db,id,C).rows[0].received[0].price,null);
});
test('sparse vendor lists and unknown command fields are rejected before serialization',()=>{
 const {db,id}=fixture(),vendorCodes=['V001',,'V002'];rejectUnchanged(db,()=>run(db,id,'start',{vendorCodes}));rejectUnchanged(db,()=>run(db,id,'start',{vendorCodes:['V001'],reset:true}));
});
test('closing, reopening and changing selected quotes require explicit selection release',()=>{
 let {db,id}=populated();const quotes=copy(db.settings.priceRequests.records[0].comparison);
 db=edit(db,id,'close',{vendorCode:'V002',closed:true}).db;rejectUnchanged(db,()=>edit(db,id,'reply',{vendorCode:'V002',lineKey:'id: A ',price:'25000'}),/마감/);
 db=edit(db,id,'close',{vendorCode:'V002',closed:false}).db;assert.deepEqual(db.settings.priceRequests.records[0].comparison.vendors,quotes.vendors);assert.deepEqual(db.settings.priceRequests.records[0].comparison.selections,quotes.selections);
 rejectUnchanged(db,()=>edit(db,id,'reply',{vendorCode:'V002',lineKey:'id: A ',price:'26000'}),/선택/);
 db=edit(db,id,'clear-selection',{lineKey:'id: A '}).db;db=edit(db,id,'reply',{vendorCode:'V002',lineKey:'id: A ',price:'26000'}).db;assert.equal(Q.view(db,id,C).rows[0].confirmed,null);
});
test('editing a source preserves the historic reply and backup but blocks further quote mutation',()=>{
 let {db,id}=populated();const store=copy(db.settings.priceRequests),source=db.documents.find(d=>d.id===id);
 db=C.command(db,'document',{...source,memo:'Changed request',lines:source.lines.map(l=>({...l,qty:80,price:55000}))}).db;
 assert.deepEqual(db.settings.priceRequests,store);assert.equal(Q.view(db,id,C).status,'source-changed');assert.equal(Q.view(db,id,C).rows[0].requestedPrice,'50000');assert.equal(Q.view(db,id,C).rows[0].confirmed.price,'25000');
 rejectUnchanged(db,()=>edit(db,id,'close',{vendorCode:'V002',closed:true}),/원본/);assert.deepEqual(C.validateBackup(copy(db)).settings.priceRequests,store);
});
test('cancellation and restoration keep responses; exact source restoration can resume editing',()=>{
 let {db,id}=populated();const store=copy(db.settings.priceRequests);db=C.command(db,'transition',{ids:[id],status:'취소'}).db;assert.equal(Q.view(db,id,C).status,'inactive-source');assert.deepEqual(C.validateBackup(copy(db)).settings.priceRequests,store);
 rejectUnchanged(db,()=>edit(db,id,'clear-selection',{lineKey:'id: A '}),/원본/);
 db=C.command(db,'transition',{ids:[id],status:'진행'}).db;assert.deepEqual(db.settings.priceRequests,store);
 // Transition may attach unrelated metadata; only exact equality permits a fresh edit.
 if(Q.view(db,id,C).status==='ready')assert.equal(edit(db,id,'close',{vendorCode:'V002',closed:true}).result.revision,3);else assert.equal(Q.view(db,id,C).status,'source-changed');
});
test('master code renames leave archived identifiers and replies untouched',()=>{
 let {db,id}=populated();const store=copy(db.settings.priceRequests);db=C.command(db,'rename',{key:'items',from:'M001',to:'M-NEW'}).db;
 assert.equal(Q.view(db,id,C).status,'source-changed');assert.deepEqual(db.settings.priceRequests,store);assert.deepEqual(C.validateBackup(copy(db)).settings.priceRequests,store);
 db=C.command(db,'rename',{key:'partners',from:'V002',to:'V-NEW'}).db;assert.deepEqual(db.settings.priceRequests,store);assert.deepEqual(C.validateBackup(copy(db)).settings.priceRequests,store);
});
test('missing source preserves historical data on import without inventing a new voucher',()=>{
 let {db,id}=populated();const store=copy(db.settings.priceRequests);db.documents=db.documents.filter(d=>d.id!==id);const restored=C.validateBackup(db);assert.equal(Q.view(restored,id,C).status,'missing-source');assert.deepEqual(restored.settings.priceRequests,store);rejectUnchanged(restored,()=>edit(restored,id,'close',{vendorCode:'V001',closed:true}),/원본/);
});
test('view and returned result are detached from the saved store',()=>{
 const {db,id}=populated(),before=JSON.stringify(db),view=Q.view(db,id,C);view.rows[0].confirmed.price='999';view.snapshot.lines[0].price=999;assert.equal(JSON.stringify(db),before);
});
test('malformed optional stores and unknown versions cannot pass backup or normal commands',()=>{
 const {db}=populated();const edits=[s=>s.version=99,s=>s.records.push(copy(s.records[0])),s=>s.records[0].documentId='other',s=>s.records[0].comparison.version=1,s=>s.records[0].snapshot.lines[0].qty=1,s=>s.records[0].comparison.source.fingerprint='fake',s=>s.records[0].comparison.selections[0].price='5',s=>s.records[0].extra=true];
 for(const change of edits){const bad=copy(db);change(bad.settings.priceRequests);rejectUnchanged(bad,()=>C.validateBackup(bad));rejectUnchanged(bad,()=>C.command(bad,'rebuild'));}
 for(const value of [null,false,[],{}]){const bad=copy(db);bad.settings.priceRequests=value;assert.throws(()=>C.validateBackup(bad));}
});
test('independent model v1 is rejected explicitly and compatibility import points to the shared v2 core',()=>{
 assert.equal(require('../scripts/lib/price-request-comparison.cjs'),Q);assert.equal(Q.VERSION,2);const {db,id}=fixture(),doc=db.documents.find(d=>d.id===id),s=Q.create(doc,['V001']);s.version=1;assert.throws(()=>Q.validate(s,doc),/버전/);
});
test('browser-global UMD and Node core produce identical full store and view',()=>{
 const {db,id}=fixture(),ctx=vm.createContext({});for(const file of ['form-core.js','item-core.js','price-request-core.js','inventory-core.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),ctx);
 const actions=[{action:'start',documentId:id,vendorCodes:['V001','V002']},{action:'reply',documentId:id,expectedRevision:0,vendorCode:'V002',lineKey:'id: A ',price:'25000.0123456789'},{action:'select',documentId:id,expectedRevision:1,source:'vendor',vendorCode:'V002',lineKey:'id: A '}];
 let nodeDB=db;for(const a of actions)nodeDB=C.command(nodeDB,'priceRequest',a).db;
 const browser=vm.runInContext(`(()=>{let db=${JSON.stringify(db)};for(const a of ${JSON.stringify(actions)})db=InventoryCore.command(db,'priceRequest',a).db;return JSON.stringify({store:InventoryCore.validateBackup(db).settings.priceRequests,view:PriceRequestCore.view(db,${JSON.stringify(id)},InventoryCore)});})()`,ctx);
 assert.deepEqual(JSON.parse(browser),{store:nodeDB.settings.priceRequests,view:Q.view(nodeDB,id,C)});
});

test('renaming only a non-header quoted vendor cannot leave the old vendor editable',()=>{
 const {db,id}=populated(),store=copy(db.settings.priceRequests);
 const renamed=C.command(db,'rename',{key:'partners',from:'V002',to:'VNEW'}).db;
 assert.equal(Q.view(renamed,id,C).status,'vendor-unavailable');assert.deepEqual(renamed.settings.priceRequests,store);
 rejectUnchanged(renamed,()=>edit(renamed,id,'close',{vendorCode:'V002',closed:true}),/거래처/);assert.deepEqual(C.validateBackup(renamed).settings.priceRequests,store);
 const disabled=C.command(db,'master',{key:'partners',originalCode:'V002',record:{...C.master(db,'partners','V002'),disabled:true}}).db;
 assert.equal(Q.view(disabled,id,C).status,'vendor-unavailable');assert.deepEqual(disabled.settings.priceRequests,store);rejectUnchanged(disabled,()=>edit(disabled,id,'clear-selection',{lineKey:'id: A '}),/거래처/);
});
test('backup and every command validate original companion data before lossy JSON cloning',()=>{
 const {db}=populated();for(const badPrice of [NaN,Infinity,-Infinity,undefined]){
  const corrupted=copy(db);corrupted.settings.priceRequests.records[0].comparison.vendors[0].received[0].price=badPrice;
  assert.throws(()=>Q.validateStore(corrupted.settings.priceRequests));assert.throws(()=>C.validateBackup(corrupted));assert.throws(()=>C.command(corrupted,'rebuild'));
  assert.equal(corrupted.settings.priceRequests.records[0].comparison.vendors[0].received[0].price,badPrice);
 }
 const snapshot=copy(db);snapshot.settings.priceRequests.records[0].snapshot.extra=undefined;assert.throws(()=>C.validateBackup(snapshot));assert.throws(()=>C.command(snapshot,'rebuild'));
 const absent=copy(db);absent.settings.priceRequests=undefined;assert.throws(()=>C.validateBackup(absent));assert.throws(()=>C.command(absent,'rebuild'));
});


test('atomic confirmed selections derive exact prices and advance only once, preserving all unrelated data',()=>{
 let {db,id}=fixture();db=C.command(db,'document',{...db.documents.find(d=>d.id===id),lines:[{lineId:' A ',item:'M001',qty:100,price:50000},{lineId:'B',item:'M001',qty:1,price:2}]}).db;db=start(db,id).db;
 db=edit(db,id,'reply',{vendorCode:'V001',lineKey:'id: A ',price:'0'}).db;db=edit(db,id,'reply',{vendorCode:'V002',lineKey:'id:B',price:'1.9999999999'}).db;
 const before=preserved(db),revision=Q.view(db,id,C).revision,sequence=db.sequence,logs=db.logs.length;
 const out=edit(db,id,'selectMany',{selections:[{lineKey:'id:B',source:'vendor',vendorCode:'V002'},{lineKey:'id: A ',source:'vendor',vendorCode:'V001'}]});
 assert.deepEqual(preserved(out.db),before);assert.equal(out.db.sequence,sequence+1);assert.equal(out.db.logs.length,logs+1);assert.equal(out.result.revision,revision+1);assert.deepEqual(out.result.rows.map(r=>r.confirmed.price),['0','1.9999999999']);assert.deepEqual(C.validateBackup(copy(out.db)).settings.priceRequests,out.db.settings.priceRequests);
});
test('atomic confirmed choices reject every malformed batch without partially changing data',()=>{
 const {db,id}=populated(),valid={lineKey:'id: A ',source:'request',vendorCode:null};
 for(const selections of [[],null,Array(501).fill(valid),[valid,valid],[valid,{lineKey:'bad',source:'request',vendorCode:null}],[{...valid,price:'7'}],[{...valid,source:'vendor',vendorCode:'V001'}],[{...valid,vendorCode:'V002'}],[undefined],Array(1)])rejectUnchanged(db,()=>edit(db,id,'selectMany',{selections}));
 rejectUnchanged(db,()=>run(db,id,'selectMany',{expectedRevision:0,selections:[valid]}),/수정번호/);
});
test('batch selection preserves unmentioned choices and accepts request prices without mutating original voucher',()=>{
 const {db,id}=populated(),before=preserved(db);const out=edit(db,id,'selectMany',{selections:[{lineKey:'id: A ',source:'request',vendorCode:null}]});assert.equal(out.result.rows[0].confirmed.price,'50000');assert.deepEqual(preserved(out.db),before);
 const changed=copy(db);changed.documents.find(d=>d.id===id).memo='later';rejectUnchanged(changed,()=>edit(changed,id,'selectMany',{selections:[{lineKey:'id: A ',source:'request',vendorCode:null}]}),/원본/);
});
