(function(root){
 'use strict';
 const R=root.PurchaseReturnCore,C=root.InventoryCore;
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const field=(label,control)=>{const wrap=node('label',undefined,'inv-field');wrap.append(node('span',label),control);return wrap;};
 const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:6});
 function open(options){
  if(typeof options.getDb!=='function')throw Error('반품 자료를 다시 불러오세요.');
  const db=options.getDb(),draft=options.documentId?R.edit(db,options.documentId):R.create(db,options.sourceId,options.date),identity=options.identity?.(),source=db.documents.find(d=>d.id===draft.sourceId),focus=document.activeElement;
  const dialog=node('dialog',undefined,'inv-dialog'),form=node('form'),heading=node('div',undefined,'inv-modal-head'),body=node('div',undefined,'inv-modal-body'),error=node('p','','inv-error'),summary=node('p','','inv-totals'),table=node('table',undefined,'inv-table'),thead=node('thead'),tbody=node('tbody'),head=node('tr'),controls=[];
  dialog.id='purchase-return-dialog';dialog.setAttribute('aria-label',options.documentId?'구매반품 상세 / 수정':'구매 반품처리');error.setAttribute('role','alert');table.setAttribute('aria-label','음수 구매반품 품목');
  let closed=false,saving=false;
  const readonly=()=>Boolean(options.readOnly?.())||typeof identity!=='string'||!identity||typeof options.onCommit!=='function';
  function guard(){if(closed||!dialog.isConnected)throw Error('닫힌 반품 화면입니다.');if(readonly()||options.identity?.()!==identity)throw Error('계정 또는 저장 권한이 변경됐습니다. 다시 열어주세요.');}
  function close(){if(closed)return;closed=true;dialog.remove();if(focus?.isConnected)focus.focus();options.onClose?.();}
  const button=(text,action)=>{const b=node('button',text);b.type='button';b.onclick=action;return b;};
  const date=node('input');date.type='date';date.setAttribute('aria-label','반품 일자');date.value=draft.date;date.disabled=readonly();
  const originalRows=new Map(source.lines.map((line,index)=>[line.lineId?'id:'+line.lineId:'index:'+index,line]));
  for(const label of ['원구매 품목행','품목','원구매 수량','반품 수량','단가','공급가액','부가세','합계','제외'])head.append(node('th',label));thead.append(head);
  for(const [index,row]of draft.lines.entries()){
   const original=originalRows.get(row.key),tr=node('tr'),quantity=node('input'),name=C.master(db,'items',original.item)?.name||original.item,cells={};
   quantity.type='number';quantity.step='any';quantity.max='0';quantity.value=String(row.qty);quantity.disabled=readonly();quantity.setAttribute('aria-label','반품 수량 '+(index+1));
   for(const value of [String(source.lines.indexOf(original)+1),original.item+' · '+name,fmt(original.qty)])tr.append(node('td',value));const cell=node('td');cell.append(quantity);tr.append(cell);
   tr.append(node('td',fmt(original.price||0)));for(const key of ['supply','tax','total']){cells[key]=node('td','—');cells[key].dataset.amount=key;tr.append(cells[key]);}
   const remove=button('제외',()=>{try{guard();row.qty=0;quantity.value='0';refresh();}catch(e){error.textContent=e.message;}});remove.setAttribute('aria-label','반품 품목 '+(index+1)+' 제외');remove.disabled=readonly();const action=node('td');action.append(remove);tr.append(action);tbody.append(tr);controls.push({row,quantity,cells});
   quantity.oninput=()=>{row.qty=quantity.value;refresh();};
  }
  table.append(thead,tbody);const wrap=node('div',undefined,'inv-table-wrap');wrap.append(table);
  const save=button('저장(F8)',()=>{
   if(saving||closed)return;saving=true;save.disabled=true;
   try{
    guard();draft.date=date.value;const current=options.getDb(),expectedDb=JSON.stringify(current),next=R.save(current,draft,options.policy?.());guard();
    const committed=options.onCommit(next,{expectedDb,identity});if(committed&&typeof committed.then==='function')throw Error('동기 저장 연결을 확인하세요.');if(committed!==true)throw Error('반품 저장을 완료하지 못했습니다. 입력 내용은 보존했습니다.');
    close();options.onSaved?.(next.result);
   }catch(e){error.textContent=e.message;}finally{saving=false;if(!closed)save.disabled=readonly();}
  });save.className='primary';save.disabled=readonly();
  function refresh(){
   if(closed)return;draft.date=date.value;for(const {cells}of controls)for(const cell of Object.values(cells))cell.textContent='—';
   try{
    if(options.identity?.()!==identity)throw Error('계정이 변경됐습니다. 다시 열어주세요.');
    const view=R.preview(options.getDb(),draft,options.policy?.()),amounts=new Map(view.lines.map(line=>{const index=source.lines.findIndex(original=>original.item===line.item&&(!line.sourceLineId||original.lineId===line.sourceLineId)),original=source.lines[index];return [original?.lineId?'id:'+original.lineId:'index:'+index,line];}));
    for(const {row,cells}of controls){const line=amounts.get(row.key);for(const key of ['supply','tax','total'])cells[key].textContent=line?fmt(line[key]):'0';}
    summary.textContent='수량 '+fmt(view.totals.qty)+' · 공급가액 '+fmt(view.totals.supply)+' · 부가세 '+fmt(view.totals.tax)+' · 합계 '+fmt(view.totals.total);error.textContent='';
   }catch(e){summary.textContent='입력 내용을 확인한 후 금액을 표시합니다.';error.textContent=e.message;}
  }
  date.oninput=refresh;heading.append(node('h2',options.documentId?'구매반품 상세 / 수정':'구매 반품처리'),button('닫기',close));
  const partner=C.master(db,'partners',source.partner),warehouse=C.master(db,'warehouses',source.warehouse);
  body.append(node('p','원구매 '+source.id+' · '+(partner?.name||source.partner)+' · '+(warehouse?.name||source.warehouse),'inv-note'),node('p','반품 수량은 음수로 입력합니다. 0 또는 제외는 해당 품목을 저장하지 않습니다. 원구매의 입고창고·단가와 배분 세액을 유지합니다.','inv-note'),field('반품 일자',date),wrap,summary,error);
  const actions=node('div',undefined,'inv-toolbar');actions.append(save,button('취소',close));form.append(body,actions);form.onsubmit=e=>{e.preventDefault();save.click();};dialog.append(heading,form);
  dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();close();});dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='F8'){e.preventDefault();save.click();}else if(e.key==='F3')e.preventDefault();});
  document.body.append(dialog);dialog.showModal();refresh();
  return {element:dialog,read:()=>C.clone(draft),destroy:close};
 }
 root.PurchaseReturnUI={open};
})(typeof globalThis==='object'?globalThis:this);
