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
 const api=Object.freeze({columns,stageRaw});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadCandidate=api;
})(typeof globalThis==='object'?globalThis:this);
