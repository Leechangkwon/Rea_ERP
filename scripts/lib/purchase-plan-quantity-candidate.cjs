'use strict';
// Research-only interpretation of the official stock-only examples.
// Never imported by app code: stock lookup, allocation and commit remain unverified.
const algorithm='stock-only-integer-v0',maxQuantity=1000000000000n;
function exactKeys(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error(label+' has unsupported or missing fields');
}
function quantity(value,label){
  if(typeof value!=='string'||!/^(0|[1-9]\d{0,12})$/.test(value))throw Error(label+' requires a nonnegative integer string');
  const result=BigInt(value);if(result>maxQuantity)throw Error(label+' exceeds the research row bound');return result;
}
function identifier(value,label){
  if(typeof value!=='string'||!value||value!==value.trim()||value.length>200)throw Error(label+' requires an explicit identifier');return value;
}
function previewStockOnly(input){
  exactKeys(input,['basis','rows'],'Quantity candidate');
  if(input.basis!=='stock-only')throw Error('Only stock-only examples are supported');
  if(!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>500)throw Error('Candidate requires 1 to 500 explicit rows');
  const rowIds=new Set(),stockKeys=new Set();let before=0n,after=0n;
  const rows=Array.from(input.rows,row=>{
    exactKeys(row,['id','item','warehouse','inputQty','onHandQty'],'Candidate row');
    const id=identifier(row.id,'Row'),item=identifier(row.item,'Item'),warehouse=identifier(row.warehouse,'Warehouse');
    if(rowIds.has(id))throw Error('Duplicate row identifier');rowIds.add(id);
    const stockKey=JSON.stringify([item,warehouse]);
    if(stockKeys.has(stockKey))throw Error('Repeated item/warehouse requires an unverified stock allocation policy');stockKeys.add(stockKey);
    const initial=quantity(row.inputQty,'Input quantity'),stock=quantity(row.onHandQty,'On-hand quantity'),raw=initial-stock,confirmed=raw<0n?0n:raw;
    before+=initial;after+=confirmed;
    return {id,item,warehouse,inputQty:row.inputQty,onHandQty:row.onHandQty,rawQty:raw.toString(),confirmedQty:confirmed.toString(),delta:(confirmed-initial).toString(),clamped:raw<0n};
  });
  return {algorithm,canApply:false,persistenceVersion:null,originalRuntimeObserved:false,originalParityPassed:false,scope:'explicit-nonnegative-integer-stock-only-unique-item-warehouse',totals:{inputQty:before.toString(),confirmedQty:after.toString(),delta:(after-before).toString()},rows};
}
module.exports={previewStockOnly};
