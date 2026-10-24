'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{environment}=require('./helpers/request-env.cjs');
function fixture(){
  const f=environment();
  for(const name of ['item-core.js','entry-core.js','entry-ui.js','entry-tools.js','entry-extra-core.js','entry-extra-ui.js'])f.w.eval(fs.readFileSync('dist/'+name,'utf8'));
  f.click('신규(F2)');f.change('전표 적요','보존할 초안');f.click('소요');
  f.change('생산 제품','P001');f.change('생산할 수량',5);f.click('제품 추가');f.click('계산(F8)');
  const parent=f.d.getElementById('inventory-dialog'),helper=f.d.getElementById('entry-extra-dialog');
  assert.ok(parent?.open);assert.ok(helper?.open);
  const draft=()=>JSON.stringify([...parent.querySelectorAll('input,select')].map(x=>[x.getAttribute('aria-label'),x.value,x.checked]));
  const apply=[...helper.querySelectorAll('button')].find(x=>x.textContent==='소요량 적용');
  return {...f,parent,helper,draft,apply};
}
const changes=[
  ['logout',f=>{f.w.AuthUI.state=()=>({user:null});}],
  ['account',f=>{f.w.AuthUI.state=()=>({user:{id:'other'}});}],
  ['company',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',company:{code:'OTHER'}}});}],
  ['role',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'other'}});}],
  ['permission',f=>{f.w.AuthUI.can=()=>false;}],
  ['external storage revision',f=>{const next=f.stored();next.settings.externalMarker='preserve';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(next));}]
];
for(const [name,invalidate]of changes)test('BOM helper cannot apply a preview after '+name,()=>{
  const f=fixture();try{const draft=f.draft();invalidate(f);const raw=f.w.localStorage.getItem('ecount-inventory-v2');f.apply.click();assert.equal(f.draft(),draft);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);assert.ok(f.helper.open);assert.match(f.helper.querySelector('[role=alert]').textContent,/계정|권한|자료|변경|다른/);}finally{f.w.close();}
});
test('detached editor and saved helper callbacks cannot replace a different input draft',()=>{
  const f=fixture();try{const draft=f.draft(),raw=f.w.localStorage.getItem('ecount-inventory-v2');f.parent.remove();f.apply.click();assert.equal(f.draft(),draft);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);}finally{f.w.close();}
});
test('unchanged editor applies BOM preview as a draft without writing business records or forms',()=>{
  const f=fixture();try{const raw=f.w.localStorage.getItem('ecount-inventory-v2'),forms=f.w.localStorage.getItem('ecount-form-layouts-v1');f.apply.click();assert.equal(f.d.getElementById('entry-extra-dialog'),null);assert.equal(f.control('품목 1').value,'M001');assert.equal(f.control('수량 1').value,'10');assert.equal(f.control('전표 적요').value,'보존할 초안');assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw);assert.equal(f.w.localStorage.getItem('ecount-form-layouts-v1'),forms);}finally{f.w.close();}
});

test('My-item settings cannot save after the editor role changes',()=>{
  const f=fixture();try{[...f.helper.querySelectorAll('button')].find(x=>x.textContent==='닫기').click();f.click('My품목설정');f.click('그룹 추가');const raw=f.w.localStorage.getItem('ecount-my-items-v1:local:owner');f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'changed'}});f.click('개인 그룹 저장');assert.equal(f.w.localStorage.getItem('ecount-my-items-v1:local:owner'),raw);assert.match(f.d.getElementById('entry-extra-dialog').querySelector('[role=alert]').textContent,/계정|권한/);}finally{f.w.close();}
});
