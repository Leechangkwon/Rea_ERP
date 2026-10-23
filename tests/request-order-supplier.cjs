'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js');
function fixture(lines=[{lineId:'R1',item:'M001',qty:5,price:100}]){
 const db=C.seed();db.documents=[];C.master(db,'items','M001').supplier='V001';
 db.masters.partners.push({code:'V002',name:'수동 구매처'});
 return C.command(db,'document',{type:'request',date:'2026-10-23',warehouse:'W001',lines});
}
const target=()=>({type:'purchaseorder',date:'2026-10-23',warehouse:'W001',lines:[]});
const selections=request=>request.lines.map(l=>({documentId:request.id,item:l.item,lineId:l.lineId,qty:2}));
test('direct request → order → partial receipt inherits the sole supplier and preserves source, stock, debt and backup',()=>{
 const saved=fixture(),before=C.clone(saved.db),request=saved.result,stock=C.stock(saved.db,'M001','W001');
 let out=C.command(saved.db,'convert',{id:request.id,type:'purchaseorder',quantities:{R1:3}}),order=out.result;
 assert.equal(order.partner,'V001');assert.equal(order.lines[0].sourceLineId,'R1');
 assert.equal(C.remaining(out.db,request,'purchaseorder')[0].qty,2);assert.equal(C.stock(out.db,'M001','W001'),stock);assert.equal(C.outstanding(out.db,'payable','V001'),0);
 out=C.command(out.db,'convert',{id:order.id,type:'purchase',quantities:{R1:2}});
 assert.equal(out.result.partner,'V001');assert.equal(C.stock(out.db,'M001','W001'),stock+2);assert.equal(C.outstanding(out.db,'payable','V001'),220);
 assert.equal(C.remaining(out.db,order,'purchase')[0].qty,1);assert.deepEqual(out.db.documents[0],request);assert.deepEqual(saved.db,before);
 assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
for(const mode of ['copy','linked'])test(`${mode}: selected request rows default the empty order header without writing until save`,()=>{
 const saved=fixture(),before=C.clone(saved.db),draft=target();
 const staged=E.stageDocuments(saved.db,draft,{mode,selections:selections(saved.result)});
 assert.equal(staged.partner,'V001');assert.deepEqual(draft,target());assert.deepEqual(saved.db,before);
 const out=C.command(saved.db,'document',staged);assert.equal(out.result.partner,'V001');assert.equal(out.result.lines[0].qty,2);
 assert.equal(out.result.sourceId,mode==='linked'?saved.result.id:undefined);
 assert.equal(C.remaining(out.db,saved.result,'purchaseorder')[0].qty,mode==='linked'?3:5);
 assert.equal(C.outstanding(out.db,'payable','V001'),0);assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('only the selected request rows determine the default, including a manual line supplier',()=>{
 const saved=fixture([{lineId:'R1',item:'M001',qty:5,price:100,supplier:'V002'},{lineId:'R2',item:'P001',qty:4,price:200,supplier:'V001'}]);
 const chosen=[selections(saved.result)[0]],staged=E.stageDocuments(saved.db,target(),{mode:'linked',selections:chosen});
 assert.equal(staged.partner,'V002');assert.equal(C.command(saved.db,'document',staged).result.partner,'V002');
 assert.equal(C.command(saved.db,'convert',{id:saved.result.id,type:'purchaseorder',quantities:{R1:2,R2:0}}).result.partner,'V002');
});
test('an explicit order supplier remains authoritative',()=>{
 const saved=fixture();
 assert.equal(C.command(saved.db,'convert',{id:saved.result.id,type:'purchaseorder',partner:'V002'}).result.partner,'V002');
 for(const mode of ['copy','linked']){
  const staged=E.stageDocuments(saved.db,{...target(),partner:'V002'},{mode,selections:selections(saved.result)});
  assert.equal(C.command(saved.db,'document',staged).result.partner,'V002');
 }
});
test('mixed or unresolved suppliers are never guessed and failed saves are atomic',()=>{
 for(const lines of [[{lineId:'R1',item:'M001',qty:5,price:100,supplier:'V001'},{lineId:'R2',item:'P001',qty:4,price:200,supplier:'V002'}],[{lineId:'R1',item:'P001',qty:5,price:100}]]){
  const saved=fixture(lines),before=C.clone(saved.db);
  for(const mode of ['copy','linked']){const staged=E.stageDocuments(saved.db,target(),{mode,selections:selections(saved.result)});assert.equal(staged.partner||'','');assert.throws(()=>C.command(saved.db,'document',staged),/거래처는 필수/);}
  assert.throws(()=>C.command(saved.db,'convert',{id:saved.result.id,type:'purchaseorder'}),/거래처는 필수/);assert.deepEqual(saved.db,before);
 }
});
