(function(root){
 'use strict';
 const mounts=new WeakMap(),labels={'quantity-policy':'수량 자릿수와 추가수량 사용 설정','amount-policy':'단가·금액 소수 자릿수','price-policy':'단가 입력 소수 자릿수','domestic-amount-policy':'공급가액·부가세 입력 소수 자릿수','required-fields':'필수항목 설정','voucher-grouping':'전표 묶음기준','save-time-defaults':'저장시값변경','other-header-references':'상단 항목의 코드 확인','quantity-upload-precedence-and-rounding':'수량 입력 우선순위와 반올림','partial-failure-and-retry':'실패 자료 재시도','permissions-and-persistence':'저장 권한과 전표 생성'};
 function issueText(issue){
  const ref={'reference-blank':'품목을 확인하세요.','reference-not-found':'등록된 코드를 찾지 못했습니다.','reference-ambiguous':'같은 값의 후보가 여러 개입니다.','reference-conflict':'코드와 명칭이 서로 다릅니다.','reference-disabled-review':'사용중단 자료입니다. 확인이 필요합니다.'};
  const quantity={'quantity-policy-required':'수량 사용·자릿수 설정을 확인하세요.','amount-policy-required':'단가·금액 자릿수 설정을 확인하세요.','quantity-empty':'수량을 확인하세요.','quantity-rate-required':'품목 환산비율을 확인하세요.','quantity-rate-invalid':'품목 환산비율을 확인하세요.','quantity-conflict':'기본수량과 추가수량이 일치하지 않습니다.','quantity-rounding-required':'수량 반올림 설정을 확인하세요.','quantity-additional-disabled':'추가수량 사용 설정을 확인하세요.','quantity-invalid-input':'수량 형식과 자릿수를 확인하세요.','quantity-base-overflow':'환산된 기본수량의 자릿수를 확인하세요.'};
  return issue.message||ref[issue.code]||quantity[issue.code]||(issue.code==='required'?'필수항목을 확인하세요.':'추가 확인이 필요합니다.');
 }
 function mount(host,result,options){
  if(!host||host.nodeType!==1||!result||!Array.isArray(result.rows)||!Array.isArray(result.columns)||!Array.isArray(result.unresolvedContracts)||!options||typeof options.isCurrent!=='function'||options.onClose!==undefined&&typeof options.onClose!=='function')throw Error('검토 결과와 현재 화면 확인 함수를 제공하세요.');
  result=JSON.parse(JSON.stringify(result));
  mounts.get(host)?.destroy();const d=host.ownerDocument,abort=new d.defaultView.AbortController();let active=true,disposed=false;
  const node=(tag,text,className)=>{const e=d.createElement(tag);if(text!==undefined)e.textContent=String(text??'');if(className)e.className=className;return e;},panel=node('section',undefined,'request-upload-review'),api={destroy,invalidate};mounts.set(host,api);host.append(panel);
  function destroy(){if(disposed)return;disposed=true;active=false;abort.abort();panel.remove();if(mounts.get(host)===api)mounts.delete(host);}
  function invalidate(){if(!active)return;active=false;abort.abort();if(mounts.get(host)===api&&panel.parentNode===host)panel.replaceChildren(node('p','계정 또는 자료가 변경됐습니다. 다시 검토해 주세요.','inv-note'));}
  function current(){if(!active||disposed||mounts.get(host)!==api||!panel.isConnected)return false;try{if(options.isCurrent()!==true){invalidate();return false;}}catch{invalidate();return false;}return active&&mounts.get(host)===api&&panel.isConnected;}
  if(!current()){invalidate();return api;}
  const title=node('h2','업로드 자료 검토'),notice=node('p','검토 결과를 확인하는 화면입니다. 전표는 생성되지 않았습니다.','inv-note'),pending=node('div',undefined,'request-upload-pending'),pendingTitle=node('strong','확인이 더 필요한 설정'),pendingList=node('ul');
  for(const key of result.unresolvedContracts)pendingList.append(node('li',labels[key]||'추가 설정 확인'));pending.append(pendingTitle,pendingList);
  const bar=node('div',undefined,'inv-toolbar'),summary=node('span',undefined,'request-upload-count'),filterLabel=node('label'),filter=node('input');filter.type='checkbox';filter.setAttribute('aria-label','검토 필요한 행만');filterLabel.append(filter,node('span','검토 필요한 행만'));
  let page=0;const pageSize=50,previous=node('button','이전'),next=node('button','다음'),close=node('button','닫기');for(const b of [previous,next,close])b.type='button';bar.append(summary,filterLabel,previous,next,close);
  const wrap=node('div',undefined,'inv-table-wrap'),table=node('table',undefined,'inv-table'),head=node('thead'),header=node('tr'),body=node('tbody');for(const text of ['행','품목','거래처','수량','공급가액','부가세','검토 결과']){const th=node('th',text);th.scope='col';header.append(th);}head.append(header);table.append(head,body);wrap.append(table);panel.append(title,notice,pending,bar,wrap);
  const value=(row,key)=>row.proposedValues?.[key]??row.values?.[key]??'',amount=(row,key)=>{if(!row.amounts){const raw=row.raw?.[key==='supply'?18:19]??row.values?.[key==='supply'?'inv_m$supply_amt':'inv_m$vat_amt']??'';return raw===''?'(공란)':raw;}const text=row.amounts.values[key];return text===null?'확인 필요':String(text)+(row.amounts.origins[key]==='blank-zero'?' (공란)':'');};
  function draw(){
   body.replaceChildren();const visible=result.rows.filter(row=>!filter.checked||row.status==='review'),pages=Math.max(1,Math.ceil(visible.length/pageSize));page=Math.max(0,Math.min(page,pages-1));const pageRows=visible.slice(page*pageSize,(page+1)*pageSize);previous.disabled=page===0;next.disabled=page>=pages-1;summary.textContent=`전체 ${result.rows.length}행 · 검토 필요 ${result.rows.filter(row=>row.status==='review').length}행 · 표시 ${pageRows.length}행 (${page+1}/${pages})`;
   for(const row of pageRows){
    const tr=node('tr');tr.dataset.sourceRow=String(row.sourceRow);tr.append(node('td',row.sourceRow),node('td',[value(row,'inv_m$prod'),value(row,'inv_m$prod_nm')].filter(Boolean).join(' · ')),node('td',[value(row,'inv_m$cust'),value(row,'inv_m$cust_nm')].filter(Boolean).join(' · ')),node('td',`기본 ${row.values?.['inv_m$qty']||'공란'} / 추가 ${row.values?.['inv_m$add_qty']||'공란'}`),node('td',amount(row,'supply')),node('td',amount(row,'tax')));
    const cell=node('td'),status=node('p',row.status==='empty'?'공란행 보존':row.status==='review'?'확인 필요':'일부 항목 검사 통과');cell.append(status);
    if(row.issues?.length){const list=node('ul');for(const issue of row.issues)list.append(node('li',issueText(issue)));cell.append(list);}
    const detail=node('details'),toggle=node('summary','원문·제안값 보기'),dl=node('dl');for(const [columnIndex,col] of result.columns.entries()){const original=row.raw?.[columnIndex]??row.values?.[col.fieldId]??'',proposed=value(row,col.fieldId);dl.append(node('dt',col.label),node('dd',(original===''?'(공란)':original)+(proposed!==original?' → '+proposed:'')));}detail.append(toggle,dl);detail.addEventListener('toggle',()=>{current();},{signal:abort.signal});cell.append(detail);tr.append(cell);body.append(tr);
   }
   if(!visible.length){const tr=node('tr'),cell=node('td','표시할 행이 없습니다.');cell.colSpan=7;tr.append(cell);body.append(tr);}
  }
  filter.addEventListener('change',()=>{if(current()){page=0;draw();}},{signal:abort.signal});previous.addEventListener('click',()=>{if(current()){page--;draw();}},{signal:abort.signal});next.addEventListener('click',()=>{if(current()){page++;draw();}},{signal:abort.signal});close.addEventListener('click',()=>{if(!current())return;destroy();options.onClose?.();},{signal:abort.signal});draw();return api;
 }
 const api=Object.freeze({mount});if(typeof module==='object'&&module.exports)module.exports=api;else root.RequestUploadReviewUI=api;
})(typeof globalThis==='object'?globalThis:this);
