(function(root){
  'use strict';
  const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
  const supportedTypes=['request','plan','pricerequest','purchaseorder','purchase','quote','order','sale','shippingorder','shipment'];
  const maxAmount=1000000000000,maxCents=100000000000000n;
  function number(value,label,min=0,max=maxAmount){
    if(value===null||typeof value==='string'&&!value.trim()||typeof value==='boolean'||!['string','number'].includes(typeof value))throw Error(label+' 값을 확인하세요.');
    const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' 값을 확인하세요.');return n;
  }
  function cents(value){
    if(!Number.isFinite(value)||value<0||value>maxAmount)throw Error('거래별 계산 금액은 0~1조 범위에서 확인하세요.');
    const n=Math.round(value*100);if(!Number.isSafeInteger(n))throw Error('거래별 계산 금액의 정밀도 범위를 초과했습니다.');return BigInt(n);
  }
  const amount=value=>Number(value)/100;
  function canonical(value){
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
    if(typeof value==='number'&&!Number.isFinite(value)||!['string','number','boolean'].includes(typeof value)&&value!==null)throw Error('계산 근거는 JSON 값이어야 합니다.');
    return JSON.stringify(value);
  }
  function normalizedInput(doc){
    if(!doc||!supportedTypes.includes(doc.type))throw Error('거래별 계산 대상 전표를 확인하세요. 반품·교환은 원본 배분 규칙 검증 후 지원합니다.');
    if(doc.currency&&doc.currency!=='KRW')throw Error('외화 거래별 계산은 환율·원화 차액 규칙 확인 후 지원합니다.');
    if(Object.hasOwn(doc,'vatAdjustment'))throw Error('기존 부가세 조정 근거를 덮어쓸 수 없습니다.');
    if(!Array.isArray(doc.lines)||!doc.lines.length||doc.lines.length>500)throw Error('거래별 계산 품목을 1~500행 입력하세요.');
    const vatRate=number(doc.vatRate??10,'부가세율',0,100);
    if(vatRate!==Number(vatRate.toFixed(6)))throw Error('부가세율은 소수 6자리 이내에서 확인하세요.');
    const taxRounding=C.taxRounding(doc.taxRounding),supplyRounding=C.supplyRounding(doc.supplyRounding);
    const ids=new Set(),lines=Array.from(doc.lines).map(line=>{
      if(!line||typeof line.item!=='string'||!line.item.trim())throw Error('빈 품목행을 정리한 뒤 거래별 계산을 확인하세요.');
      if(line.lineId!==undefined){if(typeof line.lineId!=='string'||!line.lineId||ids.has(line.lineId))throw Error('품목행 구분을 중복 없이 입력하세요.');ids.add(line.lineId);}
      if(line.vatRate!==undefined&&number(line.vatRate,'품목행 부가세율',0,100)!==vatRate)throw Error('혼합 부가세율 전표는 행별 세율 계약 확인 후 지원합니다.');
      if(Object.hasOwn(line,'returnAmounts')||Object.hasOwn(line,'vatAdjustment'))throw Error('이미 배분·조정된 품목행은 별도 금액 계약 검증이 필요합니다.');
      const qty=number(line.qty,'수량'),price=number(line.price??0,'단가'),discount=number(line.discount??0,'할인율',0,100);
      if(qty<=0)throw Error('수량은 0보다 커야 합니다.');
      const {supply,tax,total,_new,...identity}=line;
      return {...identity,qty,price,discount,...(line.vatRate!==undefined?{vatRate}:{})};
    });
    const {supply,tax,total,...header}=doc;
    return {...header,currency:doc.currency||'KRW',vatRate,taxRounding,supplyRounding,lines};
  }
  // Keep legacy line rounding. Only the transaction split below uses exact integer arithmetic.
  function splitSupply(total,rate,policy){
    const rateScale=1000000n,rateUnits=BigInt(Math.round(rate*Number(rateScale))),unit=10n**BigInt(2-policy.digits);
    const numerator=total*100n*rateScale,denominator=(100n*rateScale+rateUnits)*unit;
    let rounded=numerator/denominator;const remainder=numerator%denominator;
    if(policy.method==='ceil'&&remainder>0n||policy.method==='round'&&remainder*2n>=denominator)rounded++;
    return rounded*unit;
  }
  function preview(doc){
    const input=normalizedInput(doc),snapshot=canonical(input);let supply=0n,tax=0n,total=0n;
    const base=input.lines.map(line=>{
      const value=C.lineTotals(line,input.vatRate,input.taxRounding,input.supplyRounding);
      const row={supply:cents(value.supply),tax:cents(value.tax),total:cents(value.total)};
      if(row.supply+row.tax!==row.total)throw Error('품목행 금액 합계가 일치하지 않습니다.');
      supply+=row.supply;tax+=row.tax;total+=row.total;return row;
    });
    if(total>maxCents)throw Error('거래별 계산 합계는 1조 이내에서 확인하세요.');
    const targetSupply=splitSupply(total,input.vatRate,input.supplyRounding),targetTax=total-targetSupply;
    const supplyDelta=targetSupply-supply,taxDelta=targetTax-tax,lastIndex=base.length-1;
    if(targetTax<0n||base[lastIndex].supply+supplyDelta<0n||base[lastIndex].tax+taxDelta<0n)throw Error('마지막 품목행에서 차액을 반영하면 음수 금액이 됩니다. 배분 규칙을 먼저 확인하세요.');
    const values=row=>({supply:amount(row.supply),tax:amount(row.tax),total:amount(row.total)});
    const before=values({supply,tax,total}),after=values({supply:targetSupply,tax:targetTax,total});
    const rows=base.map((row,index)=>({index,item:input.lines[index].item,...(input.lines[index].lineId?{lineId:input.lines[index].lineId}:{}),before:values(row),after:values(index===lastIndex?{supply:row.supply+supplyDelta,tax:row.tax+taxDelta,total:row.total}:row),adjusted:index===lastIndex&&(supplyDelta!==0n||taxDelta!==0n)}));
    return {version:1,scope:'single-rate-krw-preview',snapshot,vatRate:input.vatRate,before,after,delta:{supply:amount(supplyDelta),tax:amount(taxDelta),total:0},lastIndex,hasDifference:supplyDelta!==0n||taxDelta!==0n,rows};
  }
  // A matching snapshot alone is not sufficient: recalculate every claimed amount and target.
  // This is an in-memory preview check, not permission to save or a persisted adjustment format.
  function verify(doc,expected){
    const current=preview(doc);
    if(!expected||expected.snapshot!==current.snapshot)throw Error('전표 또는 계산 조건이 바뀌었습니다. 거래별 계산을 다시 확인하세요.');
    if(canonical(expected)!==canonical(current))throw Error('거래별 계산 근거가 다릅니다. 미리보기를 다시 계산하세요.');
    return current;
  }
  const api={preview,verify};if(typeof module==='object'&&module.exports)module.exports=api;else root.TransactionVatCore=api;
})(typeof window!=='undefined'?window:globalThis);
