(function(root){
 'use strict';
 const quantities=['baseDigits','additionalDigits','priceDigits'];
 function record(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw Error(label+' 설정 snapshot 구조를 확인하세요.');
 }
 function digits(value,max,label){if(value===null)return null;if(!Number.isInteger(value)||value<0||value>max)throw Error(label+' 소수 자릿수를 명시하세요. 미상은 null입니다.');return value;}
 function formValue(value,defaultDigits,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(value,'mode')||!['explicit','default','unknown'].includes(value.mode))throw Error(label+' 양식의 명시/기본/미상 구분이 필요합니다.');
  if(value.mode==='explicit'){record(value,['mode','digits'],label+' 양식');if(value.digits===null)throw Error(label+' 명시 자릿수는 정수여야 합니다.');return {digits:digits(value.digits,6,label),source:'form-explicit'};}
  record(value,['mode'],label+' 양식');if(value.mode==='unknown')return {digits:null,source:'unknown-form'};
  return {digits:defaultDigits,source:defaultDigits===null?'unknown-purchase':'purchase-default'};
 }
 function resolve(snapshot){
  record(snapshot,['version','quantityUse','common','purchase','form'],'업로드');if(snapshot.version!==1)throw Error('업로드 설정 snapshot 버전을 확인하세요.');if(snapshot.quantityUse!==null&&typeof snapshot.quantityUse!=='boolean')throw Error('추가수량 사용여부를 명시하세요. 미상은 null입니다.');
  record(snapshot.common,['amountDigits',...quantities],'공통');record(snapshot.purchase,quantities,'구매');record(snapshot.form,quantities,'양식');
  const common={amountDigits:digits(snapshot.common.amountDigits,2,'공통 금액')},purchase={},fields={},unresolved=[];
  for(const key of quantities){common[key]=digits(snapshot.common[key],6,'공통 '+key);purchase[key]=digits(snapshot.purchase[key],6,'구매 '+key);fields[key]=formValue(snapshot.form[key],purchase[key],key);if(fields[key].digits===null)unresolved.push(key);}
  fields.amountDigits={digits:common.amountDigits,source:common.amountDigits===null?'unknown-common':'common'};if(common.amountDigits===null)unresolved.push('amountDigits');if(snapshot.quantityUse===null)unresolved.push('quantityUse');
  const quantity=snapshot.quantityUse!==null&&fields.baseDigits.digits!==null&&fields.additionalDigits.digits!==null?{enabled:snapshot.quantityUse,baseDigits:fields.baseDigits.digits,additionalDigits:fields.additionalDigits.digits}:null;
  const amounts=fields.priceDigits.digits!==null&&fields.amountDigits.digits!==null?{priceDigits:fields.priceDigits.digits,amountDigits:fields.amountDigits.digits}:null;
  return {version:1,fields,quantity,amounts,quantityUse:snapshot.quantityUse,unresolved,scope:'purchase-form-defaults-and-common-domestic-amount-precision',foreignCurrencyPrecisionResolved:false,groupingResolved:false,defaultsResolved:false,saveSupported:false};
 }
 const api=Object.freeze({resolve});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadPolicyCore=api;
})(typeof globalThis==='object'?globalThis:this);
