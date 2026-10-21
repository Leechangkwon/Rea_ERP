(function(root){
'use strict';
// Source binding is exact canonical JSON, not an authentication signature.
const FORMAT='rea-price-request-comparison', VERSION=2, MAX_VENDORS=5, MAX_LINES=500;
const copy=value=>JSON.parse(JSON.stringify(value));
function fail(message){throw new Error(message);}
function record(value,keys,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(label+' 구조를 확인하세요.');
}
function code(value,label){
 if(typeof value!=='string'||!value||value.length>200||value.trim()!==value||/[\u0000-\u001f]/.test(value))fail(label+' 식별자를 확인하세요.');
 return value;
}
function denseArray(value,label){
 if(!Array.isArray(value))fail(label+' 배열을 확인하세요.');
 for(let index=0;index<value.length;index++)if(!Object.hasOwn(value,index)||value[index]===undefined)fail(label+' 배열의 빈 항목을 확인하세요.');
 return value;
}
function lineIdentity(value){
 // Existing InventoryCore line IDs are opaque: spaces are significant.
 if(typeof value!=='string'||!value.length||value.length>200)fail('품목행 식별자를 확인하세요.');
 return value;
}
function canonical(value){
 if(value===null)return 'null';
 if(['string','boolean'].includes(typeof value))return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return '['+denseArray(value,'원본').map(canonical).join(',')+']';
 if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 fail('직렬화할 수 없는 단가요청 원본입니다.');
}
function decimal(value,digits=10,positive=false){
 if(typeof value==='number'){
  if(!Number.isFinite(value)||value<0)fail('단가 또는 수량을 확인하세요.');
  value=String(value);
  if(/[eE]/.test(value)){
   const [mantissa,exponent]=value.toLowerCase().split('e'),parts=mantissa.split('.'),all=parts.join(''),point=parts[0].length+Number(exponent);
   value=point<=0?'0.'+'0'.repeat(-point)+all:point>=all.length?all+'0'.repeat(point-all.length):all.slice(0,point)+'.'+all.slice(point);
  }
 }
 if(typeof value!=='string'||value.length>40||!/^\d+(?:\.\d+)?$/.test(value))fail('단가 또는 수량은 0 이상의 십진수로 입력하세요.');
 let [whole,fraction='']=value.split('.');whole=whole.replace(/^0+(?=\d)/,'');fraction=fraction.replace(/0+$/,'');
 if(fraction.length>digits||whole.length>13)fail('단가 또는 수량의 소수 자릿수와 범위를 확인하세요.');
 const scaled=BigInt(whole+fraction.padEnd(digits,'0'));
 if(scaled>1000000000000n*10n**BigInt(digits)||positive&&scaled===0n)fail('단가 또는 수량의 범위를 확인하세요.');
 return whole+(fraction?'.'+fraction:'');
}
function sourceOf(request){
 if(!request||request.type!=='pricerequest')fail('저장된 단가요청 원본을 선택하세요.');
 code(request.id,'단가요청');
 if(!Array.isArray(request.lines)||request.lines.length<1||request.lines.length>MAX_LINES)fail('단가요청은 1~500행이어야 합니다.');
 const encoded=canonical(request);if(encoded.length>2000000)fail('단가요청 원본 크기를 확인하세요.');
 const keys=new Set();
 const lines=request.lines.map((line,index)=>{
  if(!line||typeof line!=='object'||Array.isArray(line))fail('단가요청 품목행을 확인하세요.');
  const lineKey=line.lineId===undefined?'row:'+index:'id:'+lineIdentity(line.lineId);
  if(keys.has(lineKey))fail('중복된 품목행 식별자입니다.');keys.add(lineKey);
  return {lineKey,item:code(line.item,'품목'),qty:decimal(line.qty,6,true),requestedPrice:decimal(line.price)};
 });
 return {documentId:request.id,fingerprint:encoded,lines};
}
function priceFor(state,lineKey,source,vendorCode){
 const line=state.source.lines.find(row=>row.lineKey===lineKey);if(!line)fail('단가요청 품목행이 없습니다.');
 if(source==='request'){
  if(vendorCode!==null)fail('요청단가 선택에는 거래처를 지정하지 않습니다.');
  return line.requestedPrice;
 }
 if(source!=='vendor')fail('확정단가 선택 종류를 확인하세요.');
 const vendor=state.vendors.find(row=>row.code===vendorCode);if(!vendor)fail('요청 거래처가 없습니다.');
 const price=vendor.received.find(row=>row.lineKey===lineKey)?.price;
 if(price===null||price===undefined)fail('아직 회신하지 않은 단가는 선택할 수 없습니다.');
 return price;
}
function validate(state,request){
 record(state,['format','version','revision','source','vendors','selections'],'단가 비교');
 if(state.format!==FORMAT||state.version!==VERSION||!Number.isSafeInteger(state.revision)||state.revision<0)fail('단가 비교 버전과 수정번호를 확인하세요.');
 const source=sourceOf(request);
 if(canonical(state.source)!==canonical(source))fail('단가요청 원본이 변경되었습니다. 비교 내용을 다시 확인하세요.');
 if(!Array.isArray(state.vendors)||state.vendors.length<1||state.vendors.length>MAX_VENDORS)fail('요청 거래처는 1~5개를 선택하세요.');
 const vendors=new Set();
 for(const vendor of denseArray(state.vendors,'거래처')){
  record(vendor,['code','inputClosed','received'],'거래처 회신');code(vendor.code,'거래처');
  if(vendors.has(vendor.code))fail('중복된 요청 거래처입니다.');vendors.add(vendor.code);
  if(typeof vendor.inputClosed!=='boolean'||!Array.isArray(vendor.received)||vendor.received.length!==source.lines.length)fail('거래처 회신 행과 마감 상태를 확인하세요.');
  denseArray(vendor.received,'수취단가').forEach((row,index)=>{
   record(row,['lineKey','price'],'수취단가');
   if(row.lineKey!==source.lines[index].lineKey||row.price!==null&&decimal(row.price)!==row.price)fail('수취단가 행과 저장 형식을 확인하세요.');
  });
 }
 if(!Array.isArray(state.selections)||state.selections.length>source.lines.length)fail('확정단가 선택을 확인하세요.');
 const selected=new Set();
 for(const row of denseArray(state.selections,'확정단가')){
  record(row,['lineKey','source','vendorCode','price'],'확정단가');
  if(selected.has(row.lineKey))fail('중복된 확정단가 선택입니다.');selected.add(row.lineKey);
  if(row.price!==priceFor(state,row.lineKey,row.source,row.vendorCode))fail('선택한 단가가 변경되었습니다. 다시 확인하세요.');
 }
 return true;
}
function create(request,vendorCodes){
 const source=sourceOf(request);
 if(!Array.isArray(vendorCodes)||vendorCodes.length<1||vendorCodes.length>MAX_VENDORS)fail('요청 거래처는 1~5개를 선택하세요.');
 const state={format:FORMAT,version:VERSION,revision:0,source,vendors:denseArray(vendorCodes,'거래처').map(value=>({code:code(value,'거래처'),inputClosed:false,received:source.lines.map(row=>({lineKey:row.lineKey,price:null}))})),selections:[]};
 validate(state,request);return state;
}
function command(state,request,input){
 validate(state,request);
 const fields={reply:['vendorCode','lineKey','price'],replyMany:['vendorCode','replies'],close:['vendorCode','closed'],select:['lineKey','source','vendorCode'],selectMany:['selections'],'clear-selection':['lineKey']};
 if(!input||!Object.hasOwn(fields,input.type))fail('지원하지 않는 단가 비교 작업입니다.');
 record(input,['type','expectedRevision',...fields[input.type]],'단가 비교 작업');
 if(input.expectedRevision!==state.revision||!Number.isSafeInteger(input.expectedRevision)||state.revision===Number.MAX_SAFE_INTEGER)fail('단가 비교 수정번호가 변경되었습니다. 다시 불러오세요.');
 const next=copy(state),vendor=next.vendors.find(row=>row.code===input.vendorCode);
 if(['reply','replyMany','close'].includes(input.type)&&!vendor)fail('요청 거래처가 없습니다.');
 if(!['close','selectMany','replyMany'].includes(input.type)&&!next.source.lines.some(row=>row.lineKey===input.lineKey))fail('단가요청 품목행이 없습니다.');
 if(input.type==='reply'||input.type==='replyMany'){
  if(vendor.inputClosed)fail('입력 마감된 거래처입니다. 먼저 마감을 취소하세요.');
   const replies=input.type==='replyMany'?denseArray(input.replies,'수취단가'):[{lineKey:input.lineKey,price:input.price}];
   if(replies.length<1||replies.length>MAX_LINES)fail('수취단가 입력은 1~500행이어야 합니다.');
   const seen=new Set();
   for(const reply of replies){
    record(reply,['lineKey','price'],'수취단가');if(seen.has(reply.lineKey))fail('중복된 수취단가 행입니다.');seen.add(reply.lineKey);
    const received=vendor.received.find(row=>row.lineKey===reply.lineKey);if(!received)fail('단가요청 품목행이 없습니다.');
    const price=reply.price===null?null:decimal(reply.price);
    if(price!==received.price&&next.selections.some(row=>row.lineKey===reply.lineKey&&row.source==='vendor'&&row.vendorCode===input.vendorCode))fail('확정단가 선택을 먼저 해제한 뒤 수취단가를 변경하세요.');
    received.price=price;
   }
 }else if(input.type==='close'){
  if(typeof input.closed!=='boolean')fail('입력 마감 상태를 확인하세요.');vendor.inputClosed=input.closed;
 }else if(input.type==='selectMany'){
  const selections=denseArray(input.selections,'확정단가 선택');
  if(selections.length<1||selections.length>MAX_LINES)fail('확정단가 선택은 1~500행이어야 합니다.');
  const seen=new Set();
  for(const choice of selections){
   record(choice,['lineKey','source','vendorCode'],'확정단가 선택');
   if(seen.has(choice.lineKey))fail('중복된 확정단가 선택입니다.');seen.add(choice.lineKey);
   const price=priceFor(next,choice.lineKey,choice.source,choice.vendorCode);
   next.selections=next.selections.filter(row=>row.lineKey!==choice.lineKey).concat({...choice,price});
  }
  next.selections.sort((a,b)=>next.source.lines.findIndex(row=>row.lineKey===a.lineKey)-next.source.lines.findIndex(row=>row.lineKey===b.lineKey));
 }else if(input.type==='select'){
  const price=priceFor(next,input.lineKey,input.source,input.vendorCode),selection={lineKey:input.lineKey,source:input.source,vendorCode:input.vendorCode,price};
  next.selections=next.selections.filter(row=>row.lineKey!==input.lineKey).concat(selection);
  next.selections.sort((a,b)=>next.source.lines.findIndex(row=>row.lineKey===a.lineKey)-next.source.lines.findIndex(row=>row.lineKey===b.lineKey));
 }else next.selections=next.selections.filter(row=>row.lineKey!==input.lineKey);
 next.revision++;validate(next,request);return next;
}
function comparison(state,request){
 validate(state,request);
 return state.source.lines.map(line=>({lineKey:line.lineKey,item:line.item,qty:line.qty,requestedPrice:line.requestedPrice,received:state.vendors.map(vendor=>({vendorCode:vendor.code,price:vendor.received.find(row=>row.lineKey===line.lineKey).price,inputClosed:vendor.inputClosed})),confirmed:copy(state.selections.find(row=>row.lineKey===line.lineKey)||null)}));
}
// Optional companion storage: immutable snapshots retain historical replies after source edits.
const STORE_VERSION=1,MAX_RECORDS=10000;
function validateStore(value){
 record(value,['version','records'],'단가 비교 보관');
 if(value.version!==STORE_VERSION||!Array.isArray(value.records)||value.records.length>MAX_RECORDS)fail('단가 비교 보관 버전과 건수를 확인하세요.');
 const ids=new Set();
 for(const row of denseArray(value.records,'단가 비교 보관')){
  record(row,['documentId','snapshot','comparison'],'단가 비교 보관 항목');code(row.documentId,'단가요청');
  if(ids.has(row.documentId)||row.documentId!==row.snapshot?.id)fail('단가 비교 원본 식별자를 확인하세요.');
  ids.add(row.documentId);validate(row.comparison,row.snapshot);
 }
 return copy(value);
}
function storeOf(db){
 return Object.hasOwn(db.settings,'priceRequests')?validateStore(db.settings.priceRequests):{version:STORE_VERSION,records:[]};
}
function sourceStatus(row,db,C){
 const current=db.documents.find(doc=>doc.id===row.documentId);
 if(!current||current.type!=='pricerequest')return 'missing-source';
 if(!C.active(current))return 'inactive-source';
 if(canonical(current)!==row.comparison.source.fingerprint)return 'source-changed';
 if(row.comparison.vendors.some(vendor=>{const registered=C.master(db,'partners',vendor.code);return !registered||registered.disabled;}))return 'vendor-unavailable';
 return 'ready';
}
function view(db,documentId,C){
 code(documentId,'단가요청');
 const row=storeOf(db).records.find(row=>row.documentId===documentId);
 if(!row)return null;
 return {documentId,status:sourceStatus(row,db,C),revision:row.comparison.revision,rows:comparison(row.comparison,row.snapshot),snapshot:copy(row.snapshot)};
}
function storeCommand(db,input,C){
 const fields={start:['vendorCodes'],reply:['expectedRevision','vendorCode','lineKey','price'],replyMany:['expectedRevision','vendorCode','replies'],close:['expectedRevision','vendorCode','closed'],select:['expectedRevision','lineKey','source','vendorCode'],selectMany:['expectedRevision','selections'],'clear-selection':['expectedRevision','lineKey']};
 if(!input||!Object.hasOwn(fields,input.action))fail('지원하지 않는 단가 비교 보관 작업입니다.');
 record(input,['action','documentId',...fields[input.action]],'단가 비교 보관 작업');code(input.documentId,'단가요청');
 const store=storeOf(db),existing=store.records.find(row=>row.documentId===input.documentId),source=db.documents.find(doc=>doc.id===input.documentId);
 if(input.action==='start'){
  if(existing)fail('이미 보관된 비교 자료입니다. 기존 회신을 초기화할 수 없습니다.');
  if(store.records.length>=MAX_RECORDS)fail('단가 비교 보관 한도를 초과했습니다.');
  if(!source||source.type!=='pricerequest'||!C.active(source))fail('활성 상태의 저장된 단가요청을 선택하세요.');
  const state=create(source,input.vendorCodes);
  for(const vendor of state.vendors){const registered=C.master(db,'partners',vendor.code);if(!registered||registered.disabled)fail('사용 중인 등록 거래처를 선택하세요.');}
  store.records.push({documentId:source.id,snapshot:copy(source),comparison:state});
 }else{
  if(!existing)fail('먼저 단가 비교 자료를 시작하세요.');
  if(sourceStatus(existing,db,C)!=='ready')fail('단가요청 원본이 변경되었거나 원본·거래처가 사용 불가 상태입니다. 보관된 회신을 확인하세요.');
  const {action,documentId,...payload}=input;
  existing.comparison=command(existing.comparison,source,{type:action,...payload});
 }
 validateStore(store);
 return {store,result:view({...db,settings:{...db.settings,priceRequests:store}},input.documentId,C)};
}
const api={FORMAT,VERSION,MAX_VENDORS,MAX_LINES,STORE_VERSION,MAX_RECORDS,create,validate,command,comparison,validateStore,view,storeCommand};
if(typeof module==='object'&&module.exports)module.exports=api;else root.PriceRequestCore=api;
})(typeof globalThis==='object'?globalThis:this);
