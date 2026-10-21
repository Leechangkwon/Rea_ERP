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
 let readable=read;w.AuthUI={state:()=>({user:{id:user}}),can:p=>p==='inventory.read'?readable:write,settings:()=>({conveniences:{pageSize:20}})};
 const key='ecount-inventory-v2'+(user==='owner'?'':':'+user);w.localStorage.setItem(key,JSON.stringify(data.db));
 for(const file of ['form-core.js','item-core.js','price-request-core.js','inventory-core.js','form-options.js','price-request-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
 const stored=()=>w.localStorage.getItem(key),db=()=>w.JSON.parse(stored()),button=(text,scope=d)=>{const n=[...scope.querySelectorAll('button')].find(n=>n.textContent===text);assert.ok(n,'missing '+text);return n;};
 const open=()=>w.PriceRequestUI.open({documentId:data.id,canRead:()=>readable,getDb:db});
 const render=kind=>{w.InventoryUI.beforeNavigate();const target=d.getElementById('target');target.replaceChildren();const route=routes.find(r=>r.top===2&&C.resolve(r).docType==='pricerequest'&&C.resolve(r).kind===kind);assert.ok(route);w.InventoryUI.render(target,route,{rows:routes,open:()=>{},toast:m=>toasts.push(m)});};
 return {dom,w,d,key,data,stored,db,button,open,render,toasts,flushCloses:()=>{while(pendingCloses.length)pendingCloses.shift()();},setRead:value=>{readable=value;},dialog:()=>d.getElementById('price-request-dialog')};
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
