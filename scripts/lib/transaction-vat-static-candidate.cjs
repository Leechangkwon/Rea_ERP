'use strict';
// Research-only exact-decimal interpretation. Never import this module from app code.
// This is not a saved v2 contract or an execution of the original ECOUNT library.
const algorithm='raw-supply-static-candidate-v1';
const scale=10000000000n,productScale=scale*scale,maxAmount=1000000000000n;
const methods=['round','floor','ceil'];
function exactKeys(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error(label+' has unsupported or missing fields');
}
function decimal(value,label,maxPlaces=6){
  if(typeof value!=='string'||value.length>24||!/^(0|[1-9]\d*)(\.\d{1,10})?$/.test(value)||value.split('.')[1]?.length>maxPlaces)throw Error(label+' requires a nonnegative decimal string with at most '+maxPlaces+' decimal places');
  const [whole,fraction='']=value.split('.'),units=BigInt(whole)*scale+BigInt(fraction.padEnd(10,'0'));
  if(units>maxAmount*scale)throw Error(label+' exceeds the research bound');
  return units;
}
function currentMinor(value,digits,label){
  const n=decimal(value,label),unit=10n**BigInt(10-digits);
  if(n%unit!==0n)throw Error(label+' must match the explicit shared precision');
  return n/unit;
}
function rounded(numerator,denominator,method){
  let whole=numerator/denominator;const remainder=numerator%denominator;
  if(method==='ceil'&&remainder>0n||method==='round'&&remainder*2n>=denominator)whole++;
  return whole;
}
function textAmount(units,digits){
  const sign=units<0n?'-':'',value=(units<0n?-units:units).toString().padStart(digits+1,'0');
  return sign+(digits?value.slice(0,-digits)+'.'+value.slice(-digits):value);
}
function amounts(supply,tax,digits){
  return {supply:textAmount(supply,digits),tax:textAmount(tax,digits),total:textAmount(supply+tax,digits)};
}
function previewStaticCandidate(input){
  exactKeys(input,['basis','currency','vatRate','digits','supplyMethod','taxMethod','lines'],'Candidate input');
  if(input.basis!=='domestic-price'||input.currency!=='KRW'||![0,10].includes(input.vatRate)||!Number.isInteger(input.digits)||input.digits<0||input.digits>2||!methods.includes(input.supplyMethod)||!methods.includes(input.taxMethod))throw Error('Unsupported static research scope');
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>500)throw Error('Candidate requires 1 to 500 explicit rows');
  const ids=new Set(),factor=10n**BigInt(input.digits),limit=maxAmount*factor;
  let raw=0n,beforeSupply=0n,beforeTax=0n;
  const rows=Array.from(input.lines,(line,index)=>{
    exactKeys(line,['id','item','qty','price','supply','tax'],'Candidate row');
    if(typeof line.id!=='string'||!line.id.trim()||line.id.length>200||ids.has(line.id)||typeof line.item!=='string'||!line.item.trim()||line.item.length>200)throw Error('Candidate requires explicit unique row IDs and nonempty items');
    ids.add(line.id);
    const qty=decimal(line.qty,'Quantity'),price=decimal(line.price,'Applied price',10);
    if(qty===0n||price===0n)throw Error('Direct amounts and nonpositive quantities/prices are outside the candidate scope');
    const supply=currentMinor(line.supply,input.digits,'Current supply'),tax=currentMinor(line.tax,input.digits,'Current tax');
    raw+=qty*price;beforeSupply+=supply;beforeTax+=tax;
    if(raw>maxAmount*productScale||beforeSupply+beforeTax>limit)throw Error('Candidate aggregate exceeds the research bound');
    return {id:line.id,item:line.item,index,supply,tax};
  });
  const targetSupply=rounded(raw*factor,productScale,input.supplyMethod);
  const targetTax=input.vatRate===0?0n:rounded(raw*factor,productScale*10n,input.taxMethod);
  if(targetSupply+targetTax>limit)throw Error('Candidate target exceeds the research bound');
  const supplyDelta=targetSupply-beforeSupply,taxDelta=targetTax-beforeTax,lastIndex=rows.length-1;
  let negativeLastRow=false;
  const outputRows=rows.map((row,index)=>{
    const supply=row.supply+(index===lastIndex?supplyDelta:0n),tax=row.tax+(index===lastIndex?taxDelta:0n);
    if(index===lastIndex&&(supply<0n||tax<0n))negativeLastRow=true;
    return {id:row.id,item:row.item,index,before:amounts(row.supply,row.tax,input.digits),after:amounts(supply,tax,input.digits),adjusted:index===lastIndex&&(supplyDelta!==0n||taxDelta!==0n)};
  });
  return {algorithm,persistenceVersion:null,canApply:false,originalRuntimeObserved:false,originalParityPassed:false,
    scope:'positive-domestic-price-single-rate-0-or-10-exact-decimal',digits:input.digits,
    rawSupply:raw%100000000n===0n?{numerator:(raw/100000000n).toString(),denominator:'1000000000000'}:{numerator:raw.toString(),denominator:productScale.toString()},
    before:amounts(beforeSupply,beforeTax,input.digits),after:amounts(targetSupply,targetTax,input.digits),
    delta:amounts(supplyDelta,taxDelta,input.digits),grossChanged:supplyDelta+taxDelta!==0n,
    lastIndex,lastRowId:rows[lastIndex].id,negativeLastRow,rows:outputRows};
}

