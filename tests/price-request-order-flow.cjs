"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/inventory-core.js');
const E = require('../dist/entry-core.js');
const Q = require('../dist/price-request-core.js');
const copy = value => JSON.parse(JSON.stringify(value));
const doc = (db, id) => db.documents.find(row => row.id === id);
const draft = (partner = '') => ({type:'purchaseorder', date:'2026-10-21', warehouse:'W001', partner, status:'진행', vatRate:10, lines:[]});
function fixture({lines=[{item:'M001', qty:10, price:50000}], legacy=false, partner='V001'}={}) {
  let db=C.seed();
  db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'Second supplier',kind:'매입'}}).db;
  const document={type:'pricerequest',date:'2026-10-21',warehouse:'W001',partner:legacy?partner:'',status:'진행',vatRate:10,memo:'preserved request',custom:{origin:'keep'},lines};
  const out=legacy?C.command(db,'document',document):C.command(db,'priceRequestCreate',{document,vendorCodes:['V001','V002']});
  return {db:out.db,id:out.result.id};
}
function edit(db,id,action,extra) {
  return C.command(db,'priceRequest',{action,documentId:id,expectedRevision:Q.view(db,id,C).revision,...extra}).db;
}
function confirm(db,id,{index=0,vendorCode='V002',price='25000'}={}) {
  const lineKey=Q.view(db,id,C).rows[index].lineKey;
  db=edit(db,id,'reply',{vendorCode,lineKey,price});
  return edit(db,id,'select',{source:'vendor',vendorCode,lineKey});
}
function candidates(db,{mode='linked',partner,...extra}={}) {
  return E.documentCandidates(db,{targetType:'purchaseorder',sourceType:'pricerequest',mode,partner,...extra});
}
function selections(candidate,qty) {
  return candidate.lines.map(line=>({documentId:candidate.id,item:line.item,...(line.lineId!==undefined?{lineId:line.lineId}:{}),qty:qty??line.qty,...(line.priceRequestBasis?{priceRequestBasis:copy(line.priceRequestBasis)}:{})}));
}
function stage(db,id,{partner='',qty,mode='linked',selected,adoptHeader=false}={}) {
  const candidate=candidates(db,{mode}).find(row=>row.id===id);
  assert.ok(candidate,'request is available to the picker');
  return E.stageDocuments(db,draft(partner),{mode,selections:selected||selections(candidate,qty),adoptHeader});
}
function rejectsUnchanged(db,action,pattern) {
  const before=copy(db);assert.throws(action,pattern);assert.deepEqual(db,before);
}
function preservation(db) {
  return {masters:copy(db.masters),prices:copy(db.prices),customization:copy(db.settings.customization),comparisons:copy(db.settings.priceRequests)};
}

test('confirmed supplier and 25000 price appear in candidates; staged order is unsaved and preserves the 50000 request',()=>{
  let {db,id}=fixture();db=confirm(db,id);const before=copy(db),rows=candidates(db,{partner:'V002'});
  assert.equal(rows.length,1);assert.equal(rows[0].id,id);assert.equal(rows[0].partnerName,'Second supplier');assert.equal(rows[0].lines[0].price,'25000');
  assert.equal(candidates(db,{partner:'V001'}).length,0);
  const value=stage(db,id,{qty:4,adoptHeader:true});
  assert.equal(value.partner,'V002');assert.equal(value.sourceId,id);assert.equal(value.lines[0].price,'25000');assert.equal(value.lines[0].qty,4);
  assert.equal(value.lines[0].priceRequestBasis.price,'25000');assert.equal(value.lines[0].priceRequestBasis.vendorCode,'V002');assert.equal(value.lines[0].sourceLineId,undefined);
  assert.equal(doc(db,id).lines[0].price,50000);assert.deepEqual(db,before);
});

