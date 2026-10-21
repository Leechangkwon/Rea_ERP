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
 function tableFor(data,edit,onClose,onReply){
  const wrap=node('div',undefined,'price-request-table-scroll'),table=node('table',undefined,'price-request-table'),head=node('thead'),body=node('tbody'),tr=node('tr');
  table.setAttribute('aria-label','요청단가 수취단가 확정단가 비교');
  const labels=['품목코드','품목명','규격','수량','요청단가',...data.vendors.map(v=>v.code+' · '+v.name+' 수취단가'+(v.closed?' (입력마감)':'')),'확정단가','선택'];
  labels.forEach((label,index)=>{const th=node('th',label);th.scope='col';
   if(onClose&&index>=5&&index<5+data.vendors.length){const vendor=data.vendors[index-5],button=node('button',vendor.closed?'입력마감취소':'입력마감');button.type='button';button.dataset.vendorClose=vendor.code;button.setAttribute('aria-label',vendor.code+' '+vendor.name+' '+button.textContent);button.onclick=()=>onClose(vendor,button);
    if(onReply){const direct=node('button','수취단가 직접입력');direct.type='button';direct.dataset.vendorReply=vendor.code;direct.setAttribute('aria-label',vendor.code+' '+vendor.name+' 수취단가 직접입력');direct.disabled=vendor.closed;if(vendor.closed)direct.title='입력마감을 취소한 뒤 입력하세요.';direct.onclick=()=>onReply(vendor,direct);th.append(node('br'),direct);}
    th.append(node('br'),button);}
   tr.append(th);});head.append(tr);
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
 function replyTableFor(data,vendorCode,draft,changed){
  const wrap=node('div',undefined,'price-request-table-scroll'),table=node('table',undefined,'price-request-table'),head=node('thead'),body=node('tbody'),header=node('tr');
  table.setAttribute('aria-label','수취단가 직접입력 품목');
  for(const label of ['품목코드','품목명','규격','수량','요청단가','수취단가']){const th=node('th',label);th.scope='col';header.append(th);}head.append(header);
  data.rows.forEach((row,index)=>{const tr=node('tr'),item=data.item(row.item);tr.dataset.lineKey=row.lineKey;
   for(const value of [row.item,item?.name||row.item,item?.spec||'',decimal(row.qty),decimal(row.requestedPrice)])tr.append(node('td',value));
   const td=node('td'),input=node('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.value=draft.get(row.lineKey);input.setAttribute('aria-label',(index+1)+'행 '+vendorCode+' 수취단가');input.placeholder='미회신';
   input.disabled=row.confirmed?.source==='vendor'&&row.confirmed.vendorCode===vendorCode;
   if(input.disabled)input.title='확정단가로 선택된 회신입니다. 비교표에서 확정선택을 먼저 변경하세요.';
   input.oninput=()=>{draft.set(row.lineKey,input.value);changed();};td.append(input);tr.append(td);body.append(tr);
  });table.append(head,body);wrap.append(table);wrap.tabIndex=0;return wrap;
 }
 function open(options){
  document.getElementById('price-request-dialog')?.close();const initial=read(options);
  const prior=document.activeElement,dialog=node('dialog',undefined,'inv-dialog price-request-dialog'),title=node('h2','단가요청비교현황'),content=node('div'),error=node('p','','inv-error'),actions=node('div',undefined,'inv-toolbar');
  dialog.id='price-request-dialog';title.id='price-request-dialog-title';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-modal','true');error.setAttribute('role','alert');
  const refresh=node('button','새로고침'),close=node('button','닫기'),edit=node('button','확정단가선택/수정'),save=node('button','단가확정/저장(F8)'),replySave=node('button','저장(F8)');
  for(const button of [refresh,close,edit,save,replySave])button.type='button';actions.append(edit,save,replySave,refresh,close);dialog.append(title,content,error,actions);
  let data=initial,draft=null,replyDraft=null,replyVendor='',baseline='',blocked=false;
  const fingerprint=value=>JSON.stringify({source:value.source,rows:value.rows,vendors:value.vendors,status:value.status,revision:value.revision});
  const writable=()=>typeof options.onSave==='function'&&options.canWrite?.()===true;
  const changes=()=>data.rows.flatMap(row=>{const choice=draft?.get(row.lineKey),old=row.confirmed;return choice&&(!old||choice.source!==old.source||choice.vendorCode!==old.vendorCode)?[choice]:[];});
  const replyChanges=()=>data.rows.flatMap(row=>{const value=replyDraft?.get(row.lineKey)?.trim(),old=row.received.find(v=>v.vendorCode===replyVendor)?.price;return value!==undefined&&value!==(old??'')?[{lineKey:row.lineKey,price:value}]:[];});
  const buttons=()=>{edit.hidden=Boolean(draft||replyDraft)||data.status!=='ready'||!writable();save.hidden=!draft;save.disabled=blocked||!writable()||!changes().length;replySave.hidden=!replyDraft;replySave.disabled=blocked||!writable()||!replyChanges().length;refresh.hidden=Boolean(replyDraft);};
  const draw=()=>{content.replaceChildren();error.textContent='';const context=node('p',data.source.date+' / '+data.source.id+(data.source.currency?' · '+data.source.currency:''),'inv-note');content.append(context);
   title.textContent=replyDraft?'수취단가 직접입력':'단가요청비교현황';
   if(replyDraft){const vendor=data.vendors.find(v=>v.code===replyVendor);content.append(node('p',vendor.code+' · '+vendor.name),node('p','전달받은 단가를 입력한 뒤 저장하세요. 수량과 요청단가는 유지됩니다. 미회신은 빈칸, 0원은 0으로 입력하세요. 확정선택된 회신은 먼저 선택을 변경해야 합니다.','inv-note'),replyTableFor(data,replyVendor,replyDraft,buttons));buttons();return;}
   content.append(node('p',draft?'단가를 선택한 뒤 저장하세요. 미선택 품목은 기존 상태를 유지합니다.':'표를 좌우로 이동해 거래처별 수취단가와 확정단가를 확인하세요.','inv-note'));
   if(data.status==='unstarted')content.append(node('p','등록된 비교 자료가 없습니다. 요청단가만 표시합니다.','inv-note'));
   if(messages[data.status]){const warning=node('p',messages[data.status],'inv-note');warning.setAttribute('role','status');content.append(warning);}
   content.append(tableFor(data,draft?{draft,changed:buttons}:null,!draft&&data.status==='ready'&&writable()?setClosed:null,startReply));buttons();
  };
  const failure=e=>{draft=replyDraft=null;blocked=true;content.replaceChildren();error.textContent=e.message;edit.hidden=save.hidden=replySave.hidden=true;save.disabled=replySave.disabled=true;refresh.hidden=false;};
  const reload=()=>{try{data=read(options);draft=replyDraft=null;replyVendor='';blocked=false;draw();}catch(e){failure(e);}};
  const checkDraft=()=>{const current=read(options);if(current.status!=='ready'||fingerprint(current)!==baseline){blocked=true;throw Error('단가 비교 자료가 변경됐습니다. 새로고침 후 다시 선택하세요.');}if(!writable())throw Error('단가 비교 저장 권한이 없습니다.');};
  edit.onclick=()=>{try{data=read(options);if(data.status!=='ready'||!writable())throw Error('단가 비교 저장 권한 또는 원본 상태를 확인하세요.');baseline=fingerprint(data);blocked=false;draft=new Map(data.rows.filter(row=>row.confirmed).map(row=>[row.lineKey,{lineKey:row.lineKey,source:row.confirmed.source,vendorCode:row.confirmed.vendorCode}]));draw();content.querySelector('input:checked,input:not(:disabled)')?.focus();}catch(e){failure(e);}};
  save.onclick=()=>{if(!draft)return;try{checkDraft();const selections=changes();if(!selections.length)return;
    const result=options.onSave({action:'selectMany',documentId:options.documentId,expectedRevision:data.revision,selections});
    if(!result)throw Error('저장하지 못했습니다. 선택 내용을 확인하고 다시 시도하세요.');reload();
   }catch(e){if(!options.canRead()){failure(e);return;}error.textContent=e.message;buttons();}};
  const startReply=(vendor,button)=>{
   if(!dialog.open||draft||replyDraft||!button.isConnected||!dialog.contains(button))return;
   try{const current=read(options);if(!writable()||current.status!=='ready'||fingerprint(current)!==fingerprint(data))throw Error('단가 비교 자료 또는 권한이 변경됐습니다. 새로고침 후 다시 확인하세요.');if(vendor.closed)throw Error('입력마감을 취소한 뒤 입력하세요.');
    baseline=fingerprint(data);replyVendor=vendor.code;replyDraft=new Map(data.rows.map(row=>[row.lineKey,row.received.find(v=>v.vendorCode===vendor.code).price??'']));blocked=false;draw();(content.querySelector('input:not(:disabled)')||close).focus();
   }catch(e){if(!options.canRead()){failure(e);return;}error.textContent=e.message;buttons();}
  };
  replySave.onclick=()=>{if(!dialog.open||!replyDraft)return;try{checkDraft();const replies=replyChanges();if(!replies.length)return;if(replies.some(row=>row.price===''))throw Error('기존 회신 단가를 빈칸으로 지울 수 없습니다. 단가를 입력하세요.');
    const result=options.onSave({action:'replyMany',documentId:options.documentId,expectedRevision:data.revision,vendorCode:replyVendor,replies});
    if(!result)throw Error('저장하지 못했습니다. 입력 내용을 확인하고 다시 시도하세요.');const vendorCode=replyVendor;reload();([...content.querySelectorAll('[data-vendor-reply]')].find(el=>el.dataset.vendorReply===vendorCode)||close).focus();
   }catch(e){if(!options.canRead()){failure(e);return;}error.textContent=e.message;buttons();}};
  const setClosed=(vendor,button)=>{
   if(!dialog.open||draft||replyDraft||!button.isConnected||!dialog.contains(button))return;
   try{const current=read(options);if(!writable())throw Error('단가 비교 저장 권한이 없습니다.');if(current.status!=='ready'||fingerprint(current)!==fingerprint(data))throw Error('단가 비교 자료가 변경됐습니다. 새로고침 후 다시 확인하세요.');
    const result=options.onSave({action:'close',documentId:options.documentId,expectedRevision:data.revision,vendorCode:vendor.code,closed:!vendor.closed});
    if(!result)throw Error('입력마감 상태를 저장하지 못했습니다. 다시 확인하세요.');reload();
    const next=[...content.querySelectorAll('[data-vendor-close]')].find(el=>el.dataset.vendorClose===vendor.code);(next||close).focus();
   }catch(e){if(!options.canRead()){failure(e);return;}error.textContent=e.message;buttons();}
  };
  const dismiss=()=>{if(replyDraft){const code=replyVendor;reload();([...content.querySelectorAll('[data-vendor-reply]')].find(el=>el.dataset.vendorReply===code)||close).focus();}else dialog.close();};
  refresh.onclick=reload;close.onclick=dismiss;dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  dialog.addEventListener('keydown',event=>{if(event.key==='F8'&&!event.defaultPrevented&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey&&(draft||replyDraft)){event.preventDefault();const target=replyDraft?replySave:save;if(!target.disabled)target.click();}});
  const check=()=>{if(!dialog.open)return;if(!draft&&!replyDraft){reload();return;}try{if(!options.canRead())throw Error('단가 비교 조회 권한이 없습니다.');checkDraft();blocked=false;error.textContent='';buttons();}catch(e){if(!options.canRead()){failure(e);return;}blocked=true;error.textContent=e.message;buttons();}};
  let finished=false;const nativeClose=dialog.close.bind(dialog);
  const finish=()=>{if(finished)return;finished=true;draft=replyDraft=null;window.removeEventListener('storage',check);window.removeEventListener('focus',check);dialog.remove();if(prior?.isConnected)prior.focus();};
  // Native close events are queued: remove immediately so replacement/navigation cannot find an obsolete id.
  dialog.close=()=>{try{nativeClose();}finally{finish();}};dialog.addEventListener('close',finish,{once:true});
  document.body.append(dialog);draw();window.addEventListener('storage',check);window.addEventListener('focus',check);dialog.showModal();close.focus();return dialog;
 }

 root.PriceRequestUI={open};
})(typeof globalThis==='object'?globalThis:this);
