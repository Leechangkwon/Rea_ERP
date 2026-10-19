'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js');
function fixture(){
  const db=C.empty();
  db.masters.items=[{code:'A',name:'품목 A'},{code:'B',name:'품목 B'}];
  db.masters.partners=[{code:'V1',name:'첫 구매처'},{code:'V2',name:'둘째 구매처'},{code:'V3',name:'다른 구매처'}];
  db.masters.warehouses=[{code:'W',name:'검증 창고'}];
  db.documents=[{id:'PLAN',type:'plan',date:'2026-10-01',warehouse:'W',partner:'',status:'진행',confirmation:'확인',progress:'진행',vatRate:10,lines:[{lineId:'L1',item:'A',qty:5,price:100,supplier:'V1',progress:'진행'},{lineId:'L2',item:'B',qty:4,price:200,supplier:'V2',progress:'진행'}]}];
  return db;
}
test('plan rows imported into an order can be saved without plan-only progress leaking',()=>{
  const db=fixture(),before=structuredClone(db);
  const staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
  const saved=C.command(db,'document',staged);
  assert.equal(saved.result.type,'purchaseorder');assert.equal(saved.result.sourceId,'PLAN');
  assert.equal(saved.result.lines[0].sourceLineId,'L1');assert.equal(saved.result.lines[0].qty,2);
  assert.equal(Object.hasOwn(saved.result.lines[0],'progress'),false);
  assert.equal(C.remaining(saved.db,saved.db.documents.find(d=>d.id==='PLAN'),'purchaseorder').find(l=>l.lineId==='L1').qty,3);
  assert.deepEqual(db,before);
});
test('document picker matches row suppliers and shows only that supplier rows',()=>{
  const db=fixture(),before=structuredClone(db);
  for(const type of ['request','plan']){
    db.documents[0].type=type;
    const rows=E.documentCandidates(db,{mode:'copy',sourceType:type,partner:'V2'});
    assert.equal(rows.length,1);assert.deepEqual(rows[0].lines.map(l=>l.lineId),['L2']);
    assert.match(rows[0].partnerName,/둘째 구매처/);
    assert.equal(E.documentCandidates(db,{mode:'copy',sourceType:type,partner:'V3'}).length,0);
    const queried=E.documentCandidates(db,{mode:'copy',sourceType:type,query:'둘째 구매처'});
    assert.equal(queried.length,1);
  }
  db.documents[0].type='plan';assert.deepEqual(db,before);
});
test('ordinary document partner filtering still requires the header partner',()=>{
  const db=fixture();db.documents=[{...db.documents[0],id:'ORDER',type:'purchaseorder',partner:'V1',lines:[{item:'A',qty:2,price:100}]}];
  assert.equal(E.documentCandidates(db,{mode:'copy',partner:'V1'}).length,1);
  assert.equal(E.documentCandidates(db,{mode:'copy',partner:'V2'}).length,0);
});
test('completed plan rows cannot be linked through the general picker or after a stale preview',()=>{
  const db=fixture(),draft={type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]};
  const options={mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]};
  assert.equal(E.documentCandidates(db,{mode:'linked',sourceType:'plan',targetType:'purchaseorder',partner:'V1'}).length,1);
  db.documents[0].lines[0].progress='완료';const before=structuredClone(db);
  assert.equal(E.documentCandidates(db,{mode:'linked',sourceType:'plan',targetType:'purchaseorder',partner:'V1'}).length,0);
  assert.throws(()=>E.stageDocuments(db,draft,options),/완료된 발주계획/);
  assert.equal(E.documentCandidates(db,{mode:'copy',sourceType:'plan',partner:'V1'}).length,1);
  assert.deepEqual(db,before);assert.deepEqual(draft.lines,[]);
});
test('a plan row cannot be charged to another supplier through a stale selection',()=>{
  const db=fixture(),before=structuredClone(db);
  assert.throws(()=>E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V2',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]}),/품목행의 거래처/);
  assert.deepEqual(db,before);
});
test('linked picker preserves the existing source header partner restriction',()=>{
 const db=fixture();db.documents[0].partner='V1';
 assert.equal(E.documentCandidates(db,{mode:'copy',sourceType:'plan',partner:'V2'}).length,1);
 assert.equal(E.documentCandidates(db,{mode:'linked',sourceType:'plan',targetType:'purchaseorder',partner:'V2'}).length,0);
 assert.equal(E.documentCandidates(db,{mode:'linked',sourceType:'plan',targetType:'purchaseorder',partner:'V1'}).length,1);
});
test('final order save rechecks the plan supplier after the staged header is changed',()=>{
 const db=fixture(),before=structuredClone(db),staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
 staged.partner='V2';assert.throws(()=>C.command(db,'document',staged),/품목행의 거래처/);assert.deepEqual(db,before);
});
test('a plan completed after staging blocks new order consumption at final save',()=>{
 const db=fixture(),staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
 db.documents[0].lines[0].progress='완료';const before=structuredClone(db);
 assert.throws(()=>C.command(db,'document',staged),/완료된 발주계획/);assert.deepEqual(db,before);
});
test('existing orders on completed plan lines keep price edits but cannot increase allocation',()=>{
 const db=fixture(),staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
 const first=C.command(db,'document',staged);first.db.documents.find(d=>d.id==='PLAN').lines[0].progress='완료';
 const changed=structuredClone(first.result);changed.lines[0].price=150;
 const edited=C.command(first.db,'document',changed);assert.equal(edited.result.id,first.result.id);assert.equal(edited.result.lines[0].price,150);
 const before=structuredClone(edited.db);changed.lines[0].qty=3;
 assert.throws(()=>C.command(edited.db,'document',changed),/완료된 발주계획/);assert.deepEqual(edited.db,before);
});
test('adding a second plan row revalidates earlier draft rows against the current supplier',()=>{
 const db=fixture(),staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
 staged.partner='V2';const before=structuredClone(db),draftBefore=structuredClone(staged);
 assert.throws(()=>E.stageDocuments(db,staged,{mode:'linked',selections:[{documentId:'PLAN',item:'B',lineId:'L2',qty:1}]}),/품목행의 거래처/);
 assert.deepEqual(db,before);assert.deepEqual(staged,draftBefore);
});
test('adding another plan row cannot retain earlier unsaved rows that have since completed',()=>{
 const db=fixture();db.documents[0].lines[1].supplier='V1';
 const staged=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]},{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]});
 db.documents[0].lines[0].progress='완료';const before=structuredClone(db);
 assert.throws(()=>E.stageDocuments(db,staged,{mode:'linked',selections:[{documentId:'PLAN',item:'B',lineId:'L2',qty:1}]}),/완료된 발주계획/);assert.deepEqual(db,before);
});
test('completed plan allocation rejects even one unit of six-decimal precision',()=>{
 const db=fixture(),draft={type:'purchaseorder',date:'2026-10-02',warehouse:'W',partner:'V1',status:'진행',lines:[]};
 const micro=E.stageDocuments(db,draft,{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:0.000001}]});
 const existing=C.command(db,'document',E.stageDocuments(db,draft,{mode:'linked',selections:[{documentId:'PLAN',item:'A',lineId:'L1',qty:2}]}));
 db.documents[0].lines[0].progress='완료';assert.throws(()=>C.command(db,'document',micro),/완료된 발주계획/);
 existing.db.documents.find(d=>d.id==='PLAN').lines[0].progress='완료';const increment=structuredClone(existing.result);increment.lines[0].qty=2.000001;
 const before=structuredClone(existing.db);assert.throws(()=>C.command(existing.db,'document',increment),/완료된 발주계획/);assert.deepEqual(existing.db,before);
});