test('partial order saves, survives backup/readback and feeds partial purchase without consuming request twice',()=>{
  let {db,id}=fixture();db=confirm(db,id);const before=copy(db),kept=preservation(db);
  let out=C.command(db,'document',stage(db,id,{qty:4}));db=C.validateBackup(copy(out.db));const orderId=out.result.id,order=doc(db,orderId);
  assert.equal(order.partner,'V002');assert.equal(order.lines[0].price,25000);assert.equal(order.lines[0].priceRequestBasis.price,'25000');
  assert.equal(C.remaining(db,doc(db,id),'purchaseorder')[0].qty,6);assert.deepEqual(preservation(db),kept);assert.deepEqual(db.documents.slice(0,-1),before.documents);
  out=C.command(db,'convert',{id:orderId,type:'purchase',date:'2026-10-21',quantities:{M001:1.5}});db=C.validateBackup(copy(out.db));
  assert.equal(out.result.partner,'V002');assert.equal(out.result.lines[0].price,25000);assert.equal(out.result.sourceId,orderId);
  assert.equal(C.remaining(db,doc(db,orderId),'purchase')[0].qty,2.5);assert.equal(C.remaining(db,doc(db,id),'purchaseorder')[0].qty,6);
  assert.deepEqual(preservation(db),kept);
});

test('direct conversion applies the same supplier, exact basis and partial quantity as picker staging',()=>{
  let {db,id}=fixture();db=confirm(db,id);const before=copy(db),out=C.command(db,'convert',{id,type:'purchaseorder',date:'2026-10-21',quantities:{M001:3}});
  assert.equal(out.result.partner,'V002');assert.equal(out.result.lines[0].price,25000);assert.equal(out.result.lines[0].qty,3);assert.equal(out.result.lines[0].priceRequestBasis.price,'25000');
  assert.equal(C.remaining(out.db,doc(out.db,id),'purchaseorder')[0].qty,7);assert.deepEqual(db,before);
  rejectsUnchanged(db,()=>C.command(db,'convert',{id,type:'purchaseorder',partner:'V001'}),/거래처/);
});

test('content copy applies confirmed price but carries no quantity link and leaves request remainder intact',()=>{
  let {db,id}=fixture();db=confirm(db,id);const value=stage(db,id,{mode:'copy',qty:3}),out=C.command(db,'document',value);
  assert.equal(value.sourceId,undefined);assert.equal(value.lines[0].sourceLineId,undefined);assert.equal(out.result.partner,'V002');assert.equal(out.result.lines[0].price,25000);
  assert.equal(C.remaining(out.db,doc(out.db,id),'purchaseorder')[0].qty,10);assert.equal(out.result.lines[0].importedFrom[0].mode,'copy');
  assert.equal(C.validateBackup(copy(out.db)).documents.at(-1).lines[0].priceRequestBasis.documentId,id);
});

test('duplicate items preserve immediate source IDs including spaces and separate confirmed prices',()=>{
  let {db,id}=fixture({lines:[{lineId:' A ',item:'M001',qty:5,price:50000},{lineId:'B',item:'M001',qty:7,price:50000}]});db=confirm(db,id,{index:0,price:'25000'});db=confirm(db,id,{index:1,price:'24000'});
  const candidate=candidates(db,{partner:'V002'})[0],selected=selections(candidate);selected[0].qty=2;selected[1].qty=3;
  const out=C.command(db,'document',stage(db,id,{selected})),order=out.result;
  assert.deepEqual(order.lines.map(line=>line.sourceLineId),[' A ','B']);assert.deepEqual(order.lines.map(line=>line.price),[25000,24000]);assert.deepEqual(order.lines.map(line=>line.priceRequestBasis.lineKey),['id: A ','id:B']);
  assert.deepEqual(C.remaining(out.db,doc(out.db,id),'purchaseorder').map(line=>line.qty),[3,4]);
  const receipt=C.command(out.db,'convert',{id:order.id,type:'purchase',quantities:{' A ':1,B:1}});
  assert.deepEqual(receipt.result.lines.map(line=>line.sourceLineId),order.lines.map(line=>line.lineId));assert.deepEqual(C.validateBackup(copy(receipt.db)).documents.at(-1).lines.map(line=>line.price),[25000,24000]);
});

