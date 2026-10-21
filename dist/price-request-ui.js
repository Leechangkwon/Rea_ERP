(function(root){
 'use strict';
 const C=root.InventoryCore,Q=root.PriceRequestCore;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
 const decimal=value=>{if(value===null||value===undefined)return '—';const text=String(value);if(!/^-?\d+(?:\.\d+)?$/.test(text))return text;const [whole,fraction]=text.split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
 const messages={'missing-source':'원본 전표가 없습니다. 보관 당시 비교 자료를 표시합니다.','inactive-source':'원본 전표가 취소·보류·미확인 상태입니다. 보관 당시 비교 자료를 표시합니다.','source-changed':'원본 전표가 변경됐습니다. 보관 당시 비교 자료를 표시합니다.','vendor-unavailable':'비교 거래처가 변경되었거나 사용 중단됐습니다. 보관 당시 비교 자료를 표시합니다.'};
 function read(options){
  if(!options.canRead())throw Error('단가 비교 조회 권한이 없습니다.');
  const db=options.getDb(),view=Q.view(db,options.documentId,C),source=view?.snapshot||db.documents.find(d=>d.id===options.documentId&&d.type==='pricerequest');
  if(!source)throw Error('단가요청 전표를 찾을 수 없습니다.');
  const rows=view?.rows||source.lines.map((line,index)=>({lineKey:'row:'+index,item:line.item,qty:line.qty,requestedPrice:line.price,received:[],confirmed:null}));
  const vendors=rows[0]?.received.map(v=>({code:v.vendorCode,name:C.master(db,'partners',v.vendorCode)?.name||v.vendorCode,closed:v.inputClosed}))||[];
  return {source,rows,vendors,status:view?.status||'unstarted',item:item=>C.master(db,'items',item)};
 }
 function tableFor(data){
  const wrap=node('div',undefined,'price-request-table-scroll'),table=node('table',undefined,'price-request-table'),head=node('thead'),body=node('tbody'),tr=node('tr');
  table.setAttribute('aria-label','요청단가 수취단가 확정단가 비교');
  for(const label of ['품목코드','품목명','규격','수량','요청단가',...data.vendors.map(v=>v.code+' · '+v.name+' 수취단가'+(v.closed?' (입력마감)':'')),'확정단가','선택']){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);
  for(const row of data.rows){const tr=node('tr'),item=data.item(row.item),confirmed=row.confirmed;tr.dataset.lineKey=row.lineKey;
   const values=[row.item,item?.name||row.item,item?.spec||'',decimal(row.qty),decimal(row.requestedPrice),...row.received.map(v=>v.price===null?'미회신':decimal(v.price)),confirmed?decimal(confirmed.price):'미확정',confirmed?(confirmed.source==='request'?'요청단가':confirmed.vendorCode):''];
   values.forEach((value,index)=>{const td=node('td',value);if(index>=3)td.className='price-request-value';tr.append(td);});body.append(tr);
  }
  table.append(head,body);wrap.append(table);wrap.tabIndex=0;wrap.setAttribute('aria-label','단가 비교표 가로 스크롤');return wrap;
 }
 function open(options){
  // No callbacks capable of writing are accepted by this read-only viewer.
  document.getElementById('price-request-dialog')?.close();const initial=read(options);
  const prior=document.activeElement,dialog=node('dialog',undefined,'inv-dialog price-request-dialog'),title=node('h2','단가요청비교현황'),content=node('div'),actions=node('div',undefined,'inv-toolbar');
  dialog.id='price-request-dialog';title.id='price-request-dialog-title';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-modal','true');
  const refresh=node('button','새로고침'),close=node('button','닫기');refresh.type=close.type='button';actions.append(refresh,close);dialog.append(title,content,actions);
  const draw=data=>{content.replaceChildren();const context=node('p',data.source.date+' / '+data.source.id+(data.source.currency?' · '+data.source.currency:''),'inv-note');content.append(context);
   content.append(node('p','조회 전용 · 표를 좌우로 이동해 거래처별 수취단가와 확정단가를 확인하세요.','inv-note'));
   if(data.status==='unstarted')content.append(node('p','등록된 비교 자료가 없습니다. 요청단가만 표시합니다.','inv-note'));
   if(messages[data.status]){const warning=node('p',messages[data.status],'inv-note');warning.setAttribute('role','status');content.append(warning);}
   content.append(tableFor(data));
  };
  const reload=()=>{try{draw(read(options));}catch(e){content.replaceChildren();const error=node('p',e.message,'inv-error');error.setAttribute('role','alert');content.append(error);}};
  refresh.onclick=reload;close.onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
  const check=()=>{if(dialog.open)reload();};
  let finished=false;const nativeClose=dialog.close.bind(dialog);
  const finish=()=>{if(finished)return;finished=true;window.removeEventListener('storage',check);window.removeEventListener('focus',check);dialog.remove();if(prior?.isConnected)prior.focus();};
  // Native close events are queued: remove immediately so replacement/navigation cannot find an obsolete id.
  dialog.close=()=>{try{nativeClose();}finally{finish();}};dialog.addEventListener('close',finish,{once:true});
  document.body.append(dialog);draw(initial);window.addEventListener('storage',check);window.addEventListener('focus',check);dialog.showModal();close.focus();return dialog;
 }
 root.PriceRequestUI={open};
})(typeof globalThis==='object'?globalThis:this);
