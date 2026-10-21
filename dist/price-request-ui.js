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
  return {source,rows,vendors,status:view?.status||'unstarted',revision:view?.revision,item:item=>C.master(db,'items',item)};
 }
 function tableFor(data,edit){
  const wrap=node('div',undefined,'price-request-table-scroll'),table=node('table',undefined,'price-request-table'),head=node('thead'),body=node('tbody'),tr=node('tr');
  table.setAttribute('aria-label','요청단가 수취단가 확정단가 비교');
  for(const label of ['품목코드','품목명','규격','수량','요청단가',...data.vendors.map(v=>v.code+' · '+v.name+' 수취단가'+(v.closed?' (입력마감)':'')),'확정단가','선택']){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);
  for(const row of data.rows){const tr=node('tr'),item=data.item(row.item),confirmed=row.confirmed;tr.dataset.lineKey=row.lineKey;
   const values=[row.item,item?.name||row.item,item?.spec||'',decimal(row.qty),decimal(row.requestedPrice),...row.received.map(v=>v.price===null?'미회신':decimal(v.price)),confirmed?decimal(confirmed.price):'미확정',confirmed?(confirmed.source==='request'?'요청단가':confirmed.vendorCode):''];
   values.forEach((value,index)=>{const td=node('td',value);if(index>=3)td.className='price-request-value';
    if(edit&&index>=4&&index<5+data.vendors.length){
     const vendorCode=index===4?null:data.vendors[index-5].code,source=vendorCode===null?'request':'vendor',choice=edit.draft.get(row.lineKey),radio=node('input'),label=node('label');
     radio.type='radio';radio.name='price-selection-'+data.rows.indexOf(row);radio.disabled=index>4&&row.received[index-5].price===null;
     radio.setAttribute('aria-label',(data.rows.indexOf(row)+1)+'행 '+(vendorCode===null?'요청단가':vendorCode+' 수취단가')+' 선택');
     radio.checked=choice?.source===source&&choice?.vendorCode===vendorCode;
     radio.onchange=()=>{if(radio.checked){edit.draft.set(row.lineKey,{lineKey:row.lineKey,source,vendorCode});edit.changed();}};
     label.append(radio,document.createTextNode(value));td.replaceChildren(label);
    }tr.append(td);});body.append(tr);
  }
  table.append(head,body);wrap.append(table);wrap.tabIndex=0;wrap.setAttribute('aria-label','단가 비교표 가로 스크롤');return wrap;
 }
 function open(options){
  document.getElementById('price-request-dialog')?.close();const initial=read(options);
  const prior=document.activeElement,dialog=node('dialog',undefined,'inv-dialog price-request-dialog'),title=node('h2','단가요청비교현황'),content=node('div'),error=node('p','','inv-error'),actions=node('div',undefined,'inv-toolbar');
  dialog.id='price-request-dialog';title.id='price-request-dialog-title';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-modal','true');error.setAttribute('role','alert');
  const refresh=node('button','새로고침'),close=node('button','닫기'),edit=node('button','확정단가선택/수정'),save=node('button','단가확정/저장(F8)');
  for(const button of [refresh,close,edit,save])button.type='button';actions.append(edit,save,refresh,close);dialog.append(title,content,error,actions);
  let data=initial,draft=null,baseline='',blocked=false;
  const fingerprint=value=>JSON.stringify({source:value.source,rows:value.rows,vendors:value.vendors,status:value.status,revision:value.revision});
  const writable=()=>typeof options.onSave==='function'&&options.canWrite?.()===true;
  const changes=()=>data.rows.flatMap(row=>{const choice=draft?.get(row.lineKey),old=row.confirmed;return choice&&(!old||choice.source!==old.source||choice.vendorCode!==old.vendorCode)?[choice]:[];});
  const buttons=()=>{edit.hidden=Boolean(draft)||data.status!=='ready'||!writable();save.hidden=!draft;save.disabled=blocked||!writable()||!changes().length;};
  const draw=()=>{content.replaceChildren();error.textContent='';const context=node('p',data.source.date+' / '+data.source.id+(data.source.currency?' · '+data.source.currency:''),'inv-note');content.append(context);
   content.append(node('p',draft?'단가를 선택한 뒤 저장하세요. 미선택 품목은 기존 상태를 유지합니다.':'표를 좌우로 이동해 거래처별 수취단가와 확정단가를 확인하세요.','inv-note'));
   if(data.status==='unstarted')content.append(node('p','등록된 비교 자료가 없습니다. 요청단가만 표시합니다.','inv-note'));
   if(messages[data.status]){const warning=node('p',messages[data.status],'inv-note');warning.setAttribute('role','status');content.append(warning);}
   content.append(tableFor(data,draft?{draft,changed:buttons}:null));buttons();
  };
  const failure=e=>{draft=null;blocked=true;content.replaceChildren();error.textContent=e.message;edit.hidden=save.hidden=true;save.disabled=true;};
  const reload=()=>{try{data=read(options);draft=null;blocked=false;draw();}catch(e){failure(e);}};
  const checkDraft=()=>{const current=read(options);if(current.status!=='ready'||fingerprint(current)!==baseline){blocked=true;throw Error('단가 비교 자료가 변경됐습니다. 새로고침 후 다시 선택하세요.');}if(!writable())throw Error('단가 비교 저장 권한이 없습니다.');};
  edit.onclick=()=>{try{data=read(options);if(data.status!=='ready'||!writable())throw Error('단가 비교 저장 권한 또는 원본 상태를 확인하세요.');baseline=fingerprint(data);blocked=false;draft=new Map(data.rows.filter(row=>row.confirmed).map(row=>[row.lineKey,{lineKey:row.lineKey,source:row.confirmed.source,vendorCode:row.confirmed.vendorCode}]));draw();content.querySelector('input:checked,input:not(:disabled)')?.focus();}catch(e){failure(e);}};
  save.onclick=()=>{if(!draft)return;try{checkDraft();const selections=changes();if(!selections.length)return;
    const result=options.onSave({action:'selectMany',documentId:options.documentId,expectedRevision:data.revision,selections});
    if(!result)throw Error('저장하지 못했습니다. 선택 내용을 확인하고 다시 시도하세요.');reload();
   }catch(e){if(!options.canRead()){failure(e);return;}error.textContent=e.message;buttons();}};
  refresh.onclick=reload;close.onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
  dialog.addEventListener('keydown',event=>{if(event.key==='F8'&&!event.defaultPrevented&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey&&draft){event.preventDefault();if(!save.disabled)save.click();}});
  const check=()=>{if(!dialog.open)return;if(!draft){reload();return;}try{if(!options.canRead())throw Error('단가 비교 조회 권한이 없습니다.');checkDraft();blocked=false;error.textContent='';buttons();}catch(e){if(!options.canRead()){failure(e);return;}blocked=true;error.textContent=e.message;buttons();}};
  let finished=false;const nativeClose=dialog.close.bind(dialog);
  const finish=()=>{if(finished)return;finished=true;draft=null;window.removeEventListener('storage',check);window.removeEventListener('focus',check);dialog.remove();if(prior?.isConnected)prior.focus();};
  // Native close events are queued: remove immediately so replacement/navigation cannot find an obsolete id.
  dialog.close=()=>{try{nativeClose();}finally{finish();}};dialog.addEventListener('close',finish,{once:true});
  document.body.append(dialog);draw();window.addEventListener('storage',check);window.addEventListener('focus',check);dialog.showModal();close.focus();return dialog;
 }

 root.PriceRequestUI={open};
})(typeof globalThis==='object'?globalThis:this);
