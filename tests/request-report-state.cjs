'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),M=require('../dist/menu-core.js');
function fixture(fn,{linked=true}={}){
 const dom=new JSDOM('<main id="target"></main>',{url:'https://erp.test/',runScripts:'outside-only'}),w=dom.window,d=w.document,host=d.getElementById('target'),rows=M.indexMenus(require('../dist/menus.json'));
 let actor='owner',company='SYNTH',role='admin',read=true,write=true,quota=false;
 try{
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;
  w.AuthUI={state:()=>({user:{id:actor,roleId:role,company:{code:company}}}),can:p=>p==='inventory.read'?read:p==='inventory.write'?write:true,settings:()=>({conveniences:{pageSize:20}})};
  let db=C.empty();db.masters=C.clone(C.seed().masters);db=C.command(db,'document',{type:'request',date:'2026-10-21',warehouse:'W001',partner:'V001',lines:[{lineId:'REQ',item:'M001',qty:5,price:100,memo:'보존'}]}).db;const id=db.documents[0].id;
  if(linked)db=C.command(db,'convert',{id,type:'plan',date:'2026-10-21',quantities:{REQ:2}}).db;
  w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(quota&&k==='ecount-inventory-v2')throw Error('QuotaExceededError');return set.call(this,k,v);};
  for(const file of ['form-core.js','inventory-core.js','form-options.js','reference-picker-ui.js','purchasing-report-core.js','purchasing-report-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
  const show=(name='발주요청현황')=>{w.InventoryUI.beforeNavigate();host.replaceChildren();w.InventoryUI.render(host,rows.find(r=>r.name===name&&!r.branch),{rows,open:()=>{},toast:()=>{}});};
  const control=label=>{const x=d.querySelector('[aria-label="'+label+'"]');assert.ok(x,label);return x;},click=(label,scope=d)=>{const x=[...scope.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(x,label);x.click();return x;},change=(label,value)=>{const x=control(label);if(x.type==='checkbox'||x.type==='radio')x.checked=value;else x.value=value;x.dispatchEvent(new w.Event('change',{bubbles:true}));},raw=()=>w.localStorage.getItem('ecount-inventory-v2'),stored=()=>JSON.parse(raw());
  const query=()=>{change('조회 시작일','2026-10-01');change('조회 종료일','2026-10-31');click('검색(F8)');},status=()=>host.querySelector('[data-label="진행상태"] button'),open=()=>{assert.ok(status());status().click();const x=d.querySelector('dialog[open]');assert.ok(x);return x;},apply=value=>{change('변경할 진행상태',value);click('상태 변경 적용');};
  show();query();fn({w,d,host,id,show,control,click,change,raw,stored,query,status,open,apply,set:values=>{({actor=actor,company=company,role=role,read=read,write=write,quota=quota}=values);}});
 }finally{w.close();}
}
test('request report cancel and complete/reopen use the saved state, preserving lines, child links, balances and settings',()=>fixture(f=>{
 const before=f.stored(),raw=f.raw();let dialog=f.open();assert.ok(f.status().classList.contains('inv-status-badge'));f.change('변경할 진행상태','완료');f.click('닫기',dialog);assert.equal(f.raw(),raw);
 f.open();f.apply('완료');assert.equal(f.d.querySelector('dialog[open]'),null);let after=f.stored();assert.equal(after.documents[0].progress,'완료');assert.equal(f.status().textContent,'완료');assert.deepEqual(after.documents[0].lines,before.documents[0].lines);assert.deepEqual(after.documents[1],before.documents[1]);assert.deepEqual(after.settings,before.settings);assert.deepEqual(C.remaining(after,after.documents[0],'plan'),C.remaining(before,before.documents[0],'plan'));
 f.show('발주요청조회');assert.match(f.host.textContent,/완료/);f.show();f.query();assert.equal(f.status().textContent,'완료');f.open();f.apply('미확인');after=f.stored();assert.equal(after.documents[0].confirmation,'확인');assert.equal(after.documents[0].progress,'완료');assert.ok(f.d.querySelector('dialog[open] [role="alert"]').textContent);f.apply('진행');assert.equal(f.stored().documents[0].confirmation,'확인');assert.equal(f.stored().documents[0].progress,'진행');assert.equal(f.status().textContent,'진행중');
}));
test('successful state change refreshes applied data while preserving invalid pending F3 values, quick text and scroll',()=>fixture(f=>{
 f.click('Search(F3)');f.change('조회 시작일','2026-11-01');f.control('발주요청현황 빠른검색').value='미적용';f.host.querySelector('.inv-table-wrap').scrollLeft=61;f.open();f.apply('완료');assert.equal(f.control('조회 시작일').value,'2026-11-01');assert.equal(f.control('발주요청현황 빠른검색').value,'미적용');assert.equal(f.host.querySelector('form.inv-filters').hidden,false);assert.equal(f.host.querySelector('.inv-table-wrap').scrollLeft,61);assert.equal(f.status().textContent,'완료');assert.match(f.host.querySelector('caption').textContent,/2026-10-01/);
}));
test('a fresh query closes the previous state dialog and rejects retained buttons',()=>fixture(f=>{
 const raw=f.raw(),old=f.status(),dialog=f.open(),held=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='상태 변경 적용');f.change('변경할 진행상태','완료');f.query();assert.equal(dialog.isConnected,false);held.click();old.click();assert.equal(f.raw(),raw);assert.equal(f.d.querySelector('dialog[open]'),null);
}));
test('navigation destroys the owning dialog and its retained apply cannot change a request',()=>fixture(f=>{
 const raw=f.raw(),dialog=f.open(),held=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='상태 변경 적용');f.change('변경할 진행상태','완료');f.show('발주요청조회');held.click();assert.equal(dialog.isConnected,false);assert.equal(f.raw(),raw);
}));
test('identity, company, role, read or write withdrawal rejects a delayed apply and focus closes stale dialogs',()=>{
 for(const values of [{actor:'other'},{company:'OTHER'},{role:'viewer'},{read:false},{write:false}])fixture(f=>{const raw=f.raw(),dialog=f.open();f.change('변경할 진행상태','완료');f.set(values);f.click('상태 변경 적용',dialog);assert.equal(f.raw(),raw);f.w.dispatchEvent(new f.w.Event('focus'));assert.equal(dialog.isConnected,false);});
});
test('external storage changes are preserved and prevent delayed state writes',()=>fixture(f=>{
 const dialog=f.open();f.change('변경할 진행상태','완료');const changed=f.stored();changed.documents[0].reference='외부 변경';const raw=JSON.stringify(changed);f.w.localStorage.setItem('ecount-inventory-v2',raw);f.click('상태 변경 적용',dialog);assert.equal(f.raw(),raw);f.w.dispatchEvent(new f.w.Event('storage'));assert.equal(dialog.isConnected,false);
}));
test('quota failures keep the request and child bytes and retain the explicit pending state',()=>fixture(f=>{
 const raw=f.raw(),dialog=f.open();f.change('변경할 진행상태','완료');f.set({quota:true});f.click('상태 변경 적용',dialog);assert.equal(f.raw(),raw);assert.equal(dialog.open,true);assert.equal(f.control('변경할 진행상태').value,'완료');assert.ok(dialog.querySelector('[role="alert"]').textContent);f.set({quota:false});f.click('상태 변경 적용',dialog);assert.equal(f.stored().documents[0].progress,'완료');
}));
test('read-only requests are disabled and other document reports retain non-editable state cells',()=>fixture(f=>{
 const raw=f.raw();f.set({write:false});f.show();f.query();assert.equal(f.status().disabled,true);f.status().click();assert.equal(f.d.querySelector('dialog[open]'),null);f.show('발주계획현황');f.query();assert.equal(f.host.querySelector('[data-label="진행상태"] button'),null);assert.equal(f.raw(),raw);
}));

test('an unlinked request retains latent completion when marked unconfirmed and can be confirmed in progress again',()=>fixture(f=>{f.open();f.apply('완료');f.open();f.apply('미확인');assert.equal(f.stored().documents[0].confirmation,'미확인');assert.equal(f.stored().documents[0].progress,'완료');f.open();f.apply('진행');assert.equal(f.stored().documents[0].confirmation,'확인');assert.equal(f.stored().documents[0].progress,'진행');},{linked:false}));
