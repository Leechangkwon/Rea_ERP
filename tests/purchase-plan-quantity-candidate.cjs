'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {previewStockOnly}=require('../scripts/lib/purchase-plan-quantity-candidate.cjs');
const fixture=require('./fixtures/purchase-plan-quantity-examples.json');
const row=(extra={})=>({id:'ROW1',item:'ITEM1',warehouse:'WH1',inputQty:'10',onHandQty:'3',...extra});
const input=(rows=[row()])=>({basis:'stock-only',rows});
for(const c of fixture.cases)test('official illustrated stock-only row '+c.id,()=>{
  const result=previewStockOnly(input([row({inputQty:c.inputQty,onHandQty:c.onHandQty})]));
  assert.equal(result.rows[0].confirmedQty,c.confirmedQty);assert.equal(result.totals.confirmedQty,c.confirmedQty);
});
test('zero and equal stock boundaries keep zero without a negative candidate',()=>{
  for(const [initial,stock,expected]of [['0','0','0'],['0','5','0'],['5','5','0'],['5','0','5']]){
    const result=previewStockOnly(input([row({inputQty:initial,onHandQty:stock})]));assert.equal(result.rows[0].confirmedQty,expected);
    assert.equal(result.rows[0].clamped,BigInt(initial)<BigInt(stock));
  }
});
test('complete preview preserves inputs and combines independent explicit stock rows exactly',()=>{
  const value=input([row(),row({id:'ROW2',item:'ITEM2',inputQty:'2',onHandQty:'8'})]),snapshot=JSON.stringify(value);
  const result=previewStockOnly(value);assert.equal(JSON.stringify(value),snapshot);assert.deepEqual(result.totals,{inputQty:'12',confirmedQty:'7',delta:'-5'});
  assert.equal(result.rows[1].rawQty,'-6');assert.equal(result.rows[1].delta,'-2');
  result.rows[0].inputQty='99';assert.equal(JSON.stringify(value),snapshot);
});
test('same stock key never gets silently deducted across several plan rows',()=>{
  const value=input([row(),row({id:'ROW2'})]),snapshot=JSON.stringify(value);assert.throws(()=>previewStockOnly(value),/allocation policy/);assert.equal(JSON.stringify(value),snapshot);
  assert.throws(()=>previewStockOnly(input([row(),row({item:'ITEM2'})])),/Duplicate row/);
});
test('distinct warehouses and tuple-safe stock keys stay independent',()=>{
  assert.equal(previewStockOnly(input([row(),row({id:'ROW2',warehouse:'WH2'})])).rows.length,2);
  assert.equal(previewStockOnly(input([row({item:'A|B',warehouse:'C'}),row({id:'ROW2',item:'A',warehouse:'B|C'})])).rows.length,2);
});
test('unsupported quantities and conditions are rejected rather than rounded or guessed',()=>{
  for(const key of ['inputQty','onHandQty'])for(const bad of ['-1','1.5','1e3','01',' 1','NaN','1000000000001',1,null])assert.throws(()=>previewStockOnly(input([row({[key]:bad})])));
  assert.throws(()=>previewStockOnly({...input(),basis:'minimum-purchase-unit'}));assert.throws(()=>previewStockOnly({...input(),minimumPurchaseQty:'5'}));
  assert.throws(()=>previewStockOnly(input([row({minimumPurchaseQty:'5'})])));assert.throws(()=>previewStockOnly(input([row({safetyStock:'2'})])));
});
test('empty missing sparse or excessive rows and ambiguous identifiers are rejected',()=>{
  for(const bad of [[],null,new Array(1),Array.from({length:501},(_,i)=>row({id:String(i),item:String(i)}))])assert.throws(()=>previewStockOnly(input(bad)));
  for(const key of ['id','item','warehouse'])for(const bad of ['',null,' padded '])assert.throws(()=>previewStockOnly(input([row({[key]:bad})])));
  assert.throws(()=>previewStockOnly({rows:[row()]}));
});
test('research bounds retain exact totals and never claim save or runtime parity',()=>{
  const result=previewStockOnly(input(Array.from({length:500},(_,i)=>row({id:String(i),item:String(i),inputQty:'1000000000000',onHandQty:'0'}))));
  assert.deepEqual(result.totals,{inputQty:'500000000000000',confirmedQty:'500000000000000',delta:'0'});
  assert.equal(result.canApply,false);assert.equal(result.originalRuntimeObserved,false);assert.equal(result.originalParityPassed,false);assert.equal(result.persistenceVersion,null);
});
