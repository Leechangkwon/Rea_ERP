const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js');
function fixture(){
  const db=C.empty();
  db.masters.items=[{code:'A',name:'가상 자재',buyPrice:100,sellPrice:150,safety:0}];
  db.masters.partners=[{code:'V1',name:'가상 공급사1'},{code:'V2',name:'가상 공급사2'}];
  db.masters.warehouses=[{code:'W1',name:'가상 창고1'},{code:'W2',name:'가상 창고2'},{code:'W3',name:'가상 창고3'}];
  db.opening=[{item:'A',warehouse:'W1',qty:20,date:'2026-01-01'}];
  return db;
}
function chain(type='purchaseorder',target='purchase',partner='V1'){
  let out=C.command(fixture(),'document',{type,date:'2026-10-01',warehouse:'W1',partner,status:'진행',vatRate:10,lines:[{item:'A',qty:10,price:100}]});
  const sourceId=out.result.id;
  out=C.command(out.db,'convert',{id:sourceId,type:target,partner:'V1',date:'2026-10-02',quantities:{A:4}});
  return {db:out.db,sourceId,childId:out.result.id};
}
const row=(db,id)=>db.documents.find(d=>d.id===id);
for(const [type,target] of [['request','plan'],['request','purchaseorder'],['plan','purchaseorder'],['pricerequest','purchaseorder'],['purchaseorder','purchase']]){
  test(`${type}→${target}: 원본 거래처·창고 수정 실패는 전체 자료와 잔량을 보존한다`,()=>{
    const {db,sourceId,childId}=chain(type,target),before=C.clone(db),source=row(db,sourceId);
    for(const change of [{partner:'V2'},{warehouse:'W2'}]){
      assert.throws(()=>C.command(db,'document',{...source,...change}),/후속.*(거래처|창고)/);
      assert.deepEqual(db,before);
      assert.equal(C.remaining(db,source,target)[0].qty,6);
      assert.equal(C.stock(db,'A','W1'),target==='purchase'?24:20);
      assert.equal(C.outstanding(db,'payable','V1'),target==='purchase'?440:0);
    }
    const edited=C.command(db,'document',{...row(db,childId),memo:'기존 후속 적요 수정'});
    assert.equal(edited.result.memo,'기존 후속 적요 수정');
    assert.deepEqual(C.validateBackup(C.clone(db)),db);
  });
}
test('부모 적요 수정과 거래처 코드 변경은 후속 전표 금액과 수불을 보존한다',()=>{
  const {db,sourceId,childId}=chain(),before=C.clone(row(db,childId));
  let out=C.command(db,'document',{...row(db,sourceId),memo:'원본 적요 수정'});
  assert.deepEqual(row(out.db,childId),before);
  out=C.command(out.db,'rename',{key:'partners',from:'V1',to:'V-NEW'});
  assert.equal(row(out.db,sourceId).partner,'V-NEW');
  assert.equal(row(out.db,childId).partner,'V-NEW');
  assert.equal(C.outstanding(out.db,'payable','V-NEW'),440);
  assert.equal(C.stock(out.db,'A','W1'),24);
  assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('빈 원본 거래처는 후속 거래처와 일치하도록 지정하거나 비워 둘 수 있다',()=>{
  const {db,sourceId}=chain('request','purchaseorder',''),source=row(db,sourceId);
  assert.equal(C.command(db,'document',{...source,partner:'V1'}).result.partner,'V1');
  assert.throws(()=>C.command(db,'document',{...source,partner:'V2'}),/후속.*거래처/);
  assert.equal(C.command(db,'document',{...source,memo:'빈 거래처 유지'}).result.partner,'');
  const fixed=C.command(db,'document',{...source,partner:'V1'});
  assert.equal(C.command(fixed.db,'document',{...fixed.result,partner:''}).result.partner,'');
});
test('취소된 후속 전표는 원본 헤더를 잠그지 않으며 자동 변경하지 않는다',()=>{
  const {db,sourceId,childId}=chain();
  const canceled=C.command(db,'transition',{ids:[childId],status:'취소'}),child=C.clone(row(canceled.db,childId));
  const out=C.command(canceled.db,'document',{...row(canceled.db,sourceId),partner:'V2',warehouse:'W2'});
  assert.deepEqual(row(out.db,childId),child);
  assert.equal(C.outstanding(out.db,'payable','V1'),0);
  assert.equal(C.stock(out.db,'A','W1'),20);
  assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
});
test('옛 불일치 백업을 자동 수정하거나 거절하지 않고 일치 값으로 바로잡을 수 있다',()=>{
  const {db,sourceId,childId}=chain();
  row(db,sourceId).partner='V2';row(db,sourceId).warehouse='W2';
  const before=C.clone(db),restored=C.validateBackup(C.clone(db));
  assert.deepEqual(restored,before);assert.deepEqual(db,before);
  const out=C.command(restored,'document',{...row(restored,sourceId),partner:'V1',warehouse:'W1'});
  assert.deepEqual(row(out.db,childId),row(before,childId));
  assert.equal(C.command(out.db,'document',{...row(out.db,childId),memo:'복구 후 수정'}).result.memo,'복구 후 수정');
});
test('이동→판매는 도착창고만 연결하며 판매 거래처 독립성을 보존한다',()=>{
  let out=C.command(fixture(),'document',{type:'transfer',date:'2026-10-01',warehouse:'W1',targetWarehouse:'W2',partner:'',lines:[{item:'A',qty:10,price:100}]});
  const sourceId=out.result.id;
  out=C.command(out.db,'convert',{id:sourceId,type:'sale',partner:'V1',date:'2026-10-02',quantities:{A:4}});
  const db=out.db,childId=out.result.id;
  const edited=C.command(db,'document',{...row(db,sourceId),partner:'V2',memo:'이동 거래처 변경'});
  assert.equal(row(edited.db,childId).partner,'V1');
  assert.equal(row(edited.db,childId).warehouse,'W2');
  assert.throws(()=>C.command(db,'document',{...row(db,sourceId),targetWarehouse:'W3'}),/후속.*창고/);
  assert.deepEqual(C.validateBackup(C.clone(edited.db)),edited.db);
});

for(const state of ['취소','보류','미확인'])test(`${state} 후 복원 시 현재 원본 헤더를 확인하고 실패하면 전체 자료를 보존한다`,()=>{
  for(const change of [{partner:'V2'},{warehouse:'W2'}]){
    let {db,sourceId,childId}=chain();
    db=C.command(db,'transition',{ids:[childId],status:state}).db;
    db=C.command(db,'document',{...row(db,sourceId),...change}).db;
    const before=C.clone(db),payload=state==='미확인'?{ids:[childId],confirmation:'확인'}:{ids:[childId],status:'진행'};
    assert.throws(()=>C.command(db,'transition',payload),/원본 전표.*(거래처|창고)/);
    assert.deepEqual(db,before);assert.equal(C.stock(db,'A','W1'),20);assert.equal(C.outstanding(db,'payable','V1'),0);
    db=C.command(db,'document',{...row(db,sourceId),partner:'V1',warehouse:'W1'}).db;
    const out=C.command(db,'transition',payload);
    assert.equal(C.stock(out.db,'A','W1'),24);assert.equal(C.outstanding(out.db,'payable','V1'),440);
    assert.equal(C.command(out.db,'document',{...row(out.db,childId),memo:'복원 후 수정'}).result.memo,'복원 후 수정');
  }
});
test('복원 일괄 처리 중 불일치 한 건이면 앞선 복원과 모든 이력을 함께 취소한다',()=>{
  let {db,sourceId,childId}=chain();
  let out=C.command(db,'convert',{id:sourceId,type:'purchase',quantities:{A:2}}),otherId=out.result.id;
  db=C.command(out.db,'transition',{ids:[childId,otherId],status:'취소'}).db;
  db=C.command(db,'document',{...row(db,sourceId),partner:'V2'}).db;
  db=C.command(db,'document',{...row(db,otherId),partner:'V2'}).db;
  const before=C.clone(db);
  assert.throws(()=>C.command(db,'transition',{ids:[otherId,childId],status:'진행'}),/원본 전표.*거래처/);
  assert.deepEqual(db,before);
});
test('부모와 자식의 일괄 복원은 선택 순서와 무관하게 최종 연결 상태를 검사한다',()=>{
  const {db,sourceId,childId}=chain();
  const canceled=C.command(db,'transition',{ids:[sourceId,childId],status:'취소'}).db;
  for(const ids of [[childId,sourceId],[sourceId,childId]]){
    const out=C.command(canceled,'transition',{ids,status:'진행'});
    assert.equal(C.stock(out.db,'A','W1'),24);assert.equal(C.outstanding(out.db,'payable','V1'),440);
    assert.deepEqual(C.validateBackup(C.clone(out.db)),out.db);
  }
});
