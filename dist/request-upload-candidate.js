(function(root){
 'use strict';
 const columns=Object.freeze([{"label":"일자","fieldId":"inv_s$data_dt_no"},{"label":"순번","fieldId":"inv_s$upload_bundle_seq"},{"label":"담당자","fieldId":"inv_s$pic"},{"label":"창고","fieldId":"inv_s$wh"},{"label":"거래유형","fieldId":"inv_s$trx_type"},{"label":"통화","fieldId":"inv_s$foreign_currency"},{"label":"환율","fieldId":"inv_s$exchange_rate"},{"label":"납기일자","fieldId":"inv_s$due_dt"},{"label":"참조","fieldId":"inv_s$txt_007"},{"label":"프로젝트","fieldId":"inv_s$pjt"},{"label":"품목코드","fieldId":"inv_m$prod"},{"label":"품목명","fieldId":"inv_m$prod_nm"},{"label":"거래처코드","fieldId":"inv_m$cust"},{"label":"거래처명","fieldId":"inv_m$cust_nm"},{"label":"규격","fieldId":"inv_m$spec_nm"},{"label":"수량","fieldId":"inv_m$add_qty"},{"label":"단가","fieldId":"inv_m$apply_price_amt"},{"label":"외화공급가액","fieldId":"inv_m$foreign_currency_supply_amt"},{"label":"공급가액","fieldId":"inv_m$supply_amt"},{"label":"부가세","fieldId":"inv_m$vat_amt"},{"label":"적요","fieldId":"inv_m$remark"},{"label":"낱개수량","fieldId":"inv_m$qty"}].map(x=>Object.freeze(x)));
 function stageRaw(matrix,options={}){
  if(!Array.isArray(matrix))throw Error('업로드 자료는 문자열 셀의 행 배열이어야 합니다.');
  if(!options||typeof options!=='object'||Array.isArray(options)||typeof options.hasHeader!=='boolean')throw Error('제목행 포함 여부를 명시하세요.');
  if(!Number.isInteger(options.maxRows)||options.maxRows<1||options.maxRows>10000)throw Error('분리 검증의 최대 행수를 1~10000으로 명시하세요.');
  const offset=options.hasHeader?1:0;if(matrix.length-offset>options.maxRows)throw Error('호출자가 지정한 최대 '+options.maxRows+'행을 초과했습니다.');
  if(matrix.some(row=>!Array.isArray(row))||Object.keys(matrix).filter(k=>/^\d+$/.test(k)).length!==matrix.length)throw Error('업로드 자료는 문자열 셀의 행 배열이어야 합니다.');
  const checked=matrix.map((row,index)=>{if(row.length>columns.length)throw Error((index+1)+'행의 열수가 서식의 '+columns.length+'열을 초과합니다.');for(let i=0;i<row.length;i++)if(!Object.prototype.hasOwnProperty.call(row,i)||typeof row[i]!=='string')throw Error((index+1)+'행은 빠진 셀 없이 문자열로 입력하세요.');return row.slice();});
  if(options.hasHeader&&(!checked.length||checked[0].length!==columns.length||columns.some((c,i)=>checked[0][i].trim()!==c.label)))throw Error('현재 발주요청 서식의 제목과 열 순서를 확인하세요.');
  const source=checked.slice(offset);
  const rows=source.map((cells,index)=>{const raw=Array.from({length:columns.length},(_,i)=>i<cells.length?cells[i]:''),values=Object.fromEntries(columns.map((c,i)=>[c.fieldId,raw[i].trim()]));return {sourceRow:index+offset+1,raw,values,empty:Object.values(values).every(v=>v==='')};});
  return {rows,columns:columns.map(x=>({...x})),hasHeader:options.hasHeader,rowLimit:options.maxRows,rowLimitSource:'caller-policy',businessValidation:false,groupingResolved:false,saveSupported:false};
 }
 // A disconnected preflight: exact arithmetic checks the observed relation only.
 // It never chooses an upload winner, fills missing cells, rounds, or creates a document.
 const quantityFields=Object.freeze({additional:'inv_m$add_qty',base:'inv_m$qty'});
 function decimal(text,label,digits,integerDigits=12){
  if(typeof text!=='string'||text.length>64||!/^[-]?\d+(?:\.\d+)?$/.test(text))throw Error(label+'는 지수/구분자 없는 십진 문자열이어야 합니다.');
  const negative=text.startsWith('-'),unsigned=negative?text.slice(1):text,[whole,fraction='']=unsigned.split('.');
  if(whole.replace(/^0+(?=\d)/,'').length>integerDigits||fraction.length>digits)throw Error(label+'의 정수/소수 자릿수를 확인하세요.');
  return {coefficient:BigInt(whole+fraction)*(negative?-1n:1n),scale:10n**BigInt(fraction.length)};
 }
 function fractionText(numerator,denominator,digits){
  const factor=10n**BigInt(digits),scaled=numerator*factor;if(scaled%denominator!==0n)return null;
  const integer=scaled/denominator,negative=integer<0n,absolute=negative?-integer:integer;
  const text=absolute.toString().padStart(digits+1,'0'),whole=digits?text.slice(0,-digits):text,fraction=digits?text.slice(-digits).replace(/0+$/,''):'';
  return (negative?'-':'')+whole+(fraction?'.'+fraction:'');
 }
 function inspectQuantity(values,policy){
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.values(quantityFields).some(key=>!Object.hasOwn(values,key)||typeof values[key]!=='string'))throw Error('원문 매핑의 기본수량과 추가수량 문자열이 필요합니다.');
  if(!policy||typeof policy!=='object'||Array.isArray(policy)||typeof policy.enabled!=='boolean'||!Number.isInteger(policy.baseDigits)||policy.baseDigits<0||policy.baseDigits>10||!Number.isInteger(policy.additionalDigits)||policy.additionalDigits<0||policy.additionalDigits>10)throw Error('추가수량 사용여부와 두 수량의 소수 자릿수를 명시하세요.');
  const input={base:values[quantityFields.base],additional:values[quantityFields.additional]},issues=[],parsed={},result={input,precision:{base:policy.baseDigits,additional:policy.additionalDigits},enabled:policy.enabled,relation:'empty',expectedBase:null,issues,businessValidation:false,uploadPrecedenceResolved:false,saveSupported:false};
  for(const kind of ['base','additional'])if(input[kind]!=='')try{parsed[kind]=decimal(input[kind],kind==='base'?'기본수량':'추가수량',policy[kind+'Digits']);}catch(e){issues.push({code:'quantity-format',fieldId:quantityFields[kind],message:e.message});}
  if(issues.length){result.relation='invalid-input';return result;}
  if(!policy.enabled){result.relation=input.additional===''?(input.base===''?'empty':'base-only'):'additional-disabled';return result;}
  if(input.additional===''){result.relation=input.base===''?'empty':'base-only';return result;}
  if(policy.rate==null){result.relation='rate-required';return result;}
  if(typeof policy.rate!=='object'||Array.isArray(policy.rate))throw Error('품목의 기본수량/추가수량 환산비율을 확인하세요.');
  const numerator=decimal(policy.rate.numerator,'환산 분자',10),denominator=decimal(policy.rate.denominator,'환산 분모',0);
  if(numerator.coefficient<=0n||denominator.coefficient<=0n)throw Error('분리 검증은 양수 분자와 양의 정수 분모가 명시된 환산비율만 지원합니다.');
  result.rate={numerator:policy.rate.numerator,denominator:policy.rate.denominator};
  const product=parsed.additional.coefficient*numerator.coefficient,divisor=parsed.additional.scale*numerator.scale*denominator.coefficient;
  result.expectedBase=fractionText(product,divisor,policy.baseDigits);
  if(result.expectedBase===null){result.relation='rounding-required';return result;}
  if(result.expectedBase.replace(/^-/,'').split('.')[0].length>12){result.relation='base-overflow';return result;}
  result.relation=input.base===''?'additional-only':parsed.base.coefficient*divisor===product*parsed.base.scale?'matched':'conflict';
  return result;
 }
 const amountFields=Object.freeze({price:'inv_m$apply_price_amt',foreignSupply:'inv_m$foreign_currency_supply_amt',supply:'inv_m$supply_amt',tax:'inv_m$vat_amt'});
 // Uploaded monetary amounts are independent entries, unlike ordinary entry totals.
 // Keep decimal strings and blank origins; neither quantity/price/VAT nor exchange rate recalculates them.
 function inspectAmounts(values,policy){
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.values(amountFields).some(key=>!Object.hasOwn(values,key)||typeof values[key]!=='string'))throw Error('원문 매핑의 단가·외화공급가액·공급가액·부가세 문자열이 필요합니다.');
  const digitsValid=value=>Number.isInteger(value)&&value>=0&&value<=10;
  if(!policy||typeof policy!=='object'||Array.isArray(policy)||!digitsValid(policy.priceDigits)||!digitsValid(policy.amountDigits)||policy.foreignDigits!==null&&!digitsValid(policy.foreignDigits))throw Error('단가·국내금액·통화금액 소수 자릿수를 명시하세요. 통화 자릿수 미상은 null입니다.');
  const precision={price:policy.priceDigits,foreignSupply:policy.foreignDigits,supply:policy.amountDigits,tax:policy.amountDigits},labels={price:'단가',foreignSupply:'외화공급가액',supply:'공급가액',tax:'부가세'},input={},amounts={},origins={},issues=[];
  for(const [kind,fieldId] of Object.entries(amountFields)){
   const text=values[fieldId];input[kind]=text;origins[kind]=text===''?'blank-zero':'explicit';
   if(text===''){amounts[kind]='0';continue;}
   if(precision[kind]===null){amounts[kind]=null;issues.push({code:'foreign-precision-required',fieldId,message:'통화에 설정된 금액 소수 자릿수를 확인하세요.'});continue;}
   try{const parsed=decimal(text,labels[kind],precision[kind],kind==='supply'||kind==='tax'?15:12);amounts[kind]=fractionText(parsed.coefficient,parsed.scale,precision[kind]);}
   catch(error){amounts[kind]=null;issues.push({code:'amount-format',fieldId,message:error.message});}
  }
  return {input,values:amounts,origins,precision,status:issues.some(x=>x.code==='amount-format')?'invalid-input':issues.length?'precision-required':'valid',issues,calculation:'none',numberConversion:false,businessValidation:false,currencyValidated:false,saveSupported:false};
 }
 const api=Object.freeze({columns,stageRaw,quantityFields,inspectQuantity,amountFields,inspectAmounts});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadCandidate=api;
})(typeof globalThis==='object'?globalThis:this);
