const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const C=require('../dist/inventory-core.js'),V=require('../dist/transaction-vat-core.js'),M=require('../dist/menu-core.js'),F=require('../dist/form-core.js');
const routes=M.indexMenus(require('../dist/menus.json'));
function fixture({type='request',formula=false}={}){
 let db=C.seed();if(formula)db=C.command(db,'formSave',{key:'doc:'+type,context:'lines',form:{id:'vat-synthetic',name:'기존 양식',fields:[F.field('tax','부가세','number'),F.field('x_vat','세액 확인','number',{custom:true,formula:'tax'})],page:{...F.pageDefaults}}}).db;
 const value={type,date:C.today(),warehouse:'W001',partner:'V001',vatRate:10,currency:'KRW',vatCalculation:'transaction',supplyRounding:{method:'round',digits:0},lines:[1,2,3].map(n=>({item:'M001',lineId:'L'+n,qty:5,price:909.09,discount:0}))};value.vatConfirmation=V.confirmation(value);const out=C.command(db,'document',value);db=out.db;
 const dom=new JSDOM('<!doctype html><html><body><section id="target"></section></body></html>',{url:'http://127.0.0.1/',runScripts:'outside-only'}),w=dom.window,d=w.document,toasts=[];let allowed=true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.print=()=>{};w.AuthUI={state:()=>({user:{id:'owner'}}),can:()=>allowed,settings:()=>({})};w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));
 for(const file of ['form-core','inventory-core','transaction-vat-core','transaction-vat-ui','form-options','reference-picker-ui','inventory-ui'])w.eval(fs.readFileSync('dist/'+file+'.js','utf8'));
 const host=d.getElementById('target'),context={rows:routes,toast:t=>toasts.push(t),open:id=>render(id)};
 function render(id){w.InventoryUI.beforeNavigate();host.replaceChildren();w.InventoryUI.render(host,routes.find(x=>x.id===id),context);}
 const click=(name,root=d)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent===name);assert.ok(b,'Missing '+name);b.click();};
 const control=label=>{const x=[...d.querySelectorAll('[aria-label]')].find(x=>x.getAttribute('aria-label')===label);assert.ok(x,'Missing '+label);return x;};
 const change=(label,value)=>{const x=control(label);x.value=value;x.dispatchEvent(new w.Event('input',{bubbles:true}));x.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const stored=()=>JSON.parse(w.localStorage.getItem('ecount-inventory-v2')),doc=()=>stored().documents.find(x=>x.id===out.result.id),review=()=>d.getElementById('transaction-vat-review');
 render({request:'2-2-0-0',plan:'2-2-1-0',purchaseorder:'2-2-3-0',purchase:'2-2-4-0'}[type]);const open=()=>{const b=[...d.querySelectorAll('button')].find(x=>x.textContent.includes(out.result.id));assert.ok(b,'Open document '+out.result.id);b.click();};open();
 return {w,d,db,doc,stored,open,render,click,change,control,review,toasts,revoke:()=>allowed=false,close:()=>dom.window.close()};
}
test('saved adjusted entry renders final row and totals while old records and forms remain unchanged',()=>{
 const f=fixture({formula:true});try{assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,1);assert.match(f.d.querySelector('.vat-adjusted-row [data-form-field="tax"]').textContent,/454/);assert.match(f.d.querySelector('.inv-totals').textContent,/13,636.*1,364.*15,000/);assert.equal(f.control('세액 확인 3').value,'454');assert.deepEqual(f.stored(),f.db);}finally{f.close();}
});
test('changed input removes applied shading; save stages confirmation and cancel preserves stored data and draft',()=>{
 const f=fixture();try{f.change('단가 1','919.09');assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,0);f.click('저장(F8)');assert.ok(f.review()?.open);assert.match(f.review().textContent,/마지막 품목행/);assert.deepEqual(f.stored(),f.db);f.click('취소',f.review());assert.equal(f.review(),null);assert.equal(f.control('단가 1').value,'919.09');assert.deepEqual(f.stored(),f.db);}finally{f.close();}
});
test('confirmed save-retain persists adjustment exactly once and reopens with final shading and no temporary evidence',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장/내용유지');const pending=f.review();assert.ok(pending);f.click('확인',pending);assert.equal(f.review(),null);assert.equal(f.doc().lines[0].price,919.09);assert.equal(f.doc().vatConfirmation,undefined);assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,1);assert.deepEqual(f.stored().settings,f.db.settings);assert.deepEqual(f.stored().documents.filter(x=>x.id!==f.doc().id),f.db.documents.filter(x=>x.id!==f.doc().id));const once=JSON.stringify(f.stored());pending.querySelector('.primary').click();assert.equal(JSON.stringify(f.stored()),once);}finally{f.close();}
});
test('same-amount memo edits keep the prior adjustment without redundant confirmation',()=>{
 const f=fixture();try{f.change('전표 적요','변경 적요');f.click('저장/내용유지');assert.equal(f.review(),null);assert.equal(f.doc().memo,'변경 적요');assert.deepEqual(f.doc().vatAdjustment,f.db.documents.at(-1).vatAdjustment);assert.equal(f.doc().lines[2].tax,454);}finally{f.close();}
});
test('revoked write permission at confirmation blocks storage and keeps the draft',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장(F8)');f.revoke();f.click('확인',f.review());assert.match(f.review().querySelector('[role=alert]').textContent,/권한/);assert.deepEqual(f.stored(),f.db);assert.equal(f.control('단가 1').value,'919.09');}finally{f.close();}
});
test('input changed after review cannot reuse the previous confirmation',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장(F8)');f.change('수량 2','6');f.click('확인',f.review());assert.match(f.review().querySelector('[role=alert]').textContent,/입력 내용/);assert.deepEqual(f.stored(),f.db);}finally{f.close();}
});
test('Escape cancels only the VAT review and F8 cannot bypass the explicit confirmation button',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장(F8)');const dialog=f.review();dialog.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'F8',bubbles:true,cancelable:true}));assert.deepEqual(f.stored(),f.db);assert.equal(f.d.querySelectorAll('#transaction-vat-review').length,1);dialog.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.review(),null);assert.ok(f.control('단가 1'));assert.deepEqual(f.stored(),f.db);}finally{f.close();}
});
test('foreign currency fails without persisting baseline amounts or old shading',()=>{
 const f=fixture();try{f.change('통화','USD');assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,0);f.click('저장(F8)');assert.equal(f.review(),null);assert.deepEqual(f.stored(),f.db);assert.match(f.toasts.at(-1),/외화/);}finally{f.close();}
});
test('review preparation cannot mutate input, persisted adjustments, or old records',()=>{
 const f=fixture();try{const old=f.doc(),draft=C.clone(old);draft.lines[0].price=919.09;const before=JSON.stringify({old,draft}),review=V.review(draft,old);assert.equal(review.required,true);assert.equal(JSON.stringify({old,draft}),before);assert.equal(review.candidate.vatConfirmation,undefined);assert.equal(V.review(old,old).required,false);}finally{f.close();}
});