test('stale picker basis rejects changed comparison revision before applying without changing source or draft',()=>{
  let {db,id}=fixture();db=confirm(db,id);const selected=selections(candidates(db)[0],2),input=draft(),beforeDraft=copy(input);
  db=edit(db,id,'close',{vendorCode:'V001',closed:true});
  rejectsUnchanged(db,()=>E.stageDocuments(db,input,{mode:'linked',selections:selected}),/변경|다시/);assert.deepEqual(input,beforeDraft);
});

test('a changed request invalidates an old picker candidate and preserves stored comparison evidence',()=>{
  let {db,id}=fixture();db=confirm(db,id);const selected=selections(candidates(db)[0],2),store=copy(db.settings.priceRequests);
  db=C.command(db,'document',{...doc(db,id),memo:'edited after candidates'}).db;
  assert.equal(Q.view(db,id,C).status,'source-changed');assert.deepEqual(db.settings.priceRequests,store);
  assert.equal(candidates(db).length,0);rejectsUnchanged(db,()=>E.stageDocuments(db,draft(),{mode:'linked',selections:selected}),/변경|비교자료/);
});

for(const change of ['comparison','source'])test(`first save rejects ${change} changed after staging atomically`,()=>{
  let {db,id}=fixture();db=confirm(db,id);const value=stage(db,id,{qty:2}),beforeDraft=copy(value);
  db=change==='comparison'?edit(db,id,'close',{vendorCode:'V001',closed:true}):C.command(db,'document',{...doc(db,id),memo:'after staging'}).db;
  rejectsUnchanged(db,()=>C.command(db,'document',value),/변경|다시|비교자료/);assert.deepEqual(value,beforeDraft);
});

test('first save rechecks already consumed quantity even with unchanged confirmation basis',()=>{
  let {db,id}=fixture();db=confirm(db,id);const value=stage(db,id,{qty:4});db=C.command(db,'convert',{id,type:'purchaseorder',quantities:{M001:8}}).db;
  rejectsUnchanged(db,()=>C.command(db,'document',value),/잔량/);assert.equal(C.remaining(db,doc(db,id),'purchaseorder')[0].qty,2);
});

test('a saved order remains editable and retains its price and evidence after confirmation changes',()=>{
  let {db,id}=fixture();db=confirm(db,id);let out=C.command(db,'document',stage(db,id,{qty:4}));db=out.db;const orderId=out.result.id,saved=copy(out.result);
  db=edit(db,id,'select',{lineKey:'row:0',source:'request',vendorCode:null});const store=copy(db.settings.priceRequests);
  out=C.command(db,'document',{...doc(db,orderId),memo:'saved order memo'});db=C.validateBackup(copy(out.db));
  assert.equal(doc(db,orderId).memo,'saved order memo');assert.equal(doc(db,orderId).partner,'V002');assert.deepEqual(doc(db,orderId).lines,saved.lines);assert.deepEqual(db.settings.priceRequests,store);
  db=C.command(db,'transition',{ids:[orderId],status:'취소'}).db;assert.equal(C.remaining(db,doc(db,id),'purchaseorder')[0].qty,10);
  db=C.command(db,'transition',{ids:[orderId],status:'진행'}).db;assert.equal(C.remaining(db,doc(db,id),'purchaseorder')[0].qty,6);assert.deepEqual(doc(db,orderId).lines,saved.lines);
});

test('legacy request and existing order without comparison keep ordinary editing and backup behavior',()=>{
  let {db,id}=fixture({legacy:true});let out=C.command(db,'convert',{id,type:'purchaseorder',quantities:{M001:4}});db=out.db;const orderId=out.result.id;
  assert.equal(out.result.partner,'V001');assert.equal(out.result.lines[0].price,50000);assert.equal(out.result.lines[0].priceRequestBasis,undefined);
  out=C.command(db,'document',{...doc(db,orderId),memo:'legacy memo'});assert.equal(out.result.lines[0].price,50000);assert.equal(Object.hasOwn(out.db.settings,'priceRequests'),false);
  assert.deepEqual(C.validateBackup(copy(out.db)).documents,out.db.documents);
});

