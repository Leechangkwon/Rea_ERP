'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{environment}=require('./helpers/request-env.cjs'),C=require('../dist/inventory-core.js'),M=require('../dist/menu-core.js');
for(const [type,rate] of [['request',7],['plan',7.5],['purchaseorder',7],['purchase',7.5]])test(type+' restores configured nonstandard VAT after reopening a zero-rate voucher',()=>{
 const f=environment();try{
  f.w.AuthUI.settings=()=>({conveniences:{pageSize:20},defaults:{vatRate:rate}});
  const out=C.command(f.w.InventoryUI.snapshot(),'document',{type,date:C.today(),warehouse:'W001',partner:'V001',transactionType:'22',vatRate:0,dueDate:'2099-10-30',lines:[{item:'M001',qty:2,price:100}]});f.w.InventoryUI.replace(out.db);
  const before=f.stored(),rows=M.indexMenus(require('../dist/menus.json')),route=rows.find(r=>C.resolve(r)?.kind==='list'&&C.resolve(r)?.docType===type);
  f.w.InventoryUI.beforeNavigate();f.host.replaceChildren();f.w.InventoryUI.render(f.host,route,{rows,open(){},toast(){}});
  [...f.host.querySelectorAll('button')].find(b=>b.textContent===out.result.date+' / '+out.result.id).click();
  assert.equal(f.control('부가세율(로컬 계산)').value,'0');
  f.change('거래유형','21');assert.equal(f.control('부가세율(로컬 계산)').value,String(rate));
  f.change('거래유형','22');assert.equal(f.control('부가세율(로컬 계산)').value,'0');
  f.change('거래유형','21');assert.equal(f.control('부가세율(로컬 계산)').value,String(rate));
  assert.deepEqual(f.stored(),before);f.click('저장(F8)');
  const after=f.stored(),saved=after.documents.find(d=>d.id===out.result.id);
  assert.equal(saved.transactionType,'21');assert.equal(saved.vatRate,rate);assert.equal(C.totals(saved).tax,2*rate);
  assert.deepEqual(after.documents.filter(d=>d.id!==saved.id),before.documents.filter(d=>d.id!==saved.id));assert.deepEqual(after.settings,before.settings);assert.deepEqual(after.masters,before.masters);assert.doesNotThrow(()=>C.validateBackup(after));
 }finally{f.w.close();}
});