test('another tab storage change after review cannot be overwritten by the old editor',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장(F8)');const remote=C.clone(f.db);remote.documents.at(-1).memo='다른 탭 수정';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(remote));f.click('확인',f.review());assert.match(f.review().querySelector('[role=alert]').textContent,/다른 화면/);assert.deepEqual(f.stored(),remote);assert.equal(f.control('단가 1').value,'919.09');}finally{f.close();}
});
test('navigation disposes pending review without saving or discarding the input draft',()=>{
 const f=fixture();try{f.change('단가 1','919.09');f.click('저장(F8)');const pending=f.review();f.render('2-0-4');assert.equal(f.review(),null);pending.querySelector('.primary').click();assert.deepEqual(f.stored(),f.db);f.render('2-2-0-0');f.open();assert.equal(f.control('단가 1').value,'919.09');}finally{f.close();}
});

for(const type of ['plan','purchaseorder','purchase'])test(type+' editor saves a confirmed adjustment and preserves amounts on reload',()=>{
 const f=fixture({type});try{f.change('단가 1','919.09');f.click('저장/내용유지');assert.ok(f.review());f.click('확인',f.review());assert.equal(f.review(),null);assert.equal(f.doc().lines[0].price,919.09);assert.equal(f.doc().lines[2].tax,454);assert.equal(f.doc().vatConfirmation,undefined);assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,1);assert.deepEqual(f.stored().settings,f.db.settings);}finally{f.close();}
});
test('purchase zero-rate type change removes stale difference without requiring a zero-difference review',()=>{
 const f=fixture({type:'purchase'});try{f.change('거래유형','22');f.click('저장/내용유지');assert.equal(f.review(),null);assert.equal(f.doc().vatRate,0);assert.equal(f.doc().vatCalculation,'transaction');assert.equal(f.doc().vatAdjustment.delta.tax,0);assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,0);}finally{f.close();}
});

test('reload after conflict reads actual storage and preserves other documents on the next save',()=>{
 const f=fixture();try{const external=C.clone(f.db);external.documents.at(-1).memo='다른 탭 현재 전표';external.documents[0].memo='다른 탭 다른 전표';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(external));f.change('전표 적요','오래된 입력');f.click('저장/내용유지');assert.deepEqual(f.stored(),external);f.click('최신 전표 다시 읽기');assert.equal(f.control('전표 적요').value,'다른 탭 현재 전표');f.change('전표 적요','재조회 후 수정');f.click('저장/내용유지');assert.equal(f.doc().memo,'재조회 후 수정');assert.equal(f.stored().documents[0].memo,'다른 탭 다른 전표');}finally{f.close();}
});
test('reopening a stale cached editor cannot acknowledge a newer storage revision',()=>{
 const f=fixture();try{const external=C.clone(f.db);external.documents[0].memo='다른 탭 수정';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(external));f.render('2-0-4');f.render('2-2-0-0');f.open();f.change('전표 적요','오래된 입력');f.click('저장/내용유지');assert.deepEqual(f.stored(),external);assert.match(f.toasts.at(-1),/다른 화면/);}finally{f.close();}
});
test('invalid latest storage fails reload without replacing data or losing the current draft',()=>{
 const f=fixture();try{f.change('전표 적요','보존할 초안');f.w.localStorage.setItem('ecount-inventory-v2','invalid JSON');f.click('최신 전표 다시 읽기');assert.equal(f.control('전표 적요').value,'보존할 초안');f.click('저장/내용유지');assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),'invalid JSON');}finally{f.close();}
});

test('blank added rows do not invalidate saved adjustment or shift its displayed row',()=>{
 const f=fixture();try{f.click('행 추가');assert.equal(f.d.querySelectorAll('.vat-adjusted-row').length,1);assert.match(f.d.querySelector('.inv-totals').textContent,/13,636.*1,364.*15,000/);assert.equal(f.d.querySelector('.inv-error').textContent,'');f.click('저장/내용유지');assert.equal(f.review(),null);assert.equal(f.doc().lines.length,3);assert.equal(f.doc().lines[2].tax,454);}finally{f.close();}
});
