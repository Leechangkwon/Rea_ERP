(function(root){
  'use strict';
  const V=root.TransactionVatCore,N=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function open({review,read,canSave,validate,save,format=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:6})}){
    if(document.getElementById('transaction-vat-review'))return;
    const d=N('dialog');d.id='transaction-vat-review';d.className='vat-review-dialog';d.setAttribute('aria-label','부가세 차액 확인');
    const p=review.confirmation.preview,toLine=review.confirmation.mode==='line',after=toLine?p.before:p.after,before=toLine?p.after:p.before;
    const title=N('h2','부가세 차액 확인'),description=N('p',toLine?'라인별 계산으로 변경합니다. 조정 전 금액으로 되돌린 후 저장합니다.':'동일 세율의 합계금액으로 다시 계산합니다. 확인하면 마지막 품목행에 차액을 반영하고 전표를 저장합니다.');
    const table=N('table'),thead=N('thead'),head=N('tr');for(const label of ['항목','변경 전','변경 후','차액'])head.append(N('th',label));thead.append(head);table.append(thead);const body=N('tbody');
    for(const [key,label] of [['supply','공급가액'],['tax','부가세'],['total','합계']]){const row=N('tr');for(const text of [label,format(before[key]),format(after[key]),format(Math.round((after[key]-before[key])*100)/100)])row.append(N('td',text));body.append(row);}table.append(body);
    const target=N('p','차액 반영: '+(review.lastIndex+1)+'행 · '+p.rows[review.lastIndex].item),error=N('p');error.setAttribute('role','alert');error.className='inv-error';const actions=N('div');actions.className='inv-toolbar';
    let busy=false;const close=()=>{if(!busy)d.close();},cancel=N('button','취소'),confirm=N('button','확인');cancel.type=confirm.type='button';confirm.className='primary';cancel.onclick=close;
    confirm.onclick=()=>{if(busy||!d.isConnected)return;error.textContent='';try{
      if(!canSave())throw Error('저장 권한이 변경됐습니다. 다시 확인하세요.');validate?.();const current=read();
      if(JSON.stringify(V.confirmation(current,review.confirmation.mode))!==JSON.stringify(review.confirmation))throw Error('입력 내용이 바뀌었습니다. 취소 후 부가세 차액을 다시 확인하세요.');
      busy=true;confirm.disabled=true;const result=save({...current,vatConfirmation:review.confirmation});busy=false;
      if(result===false){confirm.disabled=false;throw Error('저장하지 못했습니다. 입력 내용과 변경 상태를 확인하세요.');}d.close();
    }catch(e){busy=false;confirm.disabled=!canSave();error.textContent=e.message;}};
    actions.append(cancel,confirm);d.append(title,description,table,target,error,actions);d.addEventListener('close',()=>d.remove());d.addEventListener('cancel',e=>{e.preventDefault();close();});d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='F7'||e.key==='F8')e.preventDefault();});document.body.append(d);d.showModal();cancel.focus();return d;
  }
  root.TransactionVatUI={open};
})(typeof window!=='undefined'?window:globalThis);