test('mixed confirmed suppliers require separate orders and preserve each source-line remainder',()=>{
  let {db,id}=fixture({lines:[{lineId:'A',item:'M001',qty:5,price:50000},{lineId:'B',item:'M001',qty:7,price:50000}]});db=confirm(db,id,{index:0,vendorCode:'V001',price:'30000'});db=confirm(db,id,{index:1,vendorCode:'V002',price:'25000'});
  rejectsUnchanged(db,()=>stage(db,id),/거래처별|확정 거래처/);rejectsUnchanged(db,()=>C.command(db,'convert',{id,type:'purchaseorder'}),/거래처별|확정 거래처/);
  for(const [vendor,lineId,qty] of [['V001','A',2],['V002','B',3]]){
    const rows=candidates(db,{partner:vendor});assert.equal(rows.length,1);assert.deepEqual(rows[0].lines.map(line=>line.lineId),[lineId]);
    const out=C.command(db,'document',stage(db,id,{partner:vendor,selected:selections(rows[0],qty)}));db=out.db;assert.equal(out.result.partner,vendor);
  }
  assert.deepEqual(C.remaining(db,doc(db,id),'purchaseorder').map(line=>line.qty),[3,4]);assert.doesNotThrow(()=>C.validateBackup(copy(db)));
});

for(const price of ['0','1.9999999999','0.0000000001'])test(`exact confirmed decimal ${price} survives numeric order and backup with its source text`,()=>{
  let {db,id}=fixture();db=confirm(db,id,{price});const out=C.command(db,'document',stage(db,id,{qty:1})),saved=C.validateBackup(copy(out.db)).documents.at(-1);
  assert.equal(saved.lines[0].price,Number(price));assert.equal(saved.lines[0].priceRequestBasis.price,price);assert.equal(Q.view(out.db,id,C).rows[0].confirmed.price,price);
});

test('large precision that cannot roundtrip is rejected before applying or creating an order',()=>{
  let {db,id}=fixture();db=confirm(db,id,{price:'999999999999.9999999999'});const source=doc(db,id);
  assert.equal(candidates(db).length,0);rejectsUnchanged(db,()=>C.priceRequestOrderLines(db,source,source.lines),/정밀도/);
  rejectsUnchanged(db,()=>E.stageDocuments(db,draft(),{mode:'linked',selections:[{documentId:id,item:'M001',qty:1}]}),/정밀도/);
  rejectsUnchanged(db,()=>C.command(db,'convert',{id,type:'purchaseorder'}),/정밀도/);assert.equal(Q.view(db,id,C).rows[0].confirmed.price,'999999999999.9999999999');
});

test('request-price or unconfirmed rows retain an explicitly chosen order supplier without inventing one',()=>{
  for(const selected of [false,true]){let {db,id}=fixture();if(selected)db=edit(db,id,'select',{lineKey:'row:0',source:'request',vendorCode:null});const value=stage(db,id,{partner:'V002',qty:2,adoptHeader:true});
    assert.equal(value.partner,'V002');assert.equal(value.lines[0].price,'50000');assert.equal(value.lines[0].priceRequestBasis.vendorCode,null);assert.equal(value.lines[0].priceRequestBasis.source,selected?'request':null);assert.equal(C.command(db,'document',value).result.partner,'V002');
  }
});

test('saved basis cannot be stripped or altered; malformed backup is rejected without touching input',()=>{
  let {db,id}=fixture();db=confirm(db,id);const out=C.command(db,'document',stage(db,id,{qty:2}));db=out.db;const saved=out.result;
  for(const mutate of [line=>delete line.priceRequestBasis,line=>line.priceRequestBasis.price='1',line=>line.priceRequestBasis.lineKey='row:9']){const changed=copy(saved);mutate(changed.lines[0]);rejectsUnchanged(db,()=>C.command(db,'document',changed),/근거|원본|품목행/);}
  const broken=copy(db);doc(broken,saved.id).lines[0].priceRequestBasis.price=NaN;const before=copy(db);assert.throws(()=>C.validateBackup(broken));assert.deepEqual(db,before);
});


