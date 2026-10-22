(function(root){
 'use strict';
 function open(options){
  if(!options||typeof options.isCurrent!=='function'||typeof options.getSnapshot!=='function')throw Error('현재 계정과 기초자료 확인이 필요합니다.');
  const d=document,abort=new AbortController(),node=(tag,text,className)=>{const e=d.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};let disposed=false,invalid=false,review=null,verification=null;
  const dialog=node('dialog',undefined,'request-upload-dialog'),title=node('h2','발주요청 웹자료올리기 · 검토'),notice=node('p','엑셀 양식의22열을 복사해 붙여넣으세요. 등록 자료와 원문을 비교하며 전표는 저장하지 않습니다.','inv-note'),input=node('textarea'),header=node('select'),error=node('p',undefined,'inv-error'),bar=node('div',undefined,'inv-toolbar'),check=node('button','자료 검토','primary'),close=node('button','닫기'),result=node('div'),policyInfo=node('p',undefined,'inv-note');
  dialog.id='request-upload-dialog';dialog.setAttribute('aria-label','발주요청 웹자료올리기 검토');input.setAttribute('aria-label','업로드 자료 붙여넣기');input.spellcheck=false;header.setAttribute('aria-label','제목행 포함 여부');for(const [value,label]of [['','제목행 포함 여부 선택'],['yes','제목행 포함'],['no','제목행 없음']]){const option=node('option',label);option.value=value;header.append(option);}error.setAttribute('role','alert');for(const b of [check,close])b.type='button';bar.append(header,check,close);dialog.append(title,notice,node('p','검토 한도: 제목행 제외1000행 ·1MiB. 수량·금액 자릿수와 저장 설정은 추가 확인이 필요합니다.','inv-note'),input,bar,error,policyInfo,result);
  function invalidate(message){if(disposed||invalid)return;invalid=true;input.value='';input.disabled=true;header.disabled=true;check.disabled=true;review?.destroy();review=null;result.replaceChildren();policyInfo.textContent='';error.textContent=message||'계정·설정 또는 자료가 변경됐습니다. 닫은 뒤 다시 열어주세요.';}
  function current(){if(disposed||invalid||!dialog.isConnected||!dialog.open)return false;try{if(options.isCurrent()!==true){invalidate();return false;}}catch{invalidate();return false;}return true;}
  function destroy(){if(disposed)return;disposed=true;review?.destroy();review=null;input.value='';abort.abort();if(dialog.open)dialog.close();dialog.remove();options.onClose?.();}
  function verify(){
   if(!current())return Promise.resolve(false);if(verification)return verification;if(typeof options.verifyCurrent!=='function')return Promise.resolve(true);
   input.disabled=header.disabled=check.disabled=true;check.textContent='설정 확인 중...';result.setAttribute('inert','');
   verification=Promise.resolve().then(()=>options.verifyCurrent()).then(ok=>{if(!current())return false;if(ok!==true){invalidate();return false;}return true;}).catch(()=>{if(current())invalidate('서버 설정을 확인하지 못했습니다. 닫은 뒤 연결을 확인하고 다시 열어주세요.');return false;}).finally(()=>{verification=null;if(disposed)return;check.textContent='자료 검토';if(current()){input.disabled=header.disabled=check.disabled=false;result.removeAttribute('inert');}});
   return verification;
  }
  const changed=()=>{if(!current())return;review?.destroy();review=null;result.replaceChildren();policyInfo.textContent='';error.textContent='';};
  input.addEventListener('input',changed,{signal:abort.signal});header.addEventListener('change',changed,{signal:abort.signal});
  function renderReview(){if(!current())return;review?.destroy();review=null;result.replaceChildren();policyInfo.textContent='';error.textContent='';try{if(!header.value)throw Error('제목행 포함 여부를 선택하세요.');const matrix=RequestUploadInputCore.parseTsv(input.value),snapshot=options.getSnapshot();if(!current())return;if(snapshot.policySnapshot){const p=snapshot.policySnapshot,usage=p.quantityUse===null?'미설정':p.quantityUse?'사용':'사용안함';policyInfo.textContent='추가수량: '+usage+' · 입력 자릿수(기본/추가/단가): '+[p.input.baseDigits,p.input.additionalDigits,p.input.priceDigits].map(x=>x??'미확인').join('/')+' · 공급가액·부가세 자릿수: '+(p.input.amountDigits??'미확인')+' · 환율: 정수14/소수4자리. 구매·양식 표시 자릿수를 입력 제한으로 사용하지 않습니다.';}policyInfo.textContent+=' 저장시값변경 설정: Self-Customizing > 기본값설정 > 발주요청 업로드 저장시값변경. 미설정은 임의 적용하지 않습니다.';const model=RequestUploadPreview.review(matrix,{...snapshot,hasHeader:header.value==='yes'});review=RequestUploadReviewUI.mount(result,model,{isCurrent:current,onClose:()=>{review=null;result.replaceChildren();}});}catch(e){if(current())error.textContent=e.message;}}
  check.addEventListener('click',()=>{if(typeof options.verifyCurrent==='function')verify().then(ok=>{if(ok)renderReview();});else renderReview();},{signal:abort.signal});
  const recheck=()=>{if(typeof options.verifyCurrent==='function')verify();else current();};
  close.addEventListener('click',destroy,{signal:abort.signal});dialog.addEventListener('close',destroy,{signal:abort.signal});window.addEventListener('storage',recheck,{signal:abort.signal});window.addEventListener('focus',recheck,{signal:abort.signal});dialog.addEventListener('focusin',()=>{current();},{signal:abort.signal});
  d.body.append(dialog);dialog.showModal();if(!current())invalidate();else input.focus();return {element:dialog,destroy,invalidate};
 }
 root.RequestUploadInputUI=Object.freeze({open});
})(typeof globalThis==='object'?globalThis:this);
