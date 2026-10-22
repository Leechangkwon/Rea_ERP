(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./request-upload-candidate.js'):root.RequestUploadCandidate;
 const R=typeof module==='object'&&module.exports?require('./request-upload-save-rules.js'):root.RequestUploadSaveRules;
 const fields=Object.freeze({itemCode:'inv_m$prod',itemName:'inv_m$prod_nm',partnerCode:'inv_m$cust',partnerName:'inv_m$cust_nm',currency:'inv_s$foreign_currency'});
 const headerFields=Object.freeze([{kind:'employee',masterKey:'employees',fieldId:'inv_s$pic',label:'담당자'},{kind:'warehouse',masterKey:'warehouses',fieldId:'inv_s$wh',label:'창고'},{kind:'project',masterKey:'projects',fieldId:'inv_s$pjt',label:'프로젝트'}].map(x=>Object.freeze(x)));
 function inspectHeaderReferences(values,indexes){
  const references={},proposals={},issues=[];
  const messages={'not-found':'등록된 코드 또는 명칭을 찾지 못했습니다.','ambiguous':'같은 값의 후보가 여러 개입니다.','disabled-review':'사용중단 자료입니다. 확인이 필요합니다.','snapshot-required':'등록자료를 다시 조회하세요.'};
  for(const field of headerFields){
   const token=values[field.fieldId],index=indexes[field.kind],result=!token?{status:'blank',code:null,candidates:[],candidatesTruncated:false}:index===null?{status:'snapshot-required',code:null,candidates:[],candidatesTruncated:false}:resolveReference(index,token,'',true);
   references[field.kind]=result;if(result.status==='resolved')proposals[field.fieldId]=result.code;
   else if(result.status!=='blank')issues.push({code:'reference-'+result.status,kind:field.kind,fieldId:field.fieldId,candidates:result.candidates.slice(),message:field.label+': '+(messages[result.status]||'등록자료를 확인하세요.')});
  }
  return {references,proposals,issues};
 }
 function referenceIndex(entries,kind){
  if(!Array.isArray(entries)||entries.length>50000)throw Error(kind+' 조회 snapshot을 확인하세요.');
  const byCode=new Map(),byName=new Map(),byBarcode=new Map();
  const add=(map,key,entry)=>{if(key){const list=map.get(key);if(list)list.push(entry);else map.set(key,[entry]);}};
  for(const entry of entries){
   if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.code!=='string'||!entry.code||entry.code.length>1000||typeof entry.name!=='string'||entry.name.length>1000||typeof entry.disabled!=='boolean'||entry.barcode!==undefined&&(typeof entry.barcode!=='string'||entry.barcode.length>1000))throw Error(kind+' 조회 snapshot의 코드·명칭·사용중단 여부를 확인하세요.');
   if(byCode.has(entry.code))throw Error(kind+' 조회 snapshot에 같은 코드가 중복됩니다.');
   if(kind==='통화'&&entry.fractionDigits!==null&&(!Number.isInteger(entry.fractionDigits)||entry.fractionDigits<0||entry.fractionDigits>10))throw Error('통화 snapshot의 금액 소수 자릿수를 명시하세요. 미상은 null입니다.');
   byCode.set(entry.code,entry);add(byName,entry.name,entry);if(kind==='품목')add(byBarcode,entry.barcode,entry);
  }
  return {byCode,byName,byBarcode};
 }
 function resolveReference(index,codeToken,nameToken='',tokenMayBeName=false){
  if(!codeToken&&!nameToken)return {status:'blank',code:null,candidates:[],candidatesTruncated:false};
  const unique=entries=>[...new Map(entries.map(x=>[x.code,x])).values()];
  const barcodes=codeToken?index.byBarcode.get(codeToken)||[]:[],tokenNames=codeToken&&tokenMayBeName?index.byName.get(codeToken)||[]:[],names=nameToken?index.byName.get(nameToken)||[]:[];
  const codes=codeToken?unique([...(index.byCode.has(codeToken)?[index.byCode.get(codeToken)]:[]),...barcodes.slice(0,21),...tokenNames.slice(0,21)]):[];
  const combined=unique([...codes,...names.slice(0,21)]),candidates=combined.slice(0,20).map(x=>x.code),candidatesTruncated=barcodes.length>20||tokenNames.length>20||names.length>20||combined.length>20;
  if(codeToken&&!codes.length||nameToken&&!names.length)return {status:'not-found',code:null,candidates,candidatesTruncated};
  if(codes.length>1||names.length>1)return {status:'ambiguous',code:null,candidates,candidatesTruncated};
  if(codes.length&&names.length&&codes[0].code!==names[0].code)return {status:'conflict',code:null,candidates,candidatesTruncated};
  const entry=codes[0]||names[0];return {status:entry.disabled?'disabled-review':'resolved',code:entry.code,name:entry.name,candidates:[entry.code],candidatesTruncated:false};
 }
 function review(matrix,options){
  if(!options||typeof options!=='object'||Array.isArray(options)||!options.masters)throw Error('명시한 검토 정책과 기초자료 snapshot이 필요합니다.');
  const staged=C.stageRaw(matrix,{hasHeader:options.hasHeader,maxRows:options.maxRows}),knownFields=new Set(C.columns.map(x=>x.fieldId));
  if(options.requiredFieldIds!==null&&(!Array.isArray(options.requiredFieldIds)||options.requiredFieldIds.some(id=>!knownFields.has(id))||new Set(options.requiredFieldIds).size!==options.requiredFieldIds.length))throw Error('필수항목 snapshot을 명시하세요. 미상은 null입니다.');
  const items=referenceIndex(options.masters.items,'품목'),partners=referenceIndex(options.masters.partners,'거래처'),currencies=referenceIndex(options.masters.currencies,'통화');
  const headerIndexes=Object.fromEntries(headerFields.map(field=>{const entries=options.masters[field.masterKey];return [field.kind,entries===undefined||entries===null?null:referenceIndex(entries,field.label)];}));
  if(options.quantity!==null&&(!options.quantity||typeof options.quantity!=='object'||Array.isArray(options.quantity)||Object.hasOwn(options.quantity,'rate')))throw Error('회사 수량 정책과 품목별 환산비율을 분리하여 명시하세요.');
  if(options.amounts!==null&&(!options.amounts||typeof options.amounts!=='object'||Array.isArray(options.amounts)||Object.hasOwn(options.amounts,'foreignDigits')))throw Error('회사 금액 정책과 통화별 자릿수를 분리하여 명시하세요.');
  if(options.quantity!==null)C.inspectQuantity({'inv_m$add_qty':'','inv_m$qty':''},{...options.quantity,rate:null});
  if(options.amounts!==null)C.inspectAmounts(Object.fromEntries(Object.values(C.amountFields).map(x=>[x,''])),{...options.amounts,foreignDigits:null});
  const rows=staged.rows.map(row=>{
   const proposedValues={...row.values},issues=[];
   if(row.empty)return {...row,proposedValues,status:'empty',issues,references:null,quantity:null,amounts:null,exchangeRate:null};
   const saveRules=R.inspect(row.values,options.saveRulesSnapshot??R.snapshot());Object.assign(proposedValues,saveRules.proposals);if(options.saveRulesSnapshot!==undefined)issues.push(...saveRules.issues);
   const item=resolveReference(items,row.values[fields.itemCode],row.values[fields.itemName]),partner=resolveReference(partners,row.values[fields.partnerCode],row.values[fields.partnerName]),currency=resolveReference(currencies,row.values[fields.currency],'',true),references={item,partner,currency};
   for(const [kind,result] of Object.entries(references)){
    if(result.status==='resolved'){
     if(kind==='currency')proposedValues[fields.currency]=result.code;
     else {const codeField=kind==='item'?fields.itemCode:fields.partnerCode,nameField=kind==='item'?fields.itemName:fields.partnerName;proposedValues[codeField]=result.code;proposedValues[nameField]=result.name;}
    }else if(result.status!=='blank'||kind==='item')issues.push({code:'reference-'+result.status,kind,fieldId:kind==='item'?fields.itemCode:kind==='partner'?fields.partnerCode:fields.currency,candidates:result.candidates.slice()});
   }
   const header=inspectHeaderReferences(row.values,headerIndexes);Object.assign(references,header.references);Object.assign(proposedValues,header.proposals);issues.push(...header.issues);
   if(options.requiredFieldIds!==null)for(const fieldId of options.requiredFieldIds)if(proposedValues[fieldId]==='')issues.push({code:'required',fieldId});
   const rate=item.status==='resolved'?items.byCode.get(item.code).rate??null:null;
   let quantity;try{quantity=options.quantity===null?{relation:'policy-required',expectedBase:null,saveSupported:false}:C.inspectQuantity(row.values,{...options.quantity,rate});}catch(error){quantity={relation:'rate-invalid',expectedBase:null,message:error.message,saveSupported:false};}
   if(!['matched','base-only'].includes(quantity.relation))issues.push({code:'quantity-'+quantity.relation,fieldId:'inv_m$qty'});
   const foreignDigits=currency.status==='resolved'?currencies.byCode.get(currency.code).fractionDigits:null,amounts=options.amounts===null?null:C.inspectAmounts(row.values,{...options.amounts,foreignDigits});
   if(amounts)issues.push(...amounts.issues.map(x=>({...x})));else issues.push({code:'amount-policy-required'});
   const exchangeRate=C.inspectExchangeRate(row.values['inv_s$exchange_rate']);issues.push(...exchangeRate.issues.map(x=>({...x})));
   return {...row,proposedValues,status:issues.length?'review':'clear',issues,references,quantity,amounts,exchangeRate,saveRules};
  });
  return {rows,columns:staged.columns,hasHeader:staged.hasHeader,rowLimit:staged.rowLimit,rowLimitSource:staged.rowLimitSource,headerReferenceFields:headerFields.map(field=>({kind:field.kind,fieldId:field.fieldId,label:field.label,snapshotKnown:headerIndexes[field.kind]!==null})),summary:{rows:rows.length,empty:rows.filter(x=>x.status==='empty').length,needsReview:rows.filter(x=>x.status==='review').length,withoutDetectedIssues:rows.filter(x=>x.status==='clear').length},requiredPolicyKnown:options.requiredFieldIds!==null,unresolvedContracts:[...(options.quantity===null?['quantity-policy']:[]),...(options.amounts===null?['amount-policy']:[...(options.amounts.priceDigits===null?['price-policy']:[]),...(options.amounts.amountDigits===null?['domestic-amount-policy']:[])]),...(options.requiredFieldIds===null?['required-fields']:[]),...(headerFields.some(field=>headerIndexes[field.kind]===null)?['header-master-snapshot']:[]),'voucher-grouping',...(rows.filter(r=>r.status!=='empty').length&&rows.filter(r=>r.status!=='empty').every(r=>r.saveRules?.resolved)?[]:['save-time-defaults']),'other-header-references','quantity-upload-precedence-and-rounding','partial-failure-and-retry','permissions-and-persistence'],groupingResolved:false,defaultingResolved:rows.some(r=>r.status!=='empty')&&rows.filter(r=>r.status!=='empty').every(r=>r.saveRules?.resolved),businessValidation:false,saveSupported:false,manualLimitNotice:{sourceId:'EC-HELP-UPLOAD-USE-001',text:'최대300건 안내',unitVerified:false,enforcedAsOriginalRowLimit:false}};
 }
 const api=Object.freeze({review});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadPreview=api;
})(typeof globalThis==='object'?globalThis:this);
