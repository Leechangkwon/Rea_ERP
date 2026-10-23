'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/inventory-core.js'),M=require('../dist/menu-core.js'),{environment}=require('./helpers/request-env.cjs');
for(const type of ['request','purchaseorder','purchase'])test(type+' status tab starts from first page and preserves pending search, selection and data',()=>{
 const f=environment();try{
  let db=f.stored();db.documents=[];const ids=[];
  for(let i=0;i<6;i++){const r=C.command(db,'document',{type,date:C.today(),partner:'V001',warehouse:'W001',status:i<4?'진행':'미확인',lines:[{item:'M001',qty:2,price:100}]});db=r.db;ids.push(r.result.id);}
  f.w.InventoryUI.replace(db);const rows=M.indexMenus(require('../dist/menus.json')),route=rows.find(r=>C.resolve(r)?.docType===type&&C.resolve(r)?.kind==='list');
  f.host.replaceChildren();f.w.InventoryUI.render(f.host,route,{rows,open(){},toast:t=>f.toasts.push(t)});
  const before=f.w.localStorage.getItem('ecount-inventory-v2'),wrap=()=>f.host.querySelector('.inv-document-list .inv-table-wrap');
  f.change('전표 선택 '+ids[0],true);f.click('다음 페이지');assert.equal(wrap().dataset.page,'1');
  f.click('Search(F3)');const quick=f.control(C.types[type]+' 빠른검색');quick.value='미적용 검색';quick.dispatchEvent(new f.w.Event('input',{bubbles:true}));
  f.control('확인 상태 조회').click();assert.equal(wrap().dataset.page,'0');assert.equal(f.control('확인 상태 조회').getAttribute('aria-pressed'),'true');
  assert.equal(f.control('전표 선택 '+ids[0]).checked,true);assert.equal(quick.value,'미적용 검색');assert.equal(f.host.querySelector('.inv-filters').hidden,false);assert.equal(f.host.querySelector('.inv-note[role=status]').hidden,false);
  f.click('다음 페이지');assert.equal(wrap().dataset.page,'1');f.control('전체 상태 조회').click();assert.equal(wrap().dataset.page,'0');assert.equal(f.control('전표 선택 '+ids[0]).checked,true);
  assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),before);
 }finally{f.w.close();}
});
