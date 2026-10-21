'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js');
const row=(db,id)=>db.documents.find(d=>d.id===id);
function fixture(ownLineId=false){
  let db=C.empty();db.masters=C.clone(C.seed().masters);
  let out=C.command(db,'document',{type:'request',date:'2026-10-01',warehouse:'W001',lines:[{lineId:'REQUEST-ROW',item:'M001',qty:10,price:100,supplier:'V001',custom:{note:'보존'}}]});
  const requestId=out.result.id;
  out=C.command(out.db,'document',{type:'plan',date:'2026-10-02',warehouse:'W001',sourceId:requestId,lines:[{...(ownLineId?{lineId:'PLAN-ROW'}:{}),sourceLineId:'REQUEST-ROW',item:'M001',qty:6,price:100,supplier:'V001',custom:{note:'보존'}}]});
  assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
  return {db:out.db,requestId,planId:out.result.id};
}
function next(db,sourceId,type,qty,route){
  if(route==='convert')return C.command(db,'convert',{id:sourceId,type,partner:'V001',date:'2026-10-03',quantities:{[row(db,sourceId).lines[0].lineId||'M001']:qty}});
  const original=row(db,sourceId).lines[0];
  const draft={type,date:'2026-10-03',warehouse:'W001',partner:'V001',lines:[]};
  const staged=E.stageDocuments(db,draft,{mode:'linked',selections:[{documentId:sourceId,item:'M001',...(original.lineId?{lineId:original.lineId}:{}),qty}]});
  assert.deepEqual(draft.lines,[]);
  return C.command(db,'document',staged);
}
for(const route of ['convert','picker'])test(`${route}: a valid plan without its own line ID links to orders and purchases without carrying its request-row reference`,()=>{
  const {db,requestId,planId}=fixture(),before=C.clone(db);
  let out=next(db,planId,'purchaseorder',4,route);const orderId=out.result.id;
  assert.equal(out.result.sourceId,planId);assert.equal(out.result.lines[0].sourceLineId,undefined);
  assert.deepEqual(out.result.lines[0].custom,{note:'보존'});
  assert.equal(C.stock(out.db,'M001','W001'),C.stock(db,'M001','W001'));
  assert.equal(C.outstanding(out.db,'payable','V001'),0);
  out=next(out.db,orderId,'purchase',2,route);
  assert.equal(out.result.sourceId,orderId);assert.equal(out.result.lines[0].sourceLineId,undefined);
  assert.equal(C.remaining(out.db,row(out.db,requestId),'plan')[0].qty,4);
  assert.equal(C.remaining(out.db,row(out.db,planId),'purchaseorder')[0].qty,2);
  assert.equal(C.remaining(out.db,row(out.db,orderId),'purchase')[0].qty,2);
  assert.equal(C.stock(out.db,'M001','W001'),C.stock(db,'M001','W001')+2);
  assert.equal(C.outstanding(out.db,'payable','V001'),220);
  assert.deepEqual(out.db.documents.slice(0,2),before.documents);
  assert.deepEqual(out.db.settings,before.settings);assert.deepEqual(db,before);
  assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
for(const route of ['convert','picker'])test(`${route}: each stage uses its immediate source's own line ID when one exists`,()=>{
  const {db,planId}=fixture(true),before=C.clone(db);
  let out=next(db,planId,'purchaseorder',4,route),order=out.result;
  assert.equal(order.lines[0].sourceLineId,'PLAN-ROW');
  out=C.command(out.db,'document',{...order,lines:order.lines.map(l=>({...l,lineId:'ORDER-ROW'}))});order=out.result;
  out=next(out.db,order.id,'purchase',2,route);
  assert.equal(out.result.lines[0].sourceLineId,'ORDER-ROW');
  assert.equal(C.remaining(out.db,row(out.db,planId),'purchaseorder')[0].qty,2);
  assert.equal(C.remaining(out.db,row(out.db,order.id),'purchase')[0].qty,2);
  assert.deepEqual(out.db.documents.slice(0,2),before.documents);
  assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('partial receipts keep quantity limits, cancellation releases only that receipt, and backup keeps the ancestor reference',()=>{
  const {db,requestId,planId}=fixture();let out=next(db,planId,'purchaseorder',4,'convert');const orderId=out.result.id;
  out=next(out.db,orderId,'purchase',2,'picker');const receiptId=out.result.id,before=C.clone(out.db);
  assert.throws(()=>next(out.db,orderId,'purchase',3,'convert'),/잔량/);assert.deepEqual(out.db,before);
  out=C.command(out.db,'transition',{ids:[receiptId],status:'취소'});
  assert.equal(C.remaining(out.db,row(out.db,orderId),'purchase')[0].qty,4);
  assert.equal(C.remaining(out.db,row(out.db,planId),'purchaseorder')[0].qty,2);
  assert.equal(C.remaining(out.db,row(out.db,requestId),'plan')[0].qty,4);
  out=next(out.db,orderId,'purchase',4,'convert');
  assert.equal(C.stock(out.db,'M001','W001'),C.stock(db,'M001','W001')+4);
  assert.equal(C.outstanding(out.db,'payable','V001'),440);
  const backup=C.validateBackup(C.clone(out.db));assert.deepEqual(backup,out.db);
  assert.equal(row(backup,planId).lines[0].sourceLineId,'REQUEST-ROW');
  assert.throws(()=>C.command(out.db,'transition',{ids:[receiptId],status:'진행'}),/잔량/);
});
test('new linking does not make a manually forged ancestor reference valid',()=>{
  const {db,planId}=fixture(),before=C.clone(db);
  assert.throws(()=>C.command(db,'document',{type:'purchaseorder',date:'2026-10-03',warehouse:'W001',partner:'V001',sourceId:planId,lines:[{item:'M001',qty:2,price:100,sourceLineId:'REQUEST-ROW'}]}),/원본/);
  assert.deepEqual(db,before);
});