test('legacy picker keeps header supplier filtering',()=>{
  const {db,id}=fixture({legacy:true});
  assert.equal(candidates(db,{partner:'V001'}).find(row=>row.id===id)?.partnerName,'샘플 구매처');
  assert.equal(candidates(db,{partner:'V002'}).some(row=>row.id===id),false);
});

test('legacy picker adopts the source header supplier for an empty new order',()=>{
  const {db,id}=fixture({legacy:true}),before=copy(db);
  const value=stage(db,id,{qty:2});assert.equal(value.partner,'V001');assert.equal(value.lines[0].price,50000);assert.equal(value.lines[0].priceRequestBasis,undefined);
  assert.equal(C.command(db,'document',value).result.partner,'V001');assert.deepEqual(db,before);
});

test('an already saved legacy order remains editable after comparison data is started later',()=>{
  let {db,id}=fixture({legacy:true});let out=C.command(db,'document',{...draft('V001'),sourceId:id,lines:[{item:'M001',qty:3,price:50000}]});db=out.db;const orderId=out.result.id,saved=copy(out.result);
  db=C.command(db,'priceRequest',{action:'start',documentId:id,vendorCodes:['V001','V002']}).db;db=confirm(db,id);const comparison=copy(db.settings.priceRequests);
  out=C.command(db,'document',{...doc(db,orderId),memo:'old order, later comparison'});
  assert.equal(out.result.partner,'V001');assert.deepEqual(out.result.lines,saved.lines);assert.equal(out.result.lines[0].priceRequestBasis,undefined);assert.deepEqual(out.db.settings.priceRequests,comparison);assert.doesNotThrow(()=>C.validateBackup(copy(out.db)));
});

test('a confirmed vendor supersedes a legacy request header only through its validated comparison evidence',()=>{
  let {db,id}=fixture({legacy:true});db=C.command(db,'priceRequest',{action:'start',documentId:id,vendorCodes:['V001','V002']}).db;db=confirm(db,id);
  const value=stage(db,id,{qty:2,adoptHeader:true}),out=C.command(db,'document',value);
  assert.equal(out.result.partner,'V002');assert.equal(doc(out.db,id).partner,'V001');assert.equal(out.result.lines[0].price,25000);
  assert.equal(C.command(db,'convert',{id,type:'purchaseorder',quantities:{M001:2}}).result.partner,'V002');
});


test('first save rejects a forged basis pointing to a missing or non-request document atomically',()=>{
  for(const mode of ['linked','copy']){let {db,id}=fixture();db=confirm(db,id);const valid=stage(db,id,{mode,qty:2}),unrelated=db.documents.find(row=>row.type!=='pricerequest').id;
    for(const documentId of ['missing-request',unrelated]){const forged=copy(valid);forged.lines[0].priceRequestBasis.documentId=documentId;rejectsUnchanged(db,()=>C.command(db,'document',forged),/근거|원본|단가요청/);}
  }
});


for(const [key,from,to] of [['items','M001','M-RENAMED'],['partners','V002','V-RENAMED']])test(`renaming ${key} cannot leave a confirmed order with invalid backup or unusable saved evidence`,()=>{
  let {db,id}=fixture();db=confirm(db,id);const out=C.command(db,'document',stage(db,id,{qty:2}));db=out.db;const orderId=out.result.id,before=copy(db);
  let renamed;
  try{renamed=C.command(db,'rename',{key,from,to});}catch{assert.deepEqual(db,before);return;}
  // A safe explicit refusal is permitted; a successful rename must remain reloadable and editable.
  const restored=C.validateBackup(copy(renamed.db));const edited=C.command(restored,'document',{...doc(restored,orderId),memo:'after a successful code rename'});
  assert.equal(edited.result.lines[0].price,25000);assert.equal(edited.result.lines[0].qty,2);assert.deepEqual(db,before);
});
