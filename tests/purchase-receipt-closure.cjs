'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js');
function fixture(){let db=C.empty();db.masters=C.clone(C.seed().masters);const result=C.command(db,'document',{type:'purchaseorder',date:'2026-10-21',partner:'V001',warehouse:'W001',employee:'E001',vatRate:10,lines:[{item:'M001',qty:10,price:100,lineId:'PO-L1'}]});return {db:result.db,po:result.result};}
const draft=()=>({type:'purchase',date:'2026-10-21',warehouse:'W001',partner:'V001',vatRate:10,memo:'keep',custom:{keep:'yes'},lines:[]});
const stage=(db,po,qty)=>E.stageDocuments(db,draft(),{mode:'linked',selections:[{documentId:po.id,item:'M001',lineId:'PO-L1',qty}]});
const close=(db,po)=>C.command(db,'transition',{ids:[po.id],progress:'완료'}).db;
const candidates=db=>E.documentCandidates(db,{targetType:'purchase',sourceType:'purchaseorder',mode:'linked'});
test('partial receipt, closure, reopen, final receipt and header-only import preserve accounting and forms',()=>{
 let {db,po}=fixture();const settings=C.clone(db.settings);let receipt=C.command(db,'document',stage(db,po,4));db=receipt.db;const first=receipt.result;
 assert.equal(C.remaining(db,po,'purchase')[0].qty,6);const late=stage(db,po,6);db=close(db,po);const closed=JSON.stringify(db);
 assert.deepEqual(candidates(db),[]);assert.throws(()=>stage(db,po,1),/종결/);assert.throws(()=>C.command(db,'document',late),/종결/);assert.throws(()=>C.command(db,'convert',{id:po.id,type:'purchase'}),/종결/);assert.equal(JSON.stringify(db),closed);
 db=C.command(db,'document',{...first,memo:'after closure'}).db;assert.equal(C.stock(db,'M001','W001'),4);assert.equal(C.outstanding(db,'payable','V001'),440);
 db=C.command(db,'transition',{ids:[po.id],progress:'진행'}).db;db=C.command(db,'document',stage(db,po,6)).db;db=C.validateBackup(JSON.parse(JSON.stringify(db)));
 assert.equal(C.remaining(db,po,'purchase')[0].qty,0);assert.equal(C.stock(db,'M001','W001'),10);assert.equal(C.outstanding(db,'payable','V001'),1100);assert.deepEqual(db.settings,settings);
 assert.equal(candidates(db)[0].headerOnly,true);assert.deepEqual(candidates(db)[0].lines,[]);const raw=JSON.stringify(db),input={...draft(),partner:'',employee:'',warehouse:'W002'},header=E.stagePurchaseHeader(db,input,{documentId:po.id});
 assert.deepEqual([header.partner,header.employee,header.warehouse,header.sourceId,header.lines.length],['V001','E001','W001',undefined,0]);assert.equal(header.date,input.date);assert.deepEqual(header.custom,input.custom);assert.equal(JSON.stringify(db),raw);assert.deepEqual(input.lines,[]);
});
test('closure guards all receipt additions including split lines and pending reactivation atomically',()=>{
 let {db,po}=fixture();const pending=C.command(db,'document',{...stage(db,po,2),confirmation:'미확인',status:'미확인'});db=pending.db;const first=C.command(db,'document',stage(db,po,4));db=close(first.db,po);const raw=JSON.stringify(db),old=first.result;
 for(const doc of [{...old,lines:[{...old.lines[0],qty:5}]},{...old,lines:[{...old.lines[0],lineId:'A',qty:3},{...old.lines[0],lineId:'B',qty:2}]}])assert.throws(()=>C.command(db,'document',doc),/종결|원본 라인별/);
 assert.throws(()=>C.command(db,'transition',{ids:[pending.result.id],confirmation:'확인'}),/종결/);assert.throws(()=>C.command(db,'document',{...pending.result,confirmation:'확인',status:'진행'}),/종결/);
 assert.equal(JSON.stringify(db),raw);assert.equal(C.command(db,'document',{...old,lines:[{...old.lines[0],qty:3}]}).result.lines[0].qty,3);
 assert.equal(C.validateBackup(JSON.parse(raw)).documents.length,3);
});
test('receipt can atomically close an open order through configured progress rules',()=>{
 const {db,po}=fixture();const result=C.command(db,'document',stage(db,po,10),{inventoryFeatures:{progressRules:[{from:'purchaseorder',to:'purchase',enabled:true,progress:'완료'}]}});
 assert.equal(C.purchasingState(result.db.documents.find(d=>d.id===po.id)).progress,'완료');assert.equal(C.stock(result.db,'M001','W001'),10);
});
test('closed PO is hidden in copy and remaining, while unrelated completed sources retain legacy behavior',()=>{
 let {db,po}=fixture();db=close(db,po);for(const mode of ['linked','copy']){assert.equal(E.documentCandidates(db,{targetType:'purchase',sourceType:'purchaseorder',mode}).length,0);assert.throws(()=>E.stageDocuments(db,draft(),{mode,selections:[{documentId:po.id,item:'M001',qty:1}]}),/종결/);}
 assert.equal(E.documentCandidates(db,{targetType:'request',sourceType:'purchaseorder',mode:'copy'}).length,1);
});
test('header-only requires truly exhausted open PO and rejects late quantity/status or draft changes',()=>{
 let {db,po}=fixture();assert.throws(()=>E.stagePurchaseHeader(db,draft(),{documentId:po.id}),/잔량/);const purchased=C.command(db,'document',stage(db,po,10));db=purchased.db;
 for(const input of [{...draft(),id:purchased.result.id},{...draft(),sourceId:po.id},{...draft(),lines:[{item:'M001',qty:1}]}])assert.throws(()=>E.stagePurchaseHeader(db,input,{documentId:po.id}),/빈 신규/);
 assert.throws(()=>E.stagePurchaseHeader(close(db,po),draft(),{documentId:po.id}),/진행중/);const reduced=C.command(db,'document',{...purchased.result,lines:[{...purchased.result.lines[0],qty:9}]}).db;assert.throws(()=>E.stagePurchaseHeader(reduced,draft(),{documentId:po.id}),/잔량/);
 db.masters.employees.find(e=>e.code==='E001').disabled=true;assert.throws(()=>E.stagePurchaseHeader(db,draft(),{documentId:po.id}),/사원/);
});
function uiFixture(){let {db,po}=fixture();db=C.command(db,'document',stage(db,po,10)).db;const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://synthetic.test'}),w=dom.window;let current={...draft(),partner:'',warehouse:'W002'},allowed=true,applied=0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.AuthUI={can:()=>allowed};
 for(const f of ['form-core','item-core','inventory-core','entry-core','entry-ui'])w.eval(fs.readFileSync('dist/'+f+'.js','utf8'));
 const open=()=>w.EntryUI.openDocuments({db,mode:'linked',sourceType:'purchaseorder',getDraft:()=>C.clone(current),onApply:x=>{current=x;applied++;}});
 const el=label=>[...w.document.querySelectorAll('[aria-label]')].find(e=>e.getAttribute('aria-label')===label),select=()=>{const e=el('행 선택 header|'+po.id);e.checked=true;e.dispatchEvent(new w.Event('change'));},apply=()=>el('선택 적용').click();
 return {db,po,w,open,el,select,apply,current:()=>current,applied:()=>applied,revoke:()=>{allowed=false;},close:()=>w.close()};
}
test('header-only picker has no quantity input, applies once, and supports cancel without data changes',()=>{
 const f=uiFixture();try{const raw=JSON.stringify(f.db);let d=f.open();f.select();assert.equal(f.el('불러올 수량 header|'+f.po.id),undefined);d.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.applied(),0);
 d=f.open();f.select();f.apply();assert.equal(f.applied(),1);assert.equal(f.current().partner,'V001');assert.equal(f.current().warehouse,'W001');assert.equal(f.current().sourceId,undefined);assert.equal(JSON.stringify(f.db),raw);
 }finally{f.close();}
});
test('header-only picker rechecks permission and late source closure',()=>{
 for(const reason of ['permission','closure']){const f=uiFixture();try{const d=f.open();f.select();if(reason==='permission')f.revoke();else f.db.documents.find(x=>x.id===f.po.id).progress='완료';f.apply();assert.equal(f.applied(),0);assert.equal(d.open,true);assert.match(d.querySelector('[role=alert]').textContent,reason==='permission'?/권한/:/진행중/);}finally{f.close();}}
});

test('automatic reopen rule cannot revive a closed source while saving a late receipt',()=>{
 let {db,po}=fixture();const late=stage(db,po,2);db=close(db,po);const before=JSON.stringify(db);
 const policy={inventoryFeatures:{progressRules:[{from:'purchaseorder',to:'purchase',enabled:true,progress:'진행'}]}};
 assert.throws(()=>C.command(db,'document',late,policy),/종결/);assert.equal(JSON.stringify(db),before);
});

test('closed source cannot be removed or changed to bypass receipt quantity protection',()=>{
 let {db,po}=fixture();const receipt=C.command(db,'document',stage(db,po,4));db=close(receipt.db,po);const raw=JSON.stringify(db);
 for(const sourceId of [undefined,'OTHER'])assert.throws(()=>C.command(db,'document',{...receipt.result,sourceId,lines:[{...receipt.result.lines[0],qty:8,sourceLineId:undefined}]}),/종결|유효한 연결/);
 assert.equal(JSON.stringify(db),raw);
});
