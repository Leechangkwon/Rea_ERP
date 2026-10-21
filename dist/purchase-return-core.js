(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
 const clone=C.clone,marker='purchase-return-draft-v1',own=(v,k)=>Object.hasOwn(v,k);
 const keys=(row,allowed)=>Object.keys(row).every(k=>allowed.includes(k));
 function sourceOf(db,id){
  const source=db.documents.find(d=>d.id===id);
  if(!source||source.type!=='purchase'||!C.active(source))throw Error('반품할 진행 중인 원구매를 선택하세요.');
  if(['vatCalculation','vatAdjustment','vatConfirmation'].some(k=>own(source,k)))throw Error('연구 단계 부가세 전표의 복사반품은 아직 연결하지 않았습니다.');
  if(source.lines.some(l=>l.lineId)&&(!source.lines.every(l=>typeof l.lineId==='string'&&l.lineId)||new Set(source.lines.map(l=>l.lineId)).size!==source.lines.length))throw Error('원구매의 품목행 구분을 확인하세요.');
  if(!source.lines.some(l=>Number(l.qty)>0)||source.lines.some(l=>Number(l.qty)<=0))throw Error('양수 수량의 원구매를 선택하세요.');
  if(!source.lines.every(l=>l.lineId)&&new Set(source.lines.map(l=>l.item)).size!==source.lines.length)throw Error('원구매의 품목행을 구분할 수 없습니다.');
  return source;
 }
 function relatedSnapshot(db,id){return JSON.stringify(db.documents.filter(d=>d.sourceId===id&&d.type==='purchasereturn').slice().sort((a,b)=>a.id.localeCompare(b.id)));}
 const lineKey=(line,index)=>line.lineId?'id:'+line.lineId:'index:'+index;
 function context(db,draft){
  if(!draft||typeof draft!=='object'||Array.isArray(draft)||draft.kind!==marker||!keys(draft,['kind','sourceId','documentId','date','lines','sourceSnapshot','relatedSnapshot','documentSnapshot']))throw Error('반품 초안 형식을 확인하세요.');
  const source=sourceOf(db,draft.sourceId);
  if(JSON.stringify(source)!==draft.sourceSnapshot||relatedSnapshot(db,source.id)!==draft.relatedSnapshot)throw Error('원구매 또는 연결 반품이 변경됐습니다. 다시 열어주세요.');
  let existing;
  if(draft.documentId!==undefined){existing=db.documents.find(d=>d.id===draft.documentId);if(!existing||existing.type!=='purchasereturn'||existing.settlementMode!=='credit'||existing.sourceId!==source.id||JSON.stringify(existing)!==draft.documentSnapshot)throw Error('수정할 차감반품이 변경됐습니다. 다시 열어주세요.');if(existing.accounted)throw Error('회계반영을 취소한 후 수정하세요.');}
  else if(draft.documentSnapshot!==undefined)throw Error('반품 초안의 저장 전표를 확인하세요.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date||'')||!Number.isFinite(Date.parse(draft.date))||new Date(draft.date).toISOString().slice(0,10)!==draft.date)throw Error('반품 일자를 확인하세요.');
  if(!Array.isArray(draft.lines)||!draft.lines.length||draft.lines.length>source.lines.length)throw Error('반품 품목행을 확인하세요.');
  const originals=new Map(source.lines.map((line,index)=>[lineKey(line,index),line])),seen=new Set(),selected=[];
  for(const row of draft.lines){
   if(!row||typeof row!=='object'||Array.isArray(row)||!keys(row,['key','qty'])||!originals.has(row.key)||seen.has(row.key))throw Error('반품의 원구매 품목행을 확인하세요.');
   seen.add(row.key);const value=row.qty;
   if(!['number','string'].includes(typeof value)||typeof value==='string'&&!value.trim()||!Number.isFinite(Number(value))||Number(value)>0||Math.abs(Number(value))>1e12||C.quantity(Number(value))!==Number(value))throw Error('반품 수량은 0 또는 음수로 입력하세요.');
   if(Number(value)!==0)selected.push({original:originals.get(row.key),qty:-Number(value)});
  }
  if(!selected.length)throw Error('반품 수량을 입력하세요.');
  return {source,existing,selected};
 }
 function create(db,sourceId,date=C.today()){
  const source=sourceOf(db,sourceId),remaining=C.remaining(db,source,'purchasereturn');
  const lines=remaining.flatMap((row,index)=>Number(row.qty)>0?[{key:lineKey(source.lines[index],index),qty:-Number(row.qty)}]:[]);
  if(!lines.length)throw Error('반품할 잔량이 없습니다.');
  return {kind:marker,sourceId,date,lines,sourceSnapshot:JSON.stringify(source),relatedSnapshot:relatedSnapshot(db,sourceId)};
 }
 function edit(db,id){
  const existing=db.documents.find(d=>d.id===id);
  if(!existing||existing.type!=='purchasereturn'||existing.settlementMode!=='credit')throw Error('수정할 차감반품을 선택하세요.');
  const source=sourceOf(db,existing.sourceId);if(existing.accounted)throw Error('회계반영을 취소한 후 수정하세요.');
  const lines=existing.lines.map(line=>{const matches=source.lines.flatMap((original,index)=>(original.item===line.item&&(!line.sourceLineId||original.lineId===line.sourceLineId))?[{original,index}]:[]);if(matches.length!==1)throw Error('반품의 원구매 품목행을 구분할 수 없습니다.');return {key:lineKey(matches[0].original,matches[0].index),qty:-Number(line.qty)};});
  return {kind:marker,sourceId:source.id,documentId:id,date:existing.date,lines,sourceSnapshot:JSON.stringify(source),relatedSnapshot:relatedSnapshot(db,source.id),documentSnapshot:JSON.stringify(existing)};
 }
 function operation(db,draft){
  const {source,existing,selected}=context(db,draft);
  if(existing){
   const doc=clone(existing);doc.date=draft.date;
   // Existing row metadata is immutable here. Dropping a row is represented by zero or removal.
   doc.lines=selected.map(({original,qty})=>{const rows=existing.lines.filter(l=>l.item===original.item&&(!original.lineId||l.sourceLineId===original.lineId));if(rows.length!==1)throw Error('저장된 반품에 없는 품목은 새 반품으로 입력하세요.');return {...clone(rows[0]),qty};});
   return {op:'document',payload:doc};
  }
  const doc=clone(source);for(const key of ['id','generatedFrom','planGeneration','confirmation','progress','createdAt','modifiedAt','createdBy','modifiedBy'])delete doc[key];
  Object.assign(doc,{type:'purchasereturn',sourceId:source.id,date:draft.date,settlementMode:'credit',status:'진행',accounted:false,autoConsume:false});
  doc.lines=selected.map(({original,qty})=>{const row={...clone(original),qty};delete row.progress;if(original.lineId)row.sourceLineId=original.lineId;else delete row.sourceLineId;return row;});
  return {op:'document',payload:doc};
 }
 function save(db,draft,policy){const {op,payload}=operation(db,draft);return C.command(db,op,payload,policy);}
 function presentation(document){
  if(document?.type!=='purchasereturn'||document.settlementMode!=='credit')throw Error('차감반품 전표를 확인하세요.');
  const lines=document.lines.map(line=>{const amounts=C.effectiveLineTotals(document,line);if(!(Number(line.qty)>0)||['supply','tax','total'].some(k=>!Number.isFinite(amounts[k])||amounts[k]<0))throw Error('저장된 차감반품의 양수 금액을 확인하세요.');return {...clone(line),qty:-Number(line.qty),supply:amounts.supply===0?0:-amounts.supply,tax:amounts.tax===0?0:-amounts.tax,total:amounts.total===0?0:-amounts.total};});
  const totals=lines.reduce((out,line)=>{out.qty=C.quantity(out.qty+line.qty);for(const k of ['supply','tax','total'])out[k]=C.money(out[k]+line[k]);return out;},{qty:0,supply:0,tax:0,total:0});
  return {id:document.id,date:document.date,sourceId:document.sourceId,partner:document.partner,warehouse:document.warehouse,currency:document.currency||'KRW',lines,totals};
 }
 function preview(db,draft,policy){return presentation(save(db,draft,policy).result);}
 const api={create,edit,operation,save,preview,presentation};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PurchaseReturnCore=api;
})(typeof globalThis==='object'?globalThis:this);
