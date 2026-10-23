(function(root){
 'use strict';
 const F=typeof module==='object'&&module.exports?require('./form-core.js'):root.FormCore;
 const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
 const copy=value=>JSON.parse(JSON.stringify(value));
 const blank=value=>value===undefined||value===null||value==='';
 const types=['text','number','date','checkbox'];
 const validId=id=>typeof id==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(id)&&!['__proto__','prototype','constructor'].includes(id);
 function catalog(db,type,context,record={},environment=F.environment()){
  if(!['order','request'].includes(type)||!['input','lines'].includes(context)||record.type&&record.type!==type)throw Error('주문→발주요청 항목 구분을 확인하세요.');
  const form=F.effective(db.settings?.customization,'doc:'+type,context,type==='order'?[F.field('memo','적요','text')]:[],record,environment);
  const fields=form.fields.filter(f=>validId(f.id)&&f.visible===true&&!f.readonly&&!f.calculated&&!f.protected&&!f.formula&&types.includes(f.type)&&(f.custom===true||type==='order'&&f.id==='memo'));
  if(new Set(fields.map(f=>f.id)).size!==fields.length)throw Error('항목 목록에 같은 ID가 있습니다.');
  return {formId:form.id,context,fields:copy(fields)};
 }
 function activeRule(config){
  if(config===undefined||config===null)return null;
  if(typeof config!=='object'||Array.isArray(config)||config.rules!==undefined&&!Array.isArray(config.rules))throw Error('메뉴 매핑 설정을 확인하세요.');
  const rules=(config.rules||[]).filter(r=>r&&r.from==='order'&&r.to==='request'&&r.enabled!==false);
  if(!rules.some(r=>Object.hasOwn(r,'fieldLinks')))return null;
  const S=typeof module==='object'&&module.exports?require('./self-core.js'):root.SelfCore;
  if(!S)throw Error('메뉴 매핑 저장 규칙을 다시 불러오세요.');
  const selected=S.validateConfig('menuMappings',{rules}).rules.filter(r=>r.enabled);
  if(!selected.length)return null;
  if(selected.length!==1)throw Error('주문→발주요청 매핑을 한 건만 지정하세요.');
  return selected[0].fieldLinks?.entries.length?selected[0]:null;
 }
 function byteLength(value){let bytes=0;for(const c of JSON.stringify(value)){const n=c.codePointAt(0);bytes+=n<=127?1:n<=2047?2:n<=65535?3:4;}return bytes;}
 function valueValid(field,value,target=false){
  if(field.type==='text'&&(typeof value!=='string'||value.length>20000)||field.type==='number'&&!(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))||field.type==='date'&&typeof value!=='string'||field.type==='checkbox'&&typeof value!=='boolean')throw Error(field.label+': 항목 형식과 검토 길이를 확인하세요.');
  if(target&&field.type==='text'&&(/\r/.test(value)||!field.multiline&&/\n/.test(value)))throw Error(field.label+': 줄바꿈을 그대로 표시할 수 없습니다. LF 줄바꿈의 장문 항목을 선택하세요.');
  F.check([field],{[field.id]:value});
 }
 function stage(db,draft,incoming,selections,config,options={}){
  if(draft?.type!=='request')return null;
  const documents=new Map((db.documents||[]).map(d=>[d.id,d])),ids=[...new Set((selections||[]).map(s=>s.documentId))];
  if(!ids.some(id=>documents.get(id)?.type==='order'))return null;
  const rule=activeRule(config);if(!rule)return null;
  if(options.mode!=='copy'||options.grouping!=='line'||options.history===true||options.adoptHeader===true)throw Error('항목 매핑은 상단을 유지하는 주문 라인별 복사만 지원합니다.');
  if(!Array.isArray(incoming)||!Array.isArray(selections)||incoming.length!==selections.length||incoming.length>500||!ids.length)throw Error('매핑할 선택 행을 확인하세요.');
  const sources=ids.map(id=>documents.get(id));if(sources.some(d=>!d||d.type!=='order'||!C.active(d)))throw Error('진행 가능한 주문만 선택해 항목을 매핑하세요.');
  const headerLinks=rule.fieldLinks.entries.filter(e=>e.target.context==='input'),lineLinks=rule.fieldLinks.entries.filter(e=>e.target.context==='lines');
  if(headerLinks.length&&sources.length!==1)throw Error('상단 항목 매핑은 주문 한 건씩 적용하세요.');
  const environment=options.environment||F.environment(),target=copy(draft),lines=copy(incoming),proposals=[];let usedBytes=0,customChanged=false;
  const forms=record=>JSON.stringify(['input','lines'].map(context=>catalog(db,'request',context,record,environment).formId)),beforeForms=forms(target);
  function apply(source,sourceLine,targetLine,links,context){
   const from=catalog(db,'order',context,source,environment),to=catalog(db,'request',context,target,environment),sourceRecord=context==='input'?source:sourceLine,targetRecord=context==='input'?target:targetLine;
   const original=targetRecord.custom;if(original!==undefined&&original!==null&&(typeof original!=='object'||Array.isArray(original)))throw Error('목표 추가항목 자료를 확인하세요.');
   const custom=copy(original||{});let changed=false;
   for(const entry of links){
    const fromField=from.fields.find(f=>f.id===entry.source.id),toField=to.fields.find(f=>f.id===entry.target.id);
    if(!fromField||!toField||toField.custom!==true)throw Error('등록된 표시·편집 가능 추가항목을 다시 확인하세요.');
    if(fromField.type!==toField.type)throw Error(fromField.label+' → '+toField.label+': 같은 항목 형식만 연결할 수 있습니다.');
    const values=fromField.custom?sourceRecord.custom:sourceRecord,value=values&&Object.hasOwn(values,fromField.id)?values[fromField.id]:undefined;
    const proposal={context,documentId:source.id,...(sourceLine?.lineId?{sourceLineId:sourceLine.lineId}:{}),source:fromField.id,target:toField.id,status:'blank'};
    if(blank(value)){proposals.push(proposal);continue;}
    valueValid(fromField,value);valueValid(toField,value,true);usedBytes+=byteLength(value);if(usedBytes>1048576)throw Error('매핑값이 로컬 검토 한도1MiB를 초과했습니다. 나누어 적용하세요.');
    const previous=Object.hasOwn(custom,toField.id)?custom[toField.id]:F.defaultValue(toField,C.today());
    if(!blank(previous)&&!Object.is(previous,value))throw Error(toField.label+': 기존 값 또는 기본값과 다릅니다. 현재 초안을 유지했습니다.');
    const write=!Object.hasOwn(custom,toField.id)||!Object.is(custom[toField.id],value);if(write){custom[toField.id]=value;changed=true;}
    proposals.push({...proposal,value,status:write?'proposed':'unchanged'});
   }
   if(changed)targetRecord.custom=custom;return changed;
  }
  if(headerLinks.length)customChanged=apply(sources[0],null,null,headerLinks,'input');
  if(forms(target)!==beforeForms)throw Error('매핑으로 선택 양식이 바뀝니다. 항목 설정을 다시 확인하세요.');
  if(lineLinks.length)for(const [index,selection]of selections.entries()){
   const source=documents.get(selection.documentId),matches=source.lines.filter(l=>l.item===selection.item&&(!selection.lineId||l.lineId===selection.lineId));
   if(matches.length!==1||lines[index].item!==selection.item)throw Error('매핑할 주문 원본 라인을 확인하세요.');
   apply(source,matches[0],lines[index],lineLinks,'lines');
  }
  return {ruleId:rule.id,custom:target.custom,customChanged,lines,proposals};
 }
 const api=Object.freeze({catalog,stage});if(typeof module==='object'&&module.exports)module.exports=api;else root.MappingCore=api;
})(typeof globalThis==='object'?globalThis:this);
