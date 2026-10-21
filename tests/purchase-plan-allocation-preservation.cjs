'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),P=require('../dist/purchase-plan-core.js');
const row=(db,id)=>db.documents.find(d=>d.id===id);
function fixture(structured=false){
 let db=C.empty();db.masters=C.clone(C.seed().masters);
 const plans=[];
 for(let i=0;i<2;i++){
  const lines=structured?[{lineId:'ROW1',item:'M001',qty:10,price:100,supplier:'V001'},{lineId:'ROW2',item:'M001',qty:10,price:100,supplier:'V001'}]:[{item:'M001',qty:10,price:100,supplier:'V001'}];
  const out=C.command(db,'document',{type:'plan',date:'2026-10-01',dueDate:'2026-10-31',warehouse:'W001',lines});db=out.db;plans.push(out.result.id);
 }
 const selections=structured?[{documentId:plans[0],item:'M001',lineId:'ROW1',qty:2},{documentId:plans[0],item:'M001',lineId:'ROW2',qty:2}]:plans.map(documentId=>({documentId,item:'M001',qty:2}));
 const out=P.commit(db,P.preview(db,{date:'2026-10-02',grouping:'supplier-date-item',selections}));
 return {db:out.db,plans,orderId:out.result[0].id};
}
function close(db,id,lineId){return lineId?C.command(db,'planLineProgress',{selections:[{documentId:id,item:'M001',lineId}],progress:'완료'}).db:C.command(db,'transition',{ids:[id],status:'완료'}).db;}
function edited(db,id,quantities){const d=C.clone(row(db,id));d.lines[0].planAllocations.forEach((a,i)=>a.qty=quantities[i]);d.lines[0].qty=C.quantity(quantities.reduce((a,b)=>a+b,0));return d;}
function rejected(db,input){const before=C.clone(db);assert.throws(()=>C.command(db,'document',input),/완료된 발주계획/);assert.deepEqual(db,before);}
for(const structured of [false,true])test(`completed grouped allocations cannot increase or absorb another allocation (own row IDs ${structured})`,()=>{
 let {db,plans,orderId}=fixture(structured);db=close(db,plans[0],structured?'ROW1':undefined);
 rejected(db,edited(db,orderId,[3,2]));rejected(db,edited(db,orderId,[3,1]));
 assert.deepEqual(C.validateBackup(C.clone(db)),db);
});
test('a completed allocation cannot be split across order rows to disguise a higher sum',()=>{
 let {db,plans,orderId}=fixture();db=close(db,plans[0]);
 const d=C.clone(row(db,orderId)),first=d.lines[0];
 first.planAllocations=[first.planAllocations[0]];first.qty=2;
 d.lines.push({...C.clone(first),lineId:'SPLIT',qty:1,planAllocations:[{...C.clone(first.planAllocations[0]),qty:1}]});
 rejected(db,d);
});
test('the smallest supported quantity increment is rejected on completed grouped rows',()=>{
 let {db,plans,orderId}=fixture();db=close(db,plans[0]);rejected(db,edited(db,orderId,[2.000001,2]));
});
test('new grouped orders and stale batch payloads cannot allocate completed plan rows',()=>{
 let {db,plans,orderId}=fixture();const d=C.clone(row(db,orderId));delete d.id;d.lines[0].planAllocations=d.lines[0].planAllocations.filter(a=>a.documentId===plans[0]);d.lines[0].qty=2;
 db=close(db,plans[0]);rejected(db,d);
 const valid=C.clone(d);valid.lines[0].planAllocations[0].documentId=plans[1];const before=C.clone(db);
 assert.throws(()=>C.command(db,'purchasePlanGenerate',{documents:[valid,d]}),/완료된 발주계획/);assert.deepEqual(db,before);
});
test('open rows may increase while completed rows stay unchanged, and completed rows may decrease',()=>{
 let {db,plans,orderId}=fixture();db=close(db,plans[0]);
 let out=C.command(db,'document',edited(db,orderId,[2,3]));assert.equal(C.remaining(out.db,row(out.db,plans[1]),'purchaseorder')[0].qty,7);
 out=C.command(out.db,'document',edited(out.db,orderId,[1,3]));assert.equal(C.remaining(out.db,row(out.db,plans[0]),'purchaseorder')[0].qty,9);
 assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('unchanged completed allocation survives price edits, reference reordering and equal-total row splits',()=>{
 let {db,plans,orderId}=fixture();db=close(db,plans[0]);db=close(db,plans[1]);
 const d=C.clone(row(db,orderId));d.memo='보존 메모';d.lines[0].price=120;d.lines[0].planAllocations.reverse();
 let out=C.command(db,'document',d);assert.equal(out.result.memo,'보존 메모');assert.equal(C.totals(out.result).total,528);
 const split=C.clone(out.result),first=split.lines[0],alloc=first.planAllocations[0];
 first.planAllocations[0]={...alloc,qty:1};first.qty=3;
 split.lines.push({...C.clone(first),lineId:'SPLIT',qty:1,planAllocations:[{...alloc,qty:1}]});
 out=C.command(out.db,'document',split);
 assert.deepEqual(plans.map(id=>C.remaining(out.db,row(out.db,id),'purchaseorder')[0].qty),[8,8]);
 assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
for(const state of ['취소','보류','미확인'])test(`same-quantity ${state} restoration remains valid after source completion`,()=>{
 let {db,plans,orderId}=fixture();db=C.command(db,'transition',{ids:[orderId],status:state}).db;db=close(db,plans[0]);
 const before=C.clone(row(db,orderId));const payload=state==='미확인'?{ids:[orderId],confirmation:'확인'}:{ids:[orderId],status:'진행'};
 const out=C.command(db,'transition',payload);assert.equal(C.active(row(out.db,orderId)),true);assert.deepEqual(row(out.db,orderId).lines,before.lines);
 assert.equal(C.remaining(out.db,row(out.db,plans[0]),'purchaseorder')[0].qty,8);assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('historical allocations on completed plans read unchanged and remain editable without retroactive migration',()=>{
 let {db,plans,orderId}=fixture();const historical=C.command(db,'document',edited(db,orderId,[3,2])).db;
 db=close(historical,plans[0]);const before=C.clone(db),restored=C.validateBackup(C.clone(db));assert.deepEqual(restored,before);
 const out=C.command(restored,'document',{...row(restored,orderId),memo:'과거 배분 보존'});
 assert.deepEqual(out.result.lines,row(before,orderId).lines);assert.deepEqual(row(out.db,plans[0]),row(before,plans[0]));assert.deepEqual(out.db.settings,before.settings);
});
test('linked purchases and their stock/payable remain unchanged when grouped allocation growth is rejected',()=>{
 let {db,plans,orderId}=fixture();let out=C.command(db,'convert',{id:orderId,type:'purchase',quantities:{PL1:1},date:'2026-10-03'});db=close(out.db,plans[0]);
 const before=C.clone(db);rejected(db,edited(db,orderId,[3,2]));
 const saved=C.command(db,'document',{...row(db,orderId),memo:'구매 보존'});
 assert.deepEqual(saved.db.documents.find(d=>d.type==='purchase'),before.documents.find(d=>d.type==='purchase'));
 assert.equal(C.stock(saved.db,'M001','W001'),1);assert.equal(C.outstanding(saved.db,'payable','V001'),110);
 assert.deepEqual(C.validateBackup(C.clone(saved.db)),saved.db);
});
