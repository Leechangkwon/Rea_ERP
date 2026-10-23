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

test('adopting an order header adds its nonstandard VAT rate to the purchase editor and saves a partial receipt',()=>{
 const f=environment();try{
  const fs=require('node:fs');for(const file of ['entry-core.js','entry-ui.js','entry-tools.js','entry-extra-core.js','entry-extra-ui.js'])f.w.eval(fs.readFileSync('dist/'+file,'utf8'));
  const out=C.command(f.w.InventoryUI.snapshot(),'document',{type:'purchaseorder',date:C.today(),warehouse:'W001',partner:'V001',transactionType:'21',vatRate:7.5,lines:[{lineId:'ORDER-RATE',item:'M001',qty:3,price:100}]});f.w.InventoryUI.replace(out.db);const before=f.stored(),rows=M.indexMenus(require('../dist/menus.json')),route=rows.find(r=>C.resolve(r)?.kind==='form'&&C.resolve(r)?.docType==='purchase');
  f.w.InventoryUI.beforeNavigate();f.host.replaceChildren();f.w.InventoryUI.render(f.host,route,{rows,open(){},toast(){}});assert.equal(f.control('부가세율(로컬 계산)').value,'10');
  f.click('전표 불러오기');f.change('원본 전표 종류','purchaseorder');f.change('불러오기 방식','linked');f.change('원본 머리 항목 적용',true);f.change('행 선택 '+out.result.id+'|ORDER-RATE',true);f.change('불러올 수량 '+out.result.id+'|ORDER-RATE',2);f.control('불러올 수량 '+out.result.id+'|ORDER-RATE').dispatchEvent(new f.w.Event('input',{bubbles:true}));f.control('선택 적용').click();
  assert.equal(f.control('부가세율(로컬 계산)').value,'7.5');assert.deepEqual(f.stored(),before);f.click('저장(F8)');
  const after=f.stored(),saved=after.documents.find(d=>d.type==='purchase'&&d.sourceId===out.result.id);assert.ok(saved);assert.equal(saved.vatRate,7.5);assert.equal(saved.lines[0].tax,15);assert.equal(C.totals(saved).total,215);assert.equal(C.remaining(after,out.result,'purchase')[0].qty,1);assert.deepEqual(after.documents.find(d=>d.id===out.result.id),out.result);assert.deepEqual(after.settings,before.settings);assert.deepEqual(after.masters,before.masters);assert.doesNotThrow(()=>C.validateBackup(after));
 }finally{f.w.close();}
});
