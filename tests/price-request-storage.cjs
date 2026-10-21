"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../dist/inventory-core.js'),Q=require('../dist/price-request-core.js');
const copy=x=>JSON.parse(JSON.stringify(x));
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
