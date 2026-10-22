(function(root){
 'use strict';
 const numericKeys=['baseDigits','additionalDigits','priceDigits','amountDigits'];
 function record(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error(label+' 설정 snapshot 구조를 확인하세요.');
 }
 function digits(value,max,label){if(value===null)return null;if(!Number.isInteger(value)||value<0||value>max)throw Error(label+' 입력 소수 자릿수를 명시하세요. 미상은 null입니다.');return value;}
 // Input validation has a separate supplier from Renderer.value_format and purchase display defaults.
 // No persisted voucher/form uses this review-only snapshot version.
 function resolve(snapshot){
  record(snapshot,['version','quantityUse','input'],'업로드');if(snapshot.version!==2)throw Error('업로드 입력 설정 snapshot 버전을 확인하세요.');if(snapshot.quantityUse!==null&&typeof snapshot.quantityUse!=='boolean')throw Error('추가수량 사용여부를 명시하세요. 미상은 null입니다.');
  record(snapshot.input,numericKeys,'숫자 입력');const fields={},unresolved=[];
  for(const key of numericKeys){const value=digits(snapshot.input[key],key==='amountDigits'?2:6,key);fields[key]={digits:value,source:value===null?'unknown-input':'company-input'};if(value===null)unresolved.push(key);}
  if(snapshot.quantityUse===null)unresolved.push('quantityUse');
  const quantity=snapshot.quantityUse!==null&&fields.baseDigits.digits!==null&&fields.additionalDigits.digits!==null?{enabled:snapshot.quantityUse,baseDigits:fields.baseDigits.digits,additionalDigits:fields.additionalDigits.digits}:null;
  // A known domestic amount policy remains usable even while the price policy is unknown.
  const amounts={priceDigits:fields.priceDigits.digits,amountDigits:fields.amountDigits.digits};
  return {version:2,fields,quantity,amounts,quantityUse:snapshot.quantityUse,unresolved,scope:'upload-input-precision-only',foreignCurrencyPrecisionResolved:false,groupingResolved:false,defaultsResolved:false,saveSupported:false};
 }
 const api=Object.freeze({resolve});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadPolicyCore=api;
})(typeof globalThis==='object'?globalThis:this);
