'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{environment}=require('./helpers/request-env.cjs');
function fixture(kind){
 const f=environment();for(const file of ['entry-core.js','entry-ui.js','entry-tools.js'])f.w.eval(fs.readFileSync('dist/'+file,'utf8'));
 f.click('신규(F2)');f.change('전표 적요','조회 보호 초안');
 const method=kind==='order'?'documentCandidates':'stockCandidates',original=f.w.EntryCore[method];let queries=0;
 f.w.EntryCore[method]=(...args)=>{queries++;return original(...args);};
 f.click(kind==='order'?'주문':'재고 품목 선택');
 const dialog=f.d.getElementById('entry-helper-dialog'),parent=f.d.getElementById('inventory-dialog'),query=f.control(kind==='order'?'전표 검색':'재고 검색');assert.ok(dialog?.open);
 const draft=()=>JSON.stringify([...parent.querySelectorAll('input,select')].map(x=>[x.getAttribute('aria-label'),x.value,x.checked]));
 const search=()=>{query.value='M001';query.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
 return {...f,dialog,parent,search,draft,queries:()=>queries};
}
const changes=[
 ['logout',f=>{f.w.AuthUI.state=()=>({user:null});}],
 ['account',f=>{f.w.AuthUI.state=()=>({user:{id:'other'}});}],
 ['company',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',company:{code:'OTHER'}}});}],
 ['role',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'other'}});}],
 ['permission',f=>{f.w.AuthUI.can=()=>false;}],
 ['external storage revision',f=>{const db=f.stored();db.settings.externalMarker='preserve';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));}],
 ['detached parent',f=>{f.parent.remove();}]
];
for(const kind of ['order','stock']){
 for(const [name,invalidate]of changes)test(kind+' query stops before reading data after '+name,()=>{
  const f=fixture(kind);try{const before=f.queries(),draft=f.draft();invalidate(f);const raw=f.w.localStorage.getItem('ecount-inventory-v2');f.search();assert.equal(f.queries(),before,'stale helper must not query');assert.equal(f.draft(),draft);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);assert.equal(f.dialog.querySelectorAll('tbody tr').length,0);assert.match(f.dialog.querySelector('[role=alert]').textContent,/계정|권한|자료|변경|다른/);}finally{f.w.close();}
 });
 test(kind+' unchanged query remains usable without saving draft or business records',()=>{
  const f=fixture(kind);try{const before=f.queries(),raw=f.w.localStorage.getItem('ecount-inventory-v2'),draft=f.draft();f.search();assert.ok(f.queries()>before);assert.equal(f.draft(),draft);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);assert.equal(f.dialog.querySelector('[role=alert]').textContent,'');}finally{f.w.close();}
 });
 test(kind+' retained query callback is inert after its dialog closes',()=>{
  const f=fixture(kind);try{const before=f.queries(),raw=f.w.localStorage.getItem('ecount-inventory-v2');[...f.dialog.querySelectorAll('button')].find(x=>x.textContent==='취소').click();f.search();assert.equal(f.queries(),before);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);assert.equal(f.d.getElementById('entry-helper-dialog'),null);}finally{f.w.close();}
 });
}
