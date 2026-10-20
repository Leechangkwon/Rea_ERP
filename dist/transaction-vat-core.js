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
  function mode(doc){
    const value=doc.vatCalculation===undefined?'line':doc.vatCalculation;if(!['line','transaction'].includes(value))throw Error('부가세계산방법을 확인하세요.');return value;
  }
  function draft(doc,target=mode(doc)){
    const value=JSON.parse(JSON.stringify(doc));delete value.vatAdjustment;delete value.vatConfirmation;value.vatCalculation=target;return value;
  }
  function confirmation(doc,target=mode(doc)){return {mode:target,preview:preview(draft(doc,target))};}
  function evidence(doc,p=preview(draft(doc,'transaction'))){
    const n=normalizedInput(draft(doc,'transaction'));
    const basis={type:n.type,sourceId:n.sourceId||'',currency:n.currency,vatRate:n.vatRate,taxRounding:n.taxRounding,supplyRounding:n.supplyRounding,lines:n.lines.map(l=>({item:l.item,lineId:l.lineId||'',sourceLineId:l.sourceLineId||'',qty:l.qty,price:l.price,discount:l.discount}))};
    return {version:1,basis,lastIndex:p.lastIndex,delta:p.delta,before:p.before,after:p.after};
  }
  function stored(doc){
    if(mode(doc)!=='transaction'||!doc.vatAdjustment||Object.hasOwn(doc,'vatConfirmation'))throw Error('저장된 부가세 조정 근거를 확인하세요.');
    const p=preview(draft(doc,'transaction'));
    if(canonical(doc.vatAdjustment)!==canonical(evidence(doc,p)))throw Error('저장된 부가세 조정 근거가 현재 금액과 다릅니다. 다시 확인하세요.');
    return p;
  }
  function verifyConfirmation(doc,expected,target){
    if(!expected||expected.mode!==target||Object.keys(expected).some(k=>!['mode','preview'].includes(k)))throw Error('부가세 차액과 계산방법 변경을 확인한 뒤 저장하세요.');
    return verify(draft(doc,target),expected.preview);
  }
  function forSave(doc,previous){
    const value=JSON.parse(JSON.stringify(doc)),prior=previous&&mode(previous)==='transaction';
    if(prior)stored(previous);
    if(value.vatCalculation===undefined&&prior)value.vatCalculation='transaction';
    const target=mode(value),expected=value.vatConfirmation;
    if(value.vatAdjustment!==undefined){
      const supplied=value.vatAdjustment;
      if(!supplied||supplied.version!==1||(!prior||canonical(supplied)!==canonical(previous.vatAdjustment))&&canonical(supplied)!==canonical(evidence(value)))throw Error('알 수 없거나 변경된 부가세 조정 근거입니다.');
    }
    if(target==='transaction'){
      const p=preview(draft(value,target)),next=evidence(value,p);
      const unchanged=prior&&canonical(next)===canonical(previous.vatAdjustment);
      if(expected)verifyConfirmation(value,expected,target);
      else if(!unchanged&&p.hasDifference)throw Error('부가세 차액을 다시 확인한 뒤 저장하세요.');
      value.vatCalculation=target;value.vatAdjustment=next;
      value.lines=value.lines.map((line,index)=>({...line,...p.rows[index].after}));
    }else{
      if(prior||expected)verifyConfirmation(value,expected,target);
      else if(value.vatAdjustment!==undefined)throw Error('라인별 계산에 부가세 조정 근거를 사용할 수 없습니다.');
      delete value.vatAdjustment;value.lines=value.lines.map(line=>C.lineTotals(line,value.vatRate,value.taxRounding,value.supplyRounding));
    }
    delete value.vatConfirmation;return value;
  }
  function documentLines(doc){
    if(Object.hasOwn(doc,'vatConfirmation'))throw Error('임시 부가세 확인 자료는 저장 자료에 포함할 수 없습니다.');
    if(mode(doc)!=='transaction'){
      if(Object.hasOwn(doc,'vatAdjustment'))throw Error('라인별 계산에 부가세 조정 근거를 사용할 수 없습니다.');
      return doc.lines.map(line=>C.lineTotals(line,doc.vatRate,doc.taxRounding,doc.supplyRounding));
    }
    const p=stored(doc);return doc.lines.map((line,index)=>({...C.lineTotals(line,doc.vatRate,doc.taxRounding,doc.supplyRounding),...p.rows[index].after}));
  }
  function renamedItems(previous,next){
    stored(previous);const before=evidence(previous).basis,after=evidence(next).basis;
    const withoutCodes=b=>({...b,lines:b.lines.map(({item,...line})=>line)});
    if(canonical(withoutCodes(before))!==canonical(withoutCodes(after)))throw Error('품목코드 변경 중 부가세 금액 기준이 바뀌었습니다.');
    return evidence(next);
  }
  const api={preview,verify,mode,confirmation,stored,forSave,documentLines,renamedItems};if(typeof module==='object'&&module.exports)module.exports=api;else root.TransactionVatCore=api;
})(typeof window!=='undefined'?window:globalThis);
