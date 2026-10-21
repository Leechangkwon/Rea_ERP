'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js'),Q=require('../dist/price-request-core.js');
const clone=C.clone,targets=['pricerequest','purchaseorder'];
function fixture(){
  let db=C.empty();db.masters=clone(C.seed().masters);
  db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'다른 구매처',kind:'매입'}}).db;
  const docs={};
  for(const [type,price] of [['pricerequest',90],['purchaseorder',100],['purchase',200],['quote',500]]){
    const out=C.command(db,'document',{type,date:'2026-10-21',partner:type==='quote'?'C001':'V001',warehouse:'W001',custom:{origin:type},lines:[{lineId:'SRC-'+type,item:'M001',qty:2,price,memo:type,custom:{lot:type}}]});
    db=out.db;docs[type]=out.result;
  }
  return {db,docs};
}
const draft=type=>({type,date:'2026-10-22',partner:'V002',warehouse:'W002',employee:'E001',memo:'현재 상단',custom:{keep:'상단'},lines:[{lineId:'OLD',item:'M001',qty:1,price:300,memo:'현재 행',custom:{keep:'행'}}]});
const selections=docs=>docs.map(d=>({documentId:d.id,item:'M001',lineId:d.lines[0].lineId}));
const stage=(db,value,docs,options={})=>E.stageDocuments(db,value,{history:true,mode:'copy',grouping:'line',selections:selections(docs),...options});
function quoted(){
  let {db}=fixture();
  const out=C.command(db,'priceRequestCreate',{document:{type:'pricerequest',date:'2026-10-21',warehouse:'W001',lines:[{lineId:'REQ',item:'M001',qty:10,price:50000}]},vendorCodes:['V001','V002']});
  db=out.db;const source=out.result;
  for(const action of [{action:'reply',vendorCode:'V002',lineKey:'id:REQ',price:'25000'},{action:'select',source:'vendor',vendorCode:'V002',lineKey:'id:REQ'}])db=C.command(db,'priceRequest',{documentId:source.id,expectedRevision:Q.view(db,source.id,C).revision,...action}).db;
  return {db,source};
}
for(const type of targets){
  test(type+' history lists only purchasing records and independently saves copied rows without changing sources, forms or balances',()=>{
    const f=fixture(),before=clone(f.db),value=draft(type),rows=E.documentCandidates(f.db,{history:true,targetType:type,mode:'copy'});
    assert.deepEqual(rows.map(d=>d.type).sort(),['pricerequest','purchase','purchaseorder']);
    assert.throws(()=>E.documentCandidates(f.db,{history:true,targetType:type,sourceType:'quote'}),/거래내역/);
    const out=stage(f.db,value,[f.docs.purchase,f.docs.purchaseorder,f.docs.pricerequest]);
    assert.deepEqual(out.lines.map(l=>[l.qty,l.price]),[[1,300],[2,200],[2,100],[2,90]]);
    assert.deepEqual(out.lines[0],value.lines[0]);
    for(const key of ['partner','date','warehouse','employee','memo','custom'])assert.deepEqual(out[key],value[key]);
    assert.equal(out.sourceId,undefined);assert.equal(new Set(out.lines.map(l=>l.lineId)).size,4);
    const saved=C.command(f.db,'document',out),backup=C.validateBackup(clone(saved.db));
    assert.deepEqual(backup.documents.slice(0,-1),before.documents);assert.deepEqual(backup.settings,before.settings);
    assert.deepEqual(backup.documents.at(-1).lines,saved.result.lines);
    assert.deepEqual(C.remaining(backup,f.docs.purchaseorder,'purchase'),C.remaining(before,f.docs.purchaseorder,'purchase'));
    assert.equal(C.stock(backup,'M001','W001'),C.stock(before,'M001','W001'));
    assert.equal(C.outstanding(backup,'payable','V001'),C.outstanding(before,'payable','V001'));
    assert.deepEqual(f.db,before);
    if(type==='purchaseorder'){
      const receipt=C.command(backup,'convert',{id:saved.result.id,type:'purchase',date:'2026-10-22',quantities:Object.fromEntries(saved.result.lines.map((l,i)=>[l.lineId,i===2?1:0]))}),reloaded=C.validateBackup(clone(receipt.db));
      assert.equal(receipt.result.lines[0].price,100);assert.equal(C.stock(reloaded,'M001','W002'),1);assert.equal(C.outstanding(reloaded,'payable','V002'),110);
      assert.deepEqual(C.remaining(reloaded,saved.result,'purchase').map(l=>l.qty),[1,2,1,2]);assert.deepEqual(C.remaining(reloaded,f.docs.purchaseorder,'purchase'),C.remaining(before,f.docs.purchaseorder,'purchase'));
    }
  });
}
test('history copies the recorded request price while ordinary confirmed-price loading retains its supplier and basis rules',()=>{
  const {db,source}=quoted(),before=clone(db);
  const ordinary=E.documentCandidates(db,{targetType:'purchaseorder',sourceType:'pricerequest',mode:'linked',partner:'V002'}).find(d=>d.id===source.id);
  assert.equal(ordinary.lines[0].price,'25000');assert.equal(ordinary.lines[0].priceRequestBasis.vendorCode,'V002');
  const history=E.documentCandidates(db,{targetType:'purchaseorder',sourceType:'pricerequest',history:true,mode:'copy'}).find(d=>d.id===source.id);
  assert.equal(history.lines[0].price,50000);assert.equal(history.lines[0].priceRequestBasis,undefined);
  assert.ok(!E.documentCandidates(db,{targetType:'purchaseorder',history:true,partner:'V001'}).some(d=>d.id===source.id));
  const out=stage(db,{...draft('purchaseorder'),partner:'V001'},[source]);
  assert.equal(out.partner,'V001');assert.equal(out.lines[1].price,50000);assert.equal(out.lines[1].priceRequestBasis,undefined);
  const saved=C.command(db,'document',out);assert.doesNotThrow(()=>C.validateBackup(clone(saved.db)));
  assert.deepEqual(C.remaining(saved.db,source,'purchaseorder'),C.remaining(db,source,'purchaseorder'));
  assert.deepEqual(db,before);
});
test('confirmed-price metadata is preserved as provenance, never activated on new history copies or used to replace the header',()=>{
  let {db,source}=quoted();
  const linked=E.stageDocuments(db,{type:'purchaseorder',date:'2026-10-21',warehouse:'W001',partner:'V002',lines:[]},{mode:'linked',selections:[{documentId:source.id,item:'M001',lineId:'REQ',qty:2}]});
  const order=C.command(db,'document',linked);db=order.db;const before=clone(db);
  for(const type of [...targets,'purchase']){
    const out=stage(db,{...draft(type),partner:'V001'},[order.result]);
    assert.equal(out.partner,'V001');assert.equal(out.lines[1].price,25000);
    assert.equal(out.lines[1].sourceLineId,undefined);assert.equal(out.lines[1].priceRequestBasis,undefined);
    assert.deepEqual(out.lines[1].importedFrom[0].priceRequestBasisSnapshot,order.result.lines[0].priceRequestBasis);
    const saved=C.command(db,'document',out),backup=C.validateBackup(clone(saved.db));
    assert.deepEqual(backup.documents.at(-1).lines[1].importedFrom[0].priceRequestBasisSnapshot,order.result.lines[0].priceRequestBasis);
    assert.deepEqual(backup.documents.slice(0,-1),before.documents);assert.deepEqual(backup.settings,before.settings);
  }
  assert.deepEqual(db,before);
});
test('history supplier filters and labels follow the saved header even when a valid historical purchase carries another quote vendor basis',()=>{
  let {db,source}=quoted();
  const order=C.command(db,'convert',{id:source.id,type:'purchaseorder',date:'2026-10-21',quantities:{REQ:2}});db=order.db;
  const copied=E.stageDocuments(db,{type:'purchase',date:'2026-10-22',partner:'V001',warehouse:'W001',lines:[]},{mode:'copy',grouping:'line',selections:selections([order.result])});
  const purchase=C.command(db,'document',copied);db=C.validateBackup(clone(purchase.db));const before=clone(db);
  assert.equal(purchase.result.partner,'V001');assert.equal(purchase.result.lines[0].priceRequestBasis.vendorCode,'V002');
  for(const targetType of [...targets,'purchase']){
    const row=E.documentCandidates(db,{history:true,targetType,sourceType:'purchase',partner:'V001'}).find(d=>d.id===purchase.result.id);
    assert.ok(row);assert.equal(row.lines.length,1);assert.equal(row.partnerName,C.master(db,'partners','V001').name);
    assert.equal(row.lines[0].partnerName,undefined);
    assert.ok(!E.documentCandidates(db,{history:true,targetType,sourceType:'purchase',partner:'V002'}).some(d=>d.id===purchase.result.id));
  }
  assert.deepEqual(db,before);
});
test('existing linked orders and legacy downstream allocations reject history edits atomically',()=>{
  const f=fixture(),linked=E.stageDocuments(f.db,{type:'purchaseorder',date:'2026-10-22',warehouse:'W001',partner:'V001',lines:[]},{mode:'linked',selections:selections([f.docs.pricerequest])});
  const before=clone(linked);assert.throws(()=>stage(f.db,linked,[f.docs.purchase]),/연결 처리/);assert.deepEqual(linked,before);
  let old=C.command(f.db,'document',{type:'purchaseorder',date:'2026-10-22',warehouse:'W001',partner:'V001',lines:[{item:'M001',qty:2,price:10}]});
  const next=C.command(old.db,'convert',{id:old.result.id,type:'purchase',quantities:{M001:1}});const raw=clone(next.db);
  assert.throws(()=>stage(next.db,old.result,[f.docs.purchase]),/후속 전표/);assert.deepEqual(next.db,raw);
});
test('a new multi-vendor price request retains its selected recipients through history staging and comparison save/reload',()=>{
  const f=fixture(),out=stage(f.db,{...draft('pricerequest'),partner:'',_priceRequestVendorCodes:['V001','V002']},[f.docs.purchase,f.docs.purchaseorder]);
  assert.deepEqual(out._priceRequestVendorCodes,['V001','V002']);const {_priceRequestVendorCodes,...document}=out;
  const saved=C.command(f.db,'priceRequestCreate',{document,vendorCodes:_priceRequestVendorCodes}),db=C.validateBackup(clone(saved.db));
  const record=db.settings.priceRequests.records.find(r=>r.documentId===saved.result.id);
  assert.deepEqual(record.comparison.vendors.map(v=>v.code),['V001','V002']);assert.deepEqual(record.snapshot,saved.result);
  assert.deepEqual(db.documents.slice(0,-1),f.db.documents);assert.deepEqual(saved.result.lines.map(l=>l.price),[300,200,100]);
});
for(const type of targets){
  test(type+' actual history picker is bounded before and after account, permission, storage or parent changes',()=>{
    const {environment}=require('./helpers/request-env.cjs'),M=require('../dist/menu-core.js'),rows=M.indexMenus(require('../dist/menus.json'));
    for(const kind of ['normal','actor','company','role','raw','read','detached']){
      const f=environment();try{
        for(const file of ['entry-core','entry-ui','entry-tools','entry-extra-core','entry-extra-ui'])f.w.eval(fs.readFileSync('dist/'+file+'.js','utf8'));
        f.w.InventoryUI.beforeNavigate();f.host.replaceChildren();f.w.InventoryUI.render(f.host,rows.find(r=>C.resolve(r)?.kind==='form'&&C.resolve(r)?.docType===type),{rows,open(){},toast(){}});
        const raw=f.w.localStorage.getItem('ecount-inventory-v2'),button=[...f.host.querySelectorAll('button')].find(b=>b.textContent==='거래내역보기('+(type==='pricerequest'?'단가요청':'발주')+')'),state=f.w.AuthUI.state();
        if(kind==='actor')f.w.AuthUI.state=()=>({user:{...state.user,id:'other'}});
        if(kind==='company')f.w.AuthUI.state=()=>({user:{...state.user,company:{code:'OTHER'}}});
        if(kind==='role')f.w.AuthUI.state=()=>({user:{...state.user,roleId:'other'}});
        if(kind==='raw')f.w.localStorage.setItem('ecount-inventory-v2',raw+' ');
        if(kind==='read')f.w.AuthUI.can=p=>p!=='inventory.read';
        if(kind==='detached'){f.w.InventoryUI.beforeNavigate();f.host.replaceChildren();}
        button.click();const picker=f.d.getElementById('entry-helper-dialog');
        if(kind==='normal'){
          assert.ok(picker);assert.equal(picker.getAttribute('aria-label'),'거래내역보기('+(type==='pricerequest'?'단가요청':'발주')+')');
          assert.deepEqual(Array.from(picker.querySelector('[aria-label="원본 전표 종류"]').options,o=>o.value),['','pricerequest','purchaseorder','purchase']);
          assert.equal(picker.querySelector('[aria-label="집계조건"]').disabled,true);
          assert.equal(picker.querySelector('fieldset'),null);
          const apply=[...picker.querySelectorAll('button')].find(b=>b.textContent==='선택 적용(F8)');
          f.w.AuthUI.can=p=>p!=='inventory.read';f.w.dispatchEvent(new f.w.Event('focus'));assert.equal(picker.isConnected,false);apply.click();
        }else assert.equal(picker,null,kind);
        assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),kind==='raw'?raw+' ':raw);
      }finally{f.w.close();}
    }
  });
}
