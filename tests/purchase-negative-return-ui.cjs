'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js');
function fixture(fn){
 const dom=new JSDOM('<button id="trigger">반품처리</button>',{url:'https://erp.test/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 try{
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  for(const file of ['form-core.js','inventory-core.js','purchase-return-core.js','purchase-return-ui.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
  let db=C.empty();db.masters=C.clone(C.seed().masters);const out=C.command(db,'document',{type:'purchase',date:'2026-10-21',partner:'V001',warehouse:'W001',vatRate:10,lines:[{item:'M001',qty:3,price:5}]});db=out.db;
  let owner='company:owner',readonly=false,fail=false,commits=0,closed=0,saved=0,view;
  const trigger=d.getElementById('trigger');trigger.focus();
  const options={sourceId:out.result.id,date:'2026-10-22',getDb:()=>db,identity:()=>owner,readOnly:()=>readonly,onClose:()=>closed++,onSaved:()=>saved++,onCommit:(next,guard)=>{commits++;assert.equal(guard.expectedDb,JSON.stringify(db));assert.equal(guard.identity,owner);if(fail)throw Error('가상 저장소 용량 오류');db=next.db;return true;}};
  const open=extra=>view=w.PurchaseReturnUI.open({...options,...extra}),dialog=()=>d.getElementById('purchase-return-dialog'),button=label=>[...dialog().querySelectorAll('button')].find(b=>b.textContent===label),quantity=value=>{const input=dialog().querySelector('[aria-label="반품 수량 1"]');input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));},error=()=>dialog().querySelector('[role="alert"]').textContent;
  fn({w,d,open,dialog,button,quantity,error,getDb:()=>db,setDb:value=>db=value,owner:value=>owner=value,readonly:value=>readonly=value,fail:value=>fail=value,commits:()=>commits,closed:()=>closed,saved:()=>saved,view:()=>view,trigger});
 }finally{w.close();}
}
test('negative preview, cancel, Escape and navigation destruction keep data unchanged and restore source focus',()=>fixture(f=>{
 const before=JSON.stringify(f.getDb());f.open();f.quantity('-1');assert.match(f.dialog().textContent,/부가세 -0.67/);assert.equal(JSON.stringify(f.getDb()),before);f.button('취소').click();assert.equal(f.dialog(),null);assert.equal(f.d.activeElement,f.trigger);
 f.open();f.dialog().dispatchEvent(new f.w.Event('cancel',{cancelable:true}));assert.equal(f.dialog(),null);f.open();const view=f.view(),oldSave=f.button('저장(F8)');view.destroy();view.destroy();oldSave.click();assert.equal(f.commits(),0);assert.equal(f.closed(),3);assert.equal(JSON.stringify(f.getDb()),before);
}));
test('save persists only one canonical return, reopens it with negative quantity, edits and keeps source metadata',()=>fixture(f=>{
 const original=C.clone(f.getDb().documents[0]);f.open();f.quantity('-1');f.button('저장(F8)').click();assert.equal(f.dialog(),null);assert.equal(f.commits(),1);assert.equal(f.saved(),1);const credit=f.getDb().documents[1];assert.equal(credit.type,'purchasereturn');assert.equal(credit.lines[0].qty,1);
 f.setDb(C.validateBackup(JSON.parse(JSON.stringify(f.getDb()))));f.open({documentId:credit.id});assert.equal(f.dialog().querySelector('[aria-label="반품 수량 1"]').value,'-1');f.quantity('-2');f.dialog().dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'F8',bubbles:true,cancelable:true}));assert.equal(f.getDb().documents.length,2);assert.equal(f.getDb().documents[1].id,credit.id);assert.equal(f.getDb().documents[1].lines[0].returnAmounts.tax,1.33);assert.deepEqual(JSON.parse(JSON.stringify(f.getDb().documents[0])),original);
}));
test('failed persistence retains negative input and allows an explicit retry; duplicate detached events cannot save twice',()=>fixture(f=>{
 const before=JSON.stringify(f.getDb());f.open();f.quantity('-1');f.fail(true);f.button('저장(F8)').click();assert.match(f.error(),/용량/);assert.equal(f.view().read().lines[0].qty,'-1');assert.equal(JSON.stringify(f.getDb()),before);const save=f.button('저장(F8)');f.fail(false);save.click();save.click();assert.equal(f.commits(),2);assert.equal(f.getDb().documents.length,2);
}));
test('account switch, revoked permission and changed source block a late save before the commit callback',()=>fixture(f=>{
 f.open();f.quantity('-1');f.owner('company:other');f.button('저장(F8)').click();assert.match(f.error(),/계정|권한/);assert.equal(f.commits(),0);f.view().destroy();f.owner('company:owner');
 f.open();f.quantity('-1');f.readonly(true);f.button('저장(F8)').click();assert.match(f.error(),/권한/);assert.equal(f.commits(),0);f.view().destroy();f.readonly(false);
 f.open();f.quantity('-1');const changed=C.clone(f.getDb());changed.documents[0].memo='원본 변경';f.setDb(changed);f.button('저장(F8)').click();assert.match(f.error(),/변경/);assert.equal(f.commits(),0);
}));
test('zero/excluded and positive inputs show validation, never persist, and do not display stale monetary rows',()=>fixture(f=>{
 f.open();f.quantity('-1');assert.equal(f.dialog().querySelector('[data-amount="tax"]').textContent,'-0.67');f.quantity('1');assert.match(f.error(),/음수/);assert.equal(f.dialog().querySelector('[data-amount="tax"]').textContent,'—');f.button('저장(F8)').click();assert.equal(f.commits(),0);f.quantity('-1');f.dialog().querySelector('[aria-label="반품 품목 1 제외"]').click();assert.equal(f.view().read().lines[0].qty,0);f.button('저장(F8)').click();assert.match(f.error(),/수량/);assert.equal(f.commits(),0);
}));
test('readonly opening has no writable controls, labels are inert text and failed acknowledgment never silently closes',()=>fixture(f=>{
 const db=C.clone(f.getDb());db.masters.items.find(i=>i.code==='M001').name='<img src=x onerror=alert(1)>';f.setDb(db);f.readonly(true);f.open();assert.equal(f.dialog().querySelector('img'),null);assert.ok(f.dialog().textContent.includes('<img'));assert.equal(f.button('저장(F8)').disabled,true);assert.equal(f.dialog().querySelector('[aria-label="반품 수량 1"]').disabled,true);f.view().destroy();f.readonly(false);
 f.open({onCommit:()=>undefined});f.quantity('-1');f.button('저장(F8)').click();assert.match(f.error(),/완료하지 못/);assert.ok(f.dialog());assert.equal(f.getDb().documents.length,1);
}));
test('uncertain acknowledgment after persistence cannot create a duplicate on retry',()=>fixture(f=>{
 let writes=0;f.open({onCommit:next=>{writes++;f.setDb(next.db);throw Error('가상 응답 유실');}});f.quantity('-1');f.button('저장(F8)').click();assert.match(f.error(),/응답 유실/);assert.equal(f.getDb().documents.length,2);
 f.button('저장(F8)').click();assert.match(f.error(),/변경/);assert.equal(writes,1);assert.equal(f.getDb().documents.length,2);assert.equal(f.view().read().lines[0].qty,'-1');
}));
