"use strict";
// Independent contract model only. Not connected to ERP storage, UI, mail or orders.
const {createHash}=require('node:crypto');
const FORMAT='rea-price-request-comparison', VERSION=1, MAX_VENDORS=5, MAX_LINES=500;
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
 return {documentId:request.id,fingerprint:createHash('sha256').update(encoded).digest('hex'),lines};
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
 const fields={reply:['vendorCode','lineKey','price'],close:['vendorCode','closed'],select:['lineKey','source','vendorCode'],'clear-selection':['lineKey']};
 if(!input||!Object.hasOwn(fields,input.type))fail('지원하지 않는 단가 비교 작업입니다.');
 record(input,['type','expectedRevision',...fields[input.type]],'단가 비교 작업');
 if(input.expectedRevision!==state.revision||!Number.isSafeInteger(input.expectedRevision)||state.revision===Number.MAX_SAFE_INTEGER)fail('단가 비교 수정번호가 변경되었습니다. 다시 불러오세요.');
 const next=copy(state),vendor=next.vendors.find(row=>row.code===input.vendorCode);
 if(['reply','close'].includes(input.type)&&!vendor)fail('요청 거래처가 없습니다.');
 if(input.type!=='close'&&!next.source.lines.some(row=>row.lineKey===input.lineKey))fail('단가요청 품목행이 없습니다.');
 if(input.type==='reply'){
  if(vendor.inputClosed)fail('입력 마감된 거래처입니다. 먼저 마감을 취소하세요.');
  const price=input.price===null?null:decimal(input.price),received=vendor.received.find(row=>row.lineKey===input.lineKey);
  if(price!==received.price&&next.selections.some(row=>row.lineKey===input.lineKey&&row.source==='vendor'&&row.vendorCode===input.vendorCode))fail('확정단가 선택을 먼저 해제한 뒤 수취단가를 변경하세요.');
  received.price=price;
 }else if(input.type==='close'){
  if(typeof input.closed!=='boolean')fail('입력 마감 상태를 확인하세요.');vendor.inputClosed=input.closed;
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
module.exports={FORMAT,VERSION,MAX_VENDORS,MAX_LINES,create,validate,command,comparison};
