(function(root){
 'use strict';
 const definitions=Object.freeze([
  Object.freeze({key:'date',fieldId:'inv_s$data_dt_no',label:'일자',mode:'dateMode'}),
  Object.freeze({key:'transaction',fieldId:'inv_s$trx_type',label:'거래유형',mode:'transactionMode'}),
  Object.freeze({key:'currency',fieldId:'inv_s$foreign_currency',label:'통화',mode:'currencyMode'})
 ]);
 const clone=value=>JSON.parse(JSON.stringify(value));
 function empty(){return {version:1,dateMode:null,dateInitial:{kind:'unknown',value:''},transactionMode:null,transactionInitial:{kind:'unknown',value:''},currencyMode:null};}
 function record(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error(label+' 구조를 확인하세요.');}
 function validDate(value){if(typeof value!=='string'||!/^\d{8}$/.test(value))return false;const y=Number(value.slice(0,4)),m=Number(value.slice(4,6)),d=Number(value.slice(6,8)),days=[31,(y%4===0&&y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return y>0&&m>=1&&m<=12&&d>=1&&d<=days[m-1];}
 function validate(raw){
  const seed=empty();record(raw,Object.keys(seed),'업로드 저장시값변경');if(raw.version!==1)throw Error('업로드 저장시값변경 버전을 확인하세요.');
  for(const key of ['dateMode','transactionMode','currencyMode'])if(raw[key]!==null&&!(key==='currencyMode'?['keep','none']:['keep','initial']).includes(raw[key]))throw Error('공란 처리 방식을 확인하세요.');
  for(const key of ['dateInitial','transactionInitial']){const initial=raw[key];record(initial,['kind','value'],'업로드 초기값');const kinds=key==='dateInitial'?['unknown','today','literal']:['unknown','literal'];if(!kinds.includes(initial.kind)||typeof initial.value!=='string'||initial.kind!=='literal'&&initial.value!=='')throw Error('업로드 초기값 종류와 값을 확인하세요.');if(initial.kind==='literal'&&!(key==='dateInitial'?validDate(initial.value):['21','22'].includes(initial.value)))throw Error(key==='dateInitial'?'일자 초기값은 유효한 YYYYMMDD로 입력하세요.':'거래유형 초기값은21 또는22로 지정하세요.');}
  return clone(raw);
 }
 function snapshot(raw,context){
  const rules=raw===undefined||raw===null?empty():validate(raw),ctx=context||{},company=typeof ctx.company==='string'&&ctx.company.trim()&&ctx.company.length<=60?ctx.company:null,revision=Number.isSafeInteger(ctx.revision)&&ctx.revision>=0?ctx.revision:null;
  const date=typeof ctx.today==='string'?ctx.today.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1$2$3'):null;
  const source={kind:'company-config',company,revision,asOfDate:validDate(date)?date:null,timeZone:typeof ctx.timeZone==='string'&&ctx.timeZone.length>0&&ctx.timeZone.length<=100?ctx.timeZone:null};
  return {version:1,rules:clone(rules),source};
 }
 function inspect(values,snap){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('검토할 상단 항목을 확인하세요.');record(snap,['version','rules','source'],'저장시규칙 snapshot');if(snap.version!==1)throw Error('저장시규칙 snapshot 버전을 확인하세요.');const rules=validate(snap.rules);record(snap.source,['kind','company','revision','asOfDate','timeZone'],'저장시규칙 출처');const src=snap.source,sourceKnown=src.kind==='company-config'&&typeof src.company==='string'&&src.company.length>0&&src.company.length<=60&&Number.isSafeInteger(src.revision)&&src.revision>=0;
  const fields=[],proposals={},issues=[];
  for(const definition of definitions){const value=values[definition.fieldId];if(typeof value!=='string')throw Error('저장시규칙 입력값은 문자열이어야 합니다.');const mode=rules[definition.mode],result={...definition,rawValue:value,mode,status:'kept',proposal:{kind:'value',value},origin:'explicit'};
   if(value===''){
    result.origin='blank';
    if(!sourceKnown||mode===null){result.status='policy-required';result.proposal={kind:'unknown'};}
    else if(mode==='none'){result.status='none-proposed';result.proposal={kind:'none'};result.origin='save-rule-none';}
    else if(mode==='initial'){
     const initial=rules[definition.key==='date'?'dateInitial':'transactionInitial'];let candidate=null,origin='unknown-initial';
     if(initial.kind==='literal'){candidate=initial.value;origin='company-initial-literal';}
     else if(initial.kind==='today'&&validDate(src.asOfDate)&&typeof src.timeZone==='string'&&src.timeZone){candidate=src.asOfDate;origin='company-initial-today';}
     if(candidate===null){result.status='initial-required';result.proposal={kind:'unknown'};}
     else {result.status='initial-proposed';result.proposal={kind:'value',value:candidate};result.origin=origin;proposals[definition.fieldId]=candidate;}
    }else result.origin='save-rule-keep';
   }
   if(result.status==='policy-required'||result.status==='initial-required')issues.push({code:'save-rule-'+result.status,fieldId:definition.fieldId,message:definition.label+': '+(result.status==='policy-required'?'저장시규칙을 설정하세요.':'초기값 공급원을 확인하세요.')});
   fields.push(result);
  }
  return {version:1,source:clone(src),fields,proposals,issues,policyKnown:sourceKnown&&definitions.every(d=>rules[d.mode]!==null),resolved:sourceKnown&&definitions.every(d=>rules[d.mode]!==null)&&issues.length===0,businessValidation:false,saveSupported:false};
 }
 const api=Object.freeze({empty,validate,snapshot,inspect,validDate,definitions});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadSaveRules=api;
})(typeof globalThis==='object'?globalThis:this);
