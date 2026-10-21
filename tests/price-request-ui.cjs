'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),M=require('../dist/menu-core.js');
const routes=M.indexMenus(require('../dist/menus.json'));
function fixture({archive=true,stale=false}={}){
 let db=C.seed();for(let i=2;i<=5;i++)db=C.command(db,'master',{key:'partners',record:{code:'V00'+i,name:'공급처 '+i,kind:'매입'}}).db;
 let out=C.command(db,'document',{type:'pricerequest',date:C.today(),partner:'V001',warehouse:'W001',status:'진행',lines:[{lineId:'a',item:'M001',qty:100,price:50000},{lineId:'b',item:'M001',qty:2,price:1}]});db=out.db;const id=out.result.id;
 if(archive){db=C.command(db,'priceRequest',{action:'start',documentId:id,vendorCodes:['V001','V002','V003','V004','V005']}).db;for(const [vendorCode,lineKey,price]of [['V001','id:a','0'],['V002','id:a','25000.0123456789'],['V002','id:b','1.9999999999']]){const revision=db.settings.priceRequests.records[0].comparison.revision;db=C.command(db,'priceRequest',{action:'reply',documentId:id,expectedRevision:revision,vendorCode,lineKey,price}).db;}db=C.command(db,'priceRequest',{action:'select',documentId:id,expectedRevision:3,vendorCode:'V002',lineKey:'id:a',source:'vendor'}).db;db=C.command(db,'priceRequest',{action:'close',documentId:id,expectedRevision:4,vendorCode:'V002',closed:true}).db;}
 if(stale)db=C.command(db,'document',{...db.documents.find(d=>d.id===id),memo:'changed later'}).db;
 return {db,id};
}
function env({data=fixture(),read=true,write=false,user='owner',deferredClose=false}={}){
 const dom=new JSDOM('<!doctype html><html><body><button id="origin">open</button><main id="target"></main></body></html>',{url:'https://erp.test/',runScripts:'outside-only'}),w=dom.window,d=w.document,toasts=[];
 const pendingCloses=[];w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;const fire=()=>this.dispatchEvent(new w.Event('close'));if(deferredClose)pendingCloses.push(fire);else fire();};
 let readable=read,writable=write;w.AuthUI={state:()=>({user:{id:user}}),can:p=>p==='inventory.read'?readable:writable,settings:()=>({conveniences:{pageSize:20}})};
 const key='ecount-inventory-v2'+(user==='owner'?'':':'+user);w.localStorage.setItem(key,JSON.stringify(data.db));
 for(const file of ['form-core.js','item-core.js','price-request-core.js','inventory-core.js','form-options.js','price-request-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
 const stored=()=>w.localStorage.getItem(key),db=()=>w.JSON.parse(stored()),button=(text,scope=d)=>{const n=[...scope.querySelectorAll('button')].find(n=>n.textContent===text);assert.ok(n,'missing '+text);return n;};
 const open=()=>w.PriceRequestUI.open({documentId:data.id,canRead:()=>readable,getDb:db});
 const render=kind=>{w.InventoryUI.beforeNavigate();const target=d.getElementById('target');target.replaceChildren();const route=routes.find(r=>r.top===2&&C.resolve(r).docType==='pricerequest'&&C.resolve(r).kind===kind);assert.ok(route);w.InventoryUI.render(target,route,{rows:routes,open:()=>{},toast:m=>toasts.push(m)});};
 return {dom,w,d,key,data,stored,db,button,open,render,toasts,flushCloses:()=>{while(pendingCloses.length)pendingCloses.shift()();},setRead:value=>{readable=value;},setWrite:value=>{writable=value;},dialog:()=>d.getElementById('price-request-dialog')};
}
function close(e){e.dom.window.close();}
test('comparison separates requested, received zero/missing, selected decimal price and five vendors without writes',()=>{
 const e=env(),before=e.stored(),dialog=e.open(),rows=[...dialog.querySelectorAll('tbody tr')];
 assert.equal(dialog.querySelectorAll('th').length,12);assert.equal(rows.length,2);
 assert.deepEqual([...rows[0].children].map(n=>n.textContent),['M001','샘플 원재료','1kg','100','50,000','0','25,000.0123456789','미회신','미회신','미회신','25,000.0123456789','V002']);
 assert.match(dialog.textContent,/입력마감/);assert.match(rows[1].textContent,/1.9999999999/);assert.match(rows[1].textContent,/미확정/);assert.equal(e.stored(),before);assert.equal(dialog.querySelectorAll('input,select,textarea').length,0);close(e);
});
test('legacy voucher shows request prices only and never initializes a companion store',()=>{
 const e=env({data:fixture({archive:false})}),before=e.stored(),dialog=e.open();assert.match(dialog.textContent,/요청단가만/);assert.equal(dialog.querySelectorAll('th').length,7);assert.equal(e.stored(),before);assert.equal(Object.hasOwn(e.db().settings,'priceRequests'),false);close(e);
});
test('source changed, cancelled, missing and disabled vendor are explicitly historical while preserving quoted amounts',()=>{
 for(const mode of ['changed','cancelled','missing','disabled']){
  const data=fixture();if(mode==='changed')data.db.documents.find(d=>d.id===data.id).memo='later';if(mode==='cancelled')data.db.documents.find(d=>d.id===data.id).status='취소';if(mode==='missing')data.db.documents=data.db.documents.filter(d=>d.id!==data.id);if(mode==='disabled')data.db.masters.partners.find(p=>p.code==='V002').disabled=true;
  const e=env({data}),before=e.stored(),dialog=e.open();assert.match(dialog.querySelector('[role="status"]').textContent,/보관 당시/);assert.match(dialog.textContent,/25,000.0123456789/);assert.equal(e.stored(),before);close(e);
 }
});
test('query-only user opens actual list and workflow comparison action with existing edit actions preserved for writer',()=>{
 for(const kind of ['list','workflow']){const e=env(),before=e.stored();e.render(kind);assert.ok(e.button('신규(F2)').disabled);e.button('단가요청비교현황').click();assert.ok(e.dialog().open);assert.equal(e.stored(),before);e.button('닫기',e.dialog()).click();assert.equal(e.dialog(),null);close(e);}
 const e=env({write:true});e.render('list');assert.equal(e.button('신규(F2)').disabled,false);assert.ok(e.button('인쇄'));assert.ok(e.button('발주서 생성'));assert.ok(e.button('취소'));close(e);
});
test('read denial prevents opening and removes any old view when access changes',()=>{
 const e=env({read:false});assert.throws(()=>e.open(),/권한/);assert.equal(e.dialog(),null);e.setRead(true);e.open();e.setRead(false);assert.throws(()=>e.open(),/권한/);assert.equal(e.dialog(),null);close(e);
});
test('permission revoked while viewing clears sensitive content on refresh and focus',()=>{
 for(const via of ['refresh','focus']){const e=env(),dialog=e.open(),before=e.stored();e.setRead(false);if(via==='refresh')e.button('새로고침',dialog).click();else e.w.dispatchEvent(new e.w.Event('focus'));assert.match(dialog.querySelector('[role="alert"]').textContent,/권한/);assert.equal(dialog.querySelector('table'),null);assert.equal(e.stored(),before);close(e);}
});
test('different-tab storage change clears a stale InventoryUI comparison and never overwrites new data',()=>{
 const e=env();e.render('list');e.button('단가요청비교현황').click();const changed=e.db();changed.documents.find(d=>d.id===e.data.id).memo='another tab';const newer=JSON.stringify(changed);e.w.localStorage.setItem(e.key,newer);e.w.dispatchEvent(new e.w.StorageEvent('storage',{key:e.key}));assert.equal(e.dialog().querySelector('table'),null);assert.match(e.dialog().textContent,/다른 화면/);e.button('새로고침',e.dialog()).click();assert.equal(e.stored(),newer);close(e);
});
test('close, Escape, replacement and menu navigation remove dialog and return focus without writes',()=>{
 const e=env(),before=e.stored(),origin=e.d.getElementById('origin');origin.focus();const first=e.open();e.button('닫기',first).click();assert.equal(e.d.activeElement,origin);const second=e.open();second.dispatchEvent(new e.w.Event('cancel',{cancelable:true}));assert.equal(e.dialog(),null);
 const old=e.open();e.open();assert.equal(old.isConnected,false);assert.equal(e.d.querySelectorAll('#price-request-dialog').length,1);e.w.InventoryUI.beforeNavigate();assert.equal(e.dialog(),null);e.w.dispatchEvent(new e.w.Event('storage'));assert.equal(e.stored(),before);close(e);
});
test('HTML-looking item and vendor names are displayed as text, never as markup',()=>{
 const data=fixture();data.db.masters.items.find(i=>i.code==='M001').name='<img src=x onerror=alert(1)>';data.db.masters.partners.find(p=>p.code==='V002').name='<script>bad()</script>';
 const e=env({data}),dialog=e.open();assert.equal(dialog.querySelectorAll('script,img').length,0);assert.match(dialog.textContent,/<img/);assert.match(dialog.textContent,/<script>/);close(e);
});
test('user-specific local storage is read and other user data is not changed',()=>{
 const e=env({user:'viewer'});e.w.localStorage.setItem('ecount-inventory-v2','owner-data');e.render('list');e.button('단가요청비교현황').click();assert.match(e.dialog().textContent,/25,000.0123456789/);assert.equal(e.w.localStorage.getItem('ecount-inventory-v2'),'owner-data');close(e);
});

test('switching logged-in identity cannot read the previous account comparison',()=>{
 const e=env();e.render('list');e.button('단가요청비교현황').click();e.w.AuthUI.state=()=>({user:{id:'another-user'}});e.button('새로고침',e.dialog()).click();assert.match(e.dialog().textContent,/권한/);assert.equal(e.dialog().querySelector('table'),null);e.button('닫기',e.dialog()).click();e.button('단가요청비교현황').click();assert.equal(e.dialog(),null);assert.match(e.toasts.at(-1),/권한/);close(e);
});

test('deferred native close cannot retain replacement dialog or steal focus after menu navigation',()=>{
 const e=env({deferredClose:true}),before=e.stored(),origin=e.d.getElementById('origin');origin.focus();const old=e.open(),current=e.open();assert.equal(old.isConnected,false);assert.equal(e.d.querySelectorAll('#price-request-dialog').length,1);const currentFocus=e.d.activeElement;e.flushCloses();assert.equal(e.d.activeElement,currentFocus);assert.ok(current.open);e.open();e.w.InventoryUI.beforeNavigate();assert.equal(e.dialog(),null);e.flushCloses();assert.equal(e.dialog(),null);assert.equal(e.d.activeElement,origin);assert.equal(e.stored(),before);close(e);
});


const selectRadio=(e,label)=>{const radio=e.dialog().querySelector('input[aria-label="'+label+'"]');assert.ok(radio,label);radio.click();return radio;};
const editable=()=>{const e=env({write:true});e.render('list');e.button('단가요청비교현황').click();e.button('확정단가선택/수정',e.dialog()).click();return e;};
test('actual list adapter saves multiple explicit selections atomically and preserves source, forms and replies',()=>{
 const e=editable(),before=e.db(),raw=e.stored();assert.equal(e.dialog().querySelectorAll('input:checked').length,1);assert.ok(e.button('단가확정/저장(F8)',e.dialog()).disabled);
 selectRadio(e,'1행 V001 수취단가 선택');selectRadio(e,'2행 V002 수취단가 선택');assert.equal(e.stored(),raw);
 e.w.dispatchEvent(new e.w.Event('focus'));assert.equal(e.dialog().querySelectorAll('input:checked').length,2);assert.equal(e.stored(),raw);
 e.button('단가확정/저장(F8)',e.dialog()).click();const db=e.db(),state=db.settings.priceRequests.records[0].comparison;
 assert.equal(state.revision,6);assert.deepEqual(Array.from(state.selections,x=>x.price),['0','1.9999999999']);assert.equal(db.sequence,before.sequence+1);assert.equal(db.logs.length,before.logs.length+1);
 for(const key of ['documents','prices','masters'])assert.equal(JSON.stringify(db[key]),JSON.stringify(before[key]));assert.equal(JSON.stringify(db.settings.customization),JSON.stringify(before.settings.customization));assert.equal(JSON.stringify(state.vendors),JSON.stringify(before.settings.priceRequests.records[0].comparison.vendors));assert.equal(e.dialog().querySelectorAll('input').length,0);assert.match(e.toasts.at(-1),/저장/);close(e);
});
test('missing reply cannot be selected, valid zero remains selectable and closing or Escape does not save',()=>{
 for(const via of ['close','cancel']){const e=editable(),before=e.stored();assert.ok(e.dialog().querySelector('input[aria-label="1행 V003 수취단가 선택"]').disabled);selectRadio(e,'1행 V001 수취단가 선택');if(via==='close')e.button('닫기',e.dialog()).click();else e.dialog().dispatchEvent(new e.w.Event('cancel',{cancelable:true}));assert.equal(e.stored(),before);assert.equal(e.dialog(),null);close(e);}
});
test('plain F8 saves explicit request choice but modified keys and repeats do not',()=>{
 const e=editable(),before=e.stored();selectRadio(e,'1행 요청단가 선택');
 for(const extra of [{ctrlKey:true},{shiftKey:true},{repeat:true},{isComposing:true}])e.dialog().dispatchEvent(new e.w.KeyboardEvent('keydown',{key:'F8',bubbles:true,cancelable:true,...extra}));assert.equal(e.stored(),before);
 e.dialog().dispatchEvent(new e.w.KeyboardEvent('keydown',{key:'F8',bubbles:true,cancelable:true}));assert.equal(e.db().settings.priceRequests.records[0].comparison.selections[0].price,'50000');assert.equal(e.db().settings.priceRequests.records[0].comparison.revision,6);close(e);
});
test('write revocation, identity switch and different-tab changes reject save at action time',()=>{
 for(const mode of ['write','identity','storage']){const e=editable();selectRadio(e,'1행 요청단가 선택');if(mode==='write')e.setWrite(false);if(mode==='identity')e.w.AuthUI.state=()=>({user:{id:'another'}});if(mode==='storage'){const db=e.db();db.settings.allowNegative=!db.settings.allowNegative;e.w.localStorage.setItem(e.key,JSON.stringify(db));}const before=e.stored();e.button('단가확정/저장(F8)',e.dialog()).click();assert.equal(e.stored(),before);assert.match(e.dialog().querySelector('[role="alert"]').textContent,/권한|다른 화면/);if(mode==='identity')assert.equal(e.dialog().querySelector('table'),null);close(e);}
});
test('quota failure retains draft and supports one successful retry without duplicate mutations',()=>{
 const e=editable(),before=e.stored();selectRadio(e,'1행 요청단가 선택');const set=e.w.Storage.prototype.setItem;e.w.Storage.prototype.setItem=()=>{throw Error('quota full');};e.button('단가확정/저장(F8)',e.dialog()).click();assert.equal(e.stored(),before);assert.match(e.dialog().textContent,/quota full/);assert.ok(e.dialog().querySelector('input[aria-label="1행 요청단가 선택"]').checked);e.w.Storage.prototype.setItem=set;e.button('단가확정/저장(F8)',e.dialog()).click();assert.equal(e.db().settings.priceRequests.records[0].comparison.revision,6);close(e);
});
test('history and unstarted requests never expose editing; read revocation clears active draft',()=>{
 for(const data of [fixture({stale:true}),fixture({archive:false})]){const e=env({data,write:true});e.render('list');e.button('단가요청비교현황').click();assert.ok(e.button('확정단가선택/수정',e.dialog()).hidden);assert.ok(e.button('단가확정/저장(F8)',e.dialog()).hidden);close(e);}
 const e=editable(),before=e.stored();selectRadio(e,'1행 요청단가 선택');e.setRead(false);e.w.dispatchEvent(new e.w.Event('focus'));assert.equal(e.dialog().querySelector('table'),null);assert.equal(e.dialog().querySelectorAll('input').length,0);assert.equal(e.stored(),before);close(e);
});

test('temporarily revoked write permission recovers preserved draft only when source remains unchanged',()=>{
 const e=editable(),before=e.stored();selectRadio(e,'1행 요청단가 선택');e.setWrite(false);e.w.dispatchEvent(new e.w.Event('focus'));assert.ok(e.button('단가확정/저장(F8)',e.dialog()).disabled);assert.match(e.dialog().querySelector('[role="alert"]').textContent,/권한/);assert.equal(e.stored(),before);
 e.setWrite(true);e.w.dispatchEvent(new e.w.Event('focus'));assert.equal(e.button('단가확정/저장(F8)',e.dialog()).disabled,false);assert.ok(e.dialog().querySelector('input[aria-label="1행 요청단가 선택"]').checked);e.button('단가확정/저장(F8)',e.dialog()).click();assert.equal(e.db().settings.priceRequests.records[0].comparison.revision,6);close(e);
});

const closable=()=>{const e=env({write:true});e.render('list');e.button('단가요청비교현황').click();return e;};
const closing=(e,code)=>{const el=e.dialog().querySelector('[data-vendor-close="'+code+'"]');assert.ok(el,'vendor close '+code);return el;};
test('vendor close and reopen commit once without changing any price, selection or other vendor',()=>{
 const e=closable(),before=e.db(),old=before.settings.priceRequests.records[0].comparison,button=closing(e,'V001');assert.equal(button.textContent,'입력마감');button.click();const after=e.db(),state=after.settings.priceRequests.records[0].comparison;
 assert.equal(state.revision,old.revision+1);assert.equal(state.vendors[0].inputClosed,true);assert.equal(JSON.stringify(state.selections),JSON.stringify(old.selections));assert.equal(JSON.stringify(state.vendors[0].received),JSON.stringify(old.vendors[0].received));assert.equal(JSON.stringify(state.vendors.slice(1)),JSON.stringify(old.vendors.slice(1)));assert.equal(after.sequence,before.sequence+1);assert.equal(after.logs.length,before.logs.length+1);
 for(const key of ['documents','prices','masters'])assert.equal(JSON.stringify(after[key]),JSON.stringify(before[key]));assert.equal(JSON.stringify(after.settings.customization),JSON.stringify(before.settings.customization));assert.equal(closing(e,'V001').textContent,'입력마감취소');assert.equal(e.d.activeElement,closing(e,'V001'));
 assert.throws(()=>C.command(JSON.parse(JSON.stringify(after)),'priceRequest',{action:'reply',documentId:e.data.id,expectedRevision:6,vendorCode:'V001',lineKey:'id:b',price:7}),/마감/);
 closing(e,'V001').click();const reopened=e.db(),last=reopened.settings.priceRequests.records[0].comparison;assert.equal(last.revision,7);assert.equal(last.vendors[0].inputClosed,false);assert.equal(JSON.stringify(last.vendors),JSON.stringify(old.vendors));assert.equal(JSON.stringify(last.selections),JSON.stringify(old.selections));assert.doesNotThrow(()=>C.command(JSON.parse(JSON.stringify(reopened)),'priceRequest',{action:'reply',documentId:e.data.id,expectedRevision:7,vendorCode:'V001',lineKey:'id:b',price:7}));close(e);
});
test('closing an already selected supplier retains confirmed price and empty replies remain absent',()=>{
 const e=closable(),before=e.db().settings.priceRequests.records[0].comparison;assert.equal(closing(e,'V002').textContent,'입력마감취소');closing(e,'V002').click();closing(e,'V002').click();const next=e.db().settings.priceRequests.records[0].comparison;assert.equal(JSON.stringify(next.selections),JSON.stringify(before.selections));assert.equal(JSON.stringify(next.vendors),JSON.stringify(before.vendors));closing(e,'V003').click();assert.ok(e.db().settings.priceRequests.records[0].comparison.vendors[2].received.every(r=>r.price===null));close(e);
});
test('close actions are absent for read-only, unstarted and historical comparison views',()=>{
 for(const config of [{write:false},{write:true,data:fixture({archive:false})},{write:true,data:fixture({stale:true})}]){const e=env(config),before=e.stored();e.render('list');e.button('단가요청비교현황').click();assert.equal(e.dialog().querySelectorAll('[data-vendor-close]').length,0);assert.equal(e.stored(),before);close(e);}
});
test('active price selection hides closing controls and preserves unsaved selections',()=>{
 const e=closable(),obsolete=closing(e,'V001'),before=e.stored();e.button('확정단가선택/수정').click();selectRadio(e,'1행 V001 수취단가 선택');assert.equal(e.dialog().querySelectorAll('[data-vendor-close]').length,0);obsolete.click();assert.equal(e.stored(),before);assert.ok(e.dialog().querySelector('input[aria-label="1행 V001 수취단가 선택"]').checked);close(e);
});
test('close action rechecks permission identity storage and source state at click time',()=>{
 for(const mode of ['permission','identity','storage','source','vendor','revision']){const e=closable(),button=closing(e,'V001');
  if(mode==='permission')e.setWrite(false);if(mode==='identity')e.w.AuthUI.state=()=>({user:{id:'other'}});
  if(['storage','source','vendor','revision'].includes(mode)){const db=e.db();if(mode==='storage')db.settings.allowNegative=!db.settings.allowNegative;if(mode==='source')db.documents.find(d=>d.id===e.data.id).memo='new';if(mode==='vendor')db.masters.partners.find(v=>v.code==='V001').disabled=true;if(mode==='revision')db.settings.priceRequests.records[0].comparison.revision++;e.w.localStorage.setItem(e.key,JSON.stringify(db));}
  const before=e.stored();button.click();assert.equal(e.stored(),before,mode);assert.match(e.dialog().querySelector('[role="alert"]').textContent,/권한|다른 화면|변경/,mode);close(e);
 }
});
test('quota failure keeps close state and retry changes it exactly once',()=>{
 const e=closable(),before=e.stored(),set=e.w.Storage.prototype.setItem;e.w.Storage.prototype.setItem=()=>{throw Error('quota full');};closing(e,'V001').click();assert.equal(e.stored(),before);assert.equal(closing(e,'V001').textContent,'입력마감');assert.match(e.dialog().querySelector('[role="alert"]').textContent,/quota full/);e.w.Storage.prototype.setItem=set;closing(e,'V001').click();assert.equal(e.db().settings.priceRequests.records[0].comparison.revision,6);assert.equal(closing(e,'V001').textContent,'입력마감취소');close(e);
});
test('detached or dismissed close controls cannot commit duplicate or late state changes',()=>{
 const e=closable(),old=closing(e,'V001');old.click();const saved=e.stored();old.click();assert.equal(e.stored(),saved);const current=closing(e,'V001');e.button('닫기').click();current.click();assert.equal(e.stored(),saved);close(e);
});
test('close permission disappears on focus and restores only when still authorized',()=>{
 const e=closable(),before=e.stored();e.setWrite(false);e.w.dispatchEvent(new e.w.Event('focus'));assert.equal(e.dialog().querySelectorAll('[data-vendor-close]').length,0);e.setWrite(true);e.w.dispatchEvent(new e.w.Event('focus'));assert.equal(e.dialog().querySelectorAll('[data-vendor-close]').length,5);assert.equal(e.stored(),before);close(e);
});