// Rates are already resolved by the caller. No transaction/item/warehouse lookup.
function previewResolvedGroups(input){
  exactKeys(input,['basis','currency','digits','supplyMethod','taxMethod','lines'],'Grouped input');
  if(input.basis!=='domestic-price'||input.currency!=='KRW'||!Number.isInteger(input.digits)||input.digits<0||input.digits>2||!methods.includes(input.supplyMethod)||!methods.includes(input.taxMethod))throw Error('Unsupported grouped research scope');
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>500)throw Error('Grouped preview requires 1 to 500 explicit rows');
  const groups=new Map(),ids=new Set();
  const staged=Array.from(input.lines,(line,index)=>{
    exactKeys(line,['id','item','qty','price','supply','tax','vatRate'],'Grouped row');
    if(typeof line.id!=='string'||!line.id.trim()||line.id.length>200||ids.has(line.id))throw Error('Grouped preview requires globally unique row IDs');
    if(![0,10].includes(line.vatRate))throw Error('Unreviewed resolved VAT rate');
    ids.add(line.id);
    const {vatRate,...row}=line;
    if(!groups.has(vatRate))groups.set(vatRate,[]);
    groups.get(vatRate).push({row,index});
    return {id:line.id,index,vatRate};
  });
  const limit=maxAmount*10n**BigInt(input.digits),resultGroups=[];
  let beforeSupply=0n,beforeTax=0n,afterSupply=0n,afterTax=0n,raw=0n;
  const rows=new Array(staged.length);
  for(const [vatRate,members] of groups){
    const result=previewStaticCandidate({basis:input.basis,currency:input.currency,vatRate,digits:input.digits,supplyMethod:input.supplyMethod,taxMethod:input.taxMethod,lines:members.map(m=>m.row)});
    beforeSupply+=currentMinor(result.before.supply,input.digits,'Group supply');
    beforeTax+=currentMinor(result.before.tax,input.digits,'Group tax');
    afterSupply+=currentMinor(result.after.supply,input.digits,'Target supply');
    afterTax+=currentMinor(result.after.tax,input.digits,'Target tax');
    raw+=BigInt(result.rawSupply.numerator)*(productScale/BigInt(result.rawSupply.denominator));
    if(raw>maxAmount*productScale||beforeSupply+beforeTax>limit||afterSupply+afterTax>limit)throw Error('Grouped aggregate exceeds the research bound');
    for(const row of result.rows){
      const index=members[row.index].index;
      rows[index]={...row,index,vatRate};
    }
    resultGroups.push({vatRate,indexes:members.map(m=>m.index),rawSupply:result.rawSupply,before:result.before,after:result.after,delta:result.delta,lastIndex:members.at(-1).index,lastRowId:result.lastRowId,negativeLastRow:result.negativeLastRow});
  }
  return {algorithm:'resolved-rate-groups-static-v0',persistenceVersion:null,canApply:false,
    originalRuntimeObserved:false,originalParityPassed:false,rateResolutionVerified:false,
    scope:'positive-domestic-price-explicit-resolved-rates-0-or-10-exact-decimal',digits:input.digits,
    before:amounts(beforeSupply,beforeTax,input.digits),after:amounts(afterSupply,afterTax,input.digits),
    delta:amounts(afterSupply-beforeSupply,afterTax-beforeTax,input.digits),
    grossChanged:afterSupply+afterTax!==beforeSupply+beforeTax,
    requiresConfirmation:resultGroups.some(g=>g.delta.supply!==textAmount(0n,input.digits)||g.delta.tax!==textAmount(0n,input.digits)),
    negativeLastRow:resultGroups.some(g=>g.negativeLastRow),groups:resultGroups,rows};
}
module.exports={previewStaticCandidate,previewResolvedGroups};
