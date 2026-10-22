(function(root){
 'use strict';
 const maxRows=1000,maxBytes=1048576;
 function parseTsv(text){
  if(typeof text!=='string'||!text.length)throw Error('엑셀에서 복사한 자료를 붙여넣으세요.');
  if(text.length>maxBytes||new TextEncoder().encode(text).length>maxBytes)throw Error('검토할 자료는1MiB까지 붙여넣을 수 있습니다.');
  const rows=[];let row=[],cell='',quoted=false,closed=false,ended=false;
  const field=()=>{row.push(cell);cell='';closed=false;if(row.length>22)throw Error('원본 양식22열을 초과했습니다. 빈 열도 유지하고 복사 범위를 확인하세요.');};
  const record=()=>{field();rows.push(row);row=[];if(rows.length>maxRows+1)throw Error('검토할 자료는 제목행을 제외하고1000행까지입니다.');};
  for(let i=0;i<text.length;i++){
   const ch=text[i];ended=false;
   if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else {quoted=false;closed=true;}}else cell+=ch;continue;}
   if(ch==='\t'){field();continue;}
   if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;record();ended=true;continue;}
   if(closed)throw Error('따옴표가 닫힌 셀 뒤의 구분자를 확인하세요.');
   if(ch==='"'&&cell==='')quoted=true;else cell+=ch;
  }
  if(quoted)throw Error('닫히지 않은 따옴표가 있습니다. 복사 범위를 확인하세요.');
  if(!ended)record();return rows;
 }
 function snapshot(db){
  if(!db?.masters||!['items','partners','currencies'].every(k=>Array.isArray(db.masters[k])))throw Error('등록 기초자료를 다시 조회하세요.');
  const masters={};for(const key of ['items','partners','currencies'])masters[key]=db.masters[key].map(entry=>{
   if(!entry||typeof entry.code!=='string'||!entry.code||typeof entry.name!=='string'||entry.disabled!==undefined&&typeof entry.disabled!=='boolean')throw Error('등록 기초자료의 코드·명칭·사용중단 여부를 확인하세요.');
   const copy={code:entry.code,name:entry.name,disabled:entry.disabled===true};if(key==='items'){if(entry.barcode!==undefined&&typeof entry.barcode!=='string')throw Error('품목 바코드를 확인하세요.');if(entry.barcode!==undefined)copy.barcode=entry.barcode;}if(key==='currencies')copy.fractionDigits=null;return copy;
  });
  return {maxRows,masters,requiredFieldIds:null,quantity:null,amounts:null};
 }
 const api=Object.freeze({maxRows,maxBytes,parseTsv,snapshot});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadInputCore=api;
})(typeof globalThis==='object'?globalThis:this);
