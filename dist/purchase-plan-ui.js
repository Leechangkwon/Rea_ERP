(function(root){
  'use strict';
  const C=root.InventoryCore,P=root.PurchasePlanCore;
  const N=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn,cls)=>{const e=N('button',text,cls);e.type='button';e.onclick=fn;return e;};
  const input=(name,value='',type='text')=>{const e=N('input');e.type=type;e.setAttribute('aria-label',name);if(type==='checkbox')e.checked=Boolean(value);else e.value=value??'';if(type==='number')e.step='any';return e;};
  const select=(name,choices,value)=>{const e=N('select');e.setAttribute('aria-label',name);for(const [id,label]of choices){const o=N('option',label);o.value=id;e.append(o);}e.value=value;return e;};
  const field=(text,e)=>{const l=N('label',undefined,'inv-field');l.append(N('span',text),e);return l;};
  const groups=[['supplier-date-line','거래처별납기일자별라인별'],['supplier-date-item','거래처별납기일자별품목별'],['single-line','1장라인별'],['single-item','1장품목별'],['custom','직접설정']];
  const data=o=>typeof o.db==='function'?o.db():o.db;
  const writable=o=>!(typeof o.readOnly==='function'?o.readOnly():o.readOnly)&&(!root.AuthUI||root.AuthUI.can('inventory.write'));
  const fmt=(n,options={})=>typeof SelfCore!=='undefined'?SelfCore.formatNumber(Number(n||0),typeof AuthUI!=='undefined'?AuthUI.settings():null,options):Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:6});
  function table(headers,rows){const wrap=N('div',undefined,'inv-table-wrap'),t=N('table',undefined,'inv-table'),head=N('thead'),tr=N('tr'),body=N('tbody');headers.forEach(x=>tr.append(N('th',x)));head.append(tr);for(const row of rows){const r=N('tr');for(const [i,x]of row.entries()){const cell=N('td');cell.dataset.label=headers[i];cell.append(x instanceof Node?x:N('span',String(x??'')));r.append(cell);}body.append(r);}if(!rows.length){const r=N('tr'),cell=N('td','조건에 맞는 미처리 발주계획이 없습니다.');cell.colSpan=headers.length;r.append(cell);body.append(r);}t.append(head,body);wrap.append(t);return wrap;}
  function open(options={}){
    document.getElementById('purchase-plan-dialog')?.close();
    const d=N('dialog',undefined,'inv-dialog purchase-plan-dialog'),head=N('div',undefined,'inv-modal-head'),body=N('div',undefined,'inv-modal-body');d.id='purchase-plan-dialog';d.setAttribute('aria-label','발주계획에서 발주서 생성');
    const close=()=>{d.close();d.remove();};head.append(N('h2','발주계획 → 발주서 생성'),button('×',close));d.append(head,body);document.body.append(d);d.addEventListener('close',()=>d.remove());
    d.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();close();});d.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
    const error=N('p',undefined,'inv-error');error.setAttribute('role','alert');
    const controls={grouping:select('발주서 정리 방식',groups,options.grouping||groups[0][0]),date:input('발주서 생성일',C.today(),'date'),dueDate:input('기본 납기일',C.today(),'date'),employee:select('발주서 담당자 일괄지정',[['','계획별 담당자 유지'],...data(options).masters.employees.filter(x=>!x.disabled).map(x=>[x.code,x.code+' · '+x.name])],''),reference:input('발주서 참조 일괄지정'),partner:select('한 장 발주서 거래처',[['','거래처 직접 선택'],...data(options).masters.partners.filter(x=>!x.disabled).map(x=>[x.code,x.code+' · '+x.name])],''),query:input('계획 품목 검색'),splitSupplier:input('거래처별 나누기',true,'checkbox'),splitDueDate:input('납기일별 나누기',true,'checkbox'),mergeItems:input('같은 품목 합산',false,'checkbox')};
    const settings=N('div',undefined,'inv-filters'),custom=N('div',undefined,'inv-toolbar'),single=field('한 장의 거래처',controls.partner),description=N('p',undefined,'inv-note');
    settings.append(field('정리 방식',controls.grouping),field('생성일',controls.date),field('납기일 미지정 시',controls.dueDate),field('담당자 일괄지정',controls.employee),field('참조 일괄지정',controls.reference),single,field('검색',controls.query));custom.append(field('거래처별',controls.splitSupplier),field('납기일별',controls.splitDueDate),field('품목별 합산',controls.mergeItems));
    body.append(N('p','① 계획·구매처 확인 → ② 생성 미리보기 → ③ 발주서 생성. 품목에 등록된 구매처를 기본으로 나눕니다.','inv-note'),settings,custom,description);
    controls.reference.placeholder='입력 시 생성 발주서에 적용';
    body.append(N('p','참조를 입력하면 생성할 발주서에 적용합니다. 원본 발주계획은 바꾸지 않습니다.','inv-note'));
    body.append(N('p','담당자 일괄지정은 생성할 발주서에만 적용합니다. 계획별 담당자 유지는 기존 값을 유지하며, 전표 분리 기준과 원본 발주계획은 바꾸지 않습니다.','inv-note'));
    body.append(N('p','발주서는 한 번에 '+P.MAX_SELECTIONS+'행까지 선택해 생성할 수 있습니다.','inv-note'));
    if(!options.ids?.length)body.prepend(N('p','선택한 계획이 없어 미처리 계획을 모두 표시합니다. 생성할 행을 체크하세요.','inv-note'));
    const selected=new Set(),edits=new Map(),holder=N('div',undefined,'plan-candidates'),pager=N('div',undefined,'inv-toolbar'),status=N('span'),previewBox=N('div',undefined,'plan-preview'),result=N('p');result.setAttribute('role','status');let page=0,rows=[],preview,partnerManual=false;
    previewBox.tabIndex=-1;
    const previous=button('이전 계획 페이지',()=>{page=Math.max(0,page-1);draw();}),next=button('다음 계획 페이지',()=>{page++;draw();});pager.append(previous,status,next,button('전체 계획 선택',()=>{if(!writable(options))return;rows.forEach(r=>selected.add(r.key));invalidate();draw();}),button('계획 선택 해제',()=>{selected.clear();invalidate();draw();}));body.append(pager,holder,previewBox);
    const guard=()=>{if(!writable(options))throw Error('발주서 생성 권한이 필요합니다.');};
    const generate=button('발주서 일괄 생성',()=>{try{guard();if(!preview)throw Error('먼저 생성 미리보기를 확인하세요.');const value=P.commit(data(options),preview,typeof options.policy==='function'?options.policy():options.policy);guard();if(options.onCommit(value)!==false){preview=undefined;generate.disabled=generate.hidden=true;showPreview.classList.add('primary');result.textContent=value.result.length+'건의 발주서를 생성했습니다.';previewBox.replaceChildren();selected.clear();refresh();}}catch(e){error.textContent=e.message;}},'primary');generate.disabled=true;
    function invalidate(){preview=undefined;generate.disabled=generate.hidden=true;showPreview.classList.add('primary');previewBox.replaceChildren();error.textContent='';result.textContent='';}
    function syncPartner(){if(partnerManual)return;const chosen=P.candidates(data(options),{ids:options.ids?.length?options.ids:undefined}).filter(r=>selected.has(r.key)).map(r=>edits.get(r.key)?.supplier??r.supplier);controls.partner.value=chosen.length&&chosen.every(Boolean)&&new Set(chosen).size===1?chosen[0]:'';}
    function mode(){syncPartner();const one=controls.grouping.value.startsWith('single'),direct=controls.grouping.value==='custom';custom.hidden=!direct;single.hidden=!(one||(direct&&!controls.splitSupplier.checked));description.textContent='라인별은 원본 행과 수량을 유지하고, 품목별은 단가·할인·추가항목이 같은 행을 합산합니다. 창고·담당자·프로젝트·통화·거래유형·세율·추가 전표 조건이 다르면 나누어 생성합니다. 구매처가 한 곳이면 자동 적용됩니다. 여러 구매처를 한 장으로 모을 때는 보낼 거래처를 지정하세요.'+(direct?' 직접설정은 거래처·납기일 분리와 품목 합산을 지원합니다. 추가 집계기준 선택과 입고창고·거래유형·통화·납기 일괄변경은 아직 지원하지 않습니다.':'');}
    function draw(){syncPartner();
      const count=Math.max(1,Math.ceil(rows.length/50));page=Math.min(Math.max(0,page),count-1);const partners=[['','구매처 지정 필요'],...data(options).masters.partners.filter(x=>!x.disabled).map(x=>[x.code,x.code+' · '+x.name])];
      holder.replaceChildren(table(['선택','계획일자','원본 계획번호','품목코드','품목명','미처리수량','발주수량','품목별 구매처','납기일'],rows.slice(page*50,page*50+50).map(row=>{
        const values=edits.get(row.key)||{qty:row.qty,supplier:row.supplier,dueDate:row.dueDate||''};edits.set(row.key,values);const check=input('계획 선택 '+row.key,selected.has(row.key),'checkbox'),qty=input('발주수량 '+row.key,values.qty,'number'),supplier=select('계획 구매처 '+row.key,partners,values.supplier||''),due=input('계획 납기일 '+row.key,values.dueDate,'date');
        check.disabled=qty.disabled=supplier.disabled=due.disabled=!writable(options);qty.min='0.000001';check.onchange=()=>{check.checked?selected.add(row.key):selected.delete(row.key);invalidate();syncPartner();status.textContent=(page+1)+' / '+count+' 페이지 · '+selected.size+'행 선택';};for(const [name,el]of [['qty',qty],['supplier',supplier],['dueDate',due]])el.addEventListener('change',()=>{values[name]=el.value;invalidate();syncPartner();});return [check,row.date,row.documentId,row.item,row.name,fmt(row.qty),qty,supplier,due];
      })));
      status.textContent=(page+1)+' / '+count+' 페이지 · '+rows.length+'행 · '+selected.size+'행 선택';previous.disabled=page===0;next.disabled=page+1>=count;
    }
    function refresh(){rows=P.candidates(data(options),{ids:options.ids?.length?options.ids:undefined,query:controls.query.value});draw();}
    function request(){const candidates=P.candidates(data(options),{ids:options.ids?.length?options.ids:undefined});return {date:controls.date.value,dueDate:controls.dueDate.value,grouping:controls.grouping.value,partner:controls.partner.value,...(controls.employee.value?{employeeOverride:controls.employee.value}:{}),...(controls.reference.value!==''?{referenceOverride:controls.reference.value}:{}),custom:{splitSupplier:controls.splitSupplier.checked,splitDueDate:controls.splitDueDate.checked,mergeItems:controls.mergeItems.checked},selections:candidates.filter(r=>selected.has(r.key)).map(r=>({documentId:r.documentId,item:r.item,...(r.lineId?{lineId:r.lineId}:{}),...edits.get(r.key)}))};}
    const masterText=(db,kind,code)=>code?(code+' · '+(C.master(db,kind,code)?.name||'미등록')):'미지정';
    const recorded=value=>value===undefined?'기본값':value===null||value===''?'미지정':typeof value==='object'?JSON.stringify(value):String(value);
    const roundingText=value=>value&&typeof value==='object'&&['round','floor','ceil'].includes(value.method)?({round:'반올림',floor:'버림',ceil:'올림'}[value.method]+' · 소수 '+value.digits+'자리'):recorded(value);
    function renderPreview(prepared){
      const db=data(options),fragment=document.createDocumentFragment();fragment.append(N('h3','생성될 발주서 '+prepared.documents.length+'건'));
      const overview=table(['발주서','거래처','담당자','납기일','수량','공급가액','부가세','합계'],prepared.documents.map((doc,i)=>{const total=C.totals(doc);return [i+1,masterText(db,'partners',doc.partner),masterText(db,'employees',doc.employee),doc.dueDate||'행별 납기',fmt(total.qty),fmt(total.supply,{money:true}),fmt(total.tax,{money:true}),fmt(total.total,{money:true})];}));
      overview.classList.add('plan-preview-overview');overview.setAttribute('role','region');overview.setAttribute('aria-label','생성 전표 요약');overview.tabIndex=0;fragment.append(overview);
      for(const [i,doc]of prepared.documents.entries()){
        const section=N('section',undefined,'plan-preview-document'),heading=N('h4',(i+1)+'. '+masterText(db,'partners',doc.partner)+' · '+doc.date),context=N('dl',undefined,'plan-preview-context');
        section.setAttribute('aria-label','생성 발주서 '+(i+1));
        const entries=[['창고',masterText(db,'warehouses',doc.warehouse)],['담당자',masterText(db,'employees',doc.employee)],['프로젝트',masterText(db,'projects',doc.project)],['통화',recorded(doc.currency)],['거래유형',doc.transactionType?doc.transactionType+' · '+(C.purchaseTransactionTypes.find(([code])=>code===doc.transactionType)?.[1]||'기존값'):'미지정 / 기존 세율 유지'],['부가세율',recorded(doc.vatRate)+'%'],['납기일',doc.dueDate||'행별 납기'],['참조',recorded(doc.reference)],['공급가액 계산',roundingText(doc.supplyRounding)],['부가세 계산',roundingText(doc.taxRounding)],['원본 발주계획',(doc.planGeneration?.sourceIds||[]).join(', ')||'미지정']];
        if(doc.custom&&Object.keys(doc.custom).length)entries.push(['추가 전표 항목',Object.entries(doc.custom).map(([name,value])=>name+': '+recorded(value)).join(' / ')]);
        for(const [label,value]of entries){const pair=N('div');pair.append(N('dt',label),N('dd',value));context.append(pair);}
        section.append(heading,context,table(['품목','품목명','수량','단가','원본 계획'],doc.lines.map(l=>[l.item,C.master(db,'items',l.item)?.name,fmt(l.qty),fmt(l.price,{money:true}),[...new Set((l.planAllocations||[]).map(a=>a.documentId))].join(', ')])));fragment.append(section);
      }
      return fragment;
    }
    const showPreview=button('생성 미리보기',()=>{try{guard();error.textContent='';const prepared=P.preview(data(options),request()),view=renderPreview(prepared);preview=prepared;previewBox.replaceChildren(view);error.textContent=(preview.issues||[]).map(x=>typeof x==='string'?x:x.message||JSON.stringify(x)).join('\n');generate.disabled=!preview.documents.length||!!preview.issues?.length;generate.hidden=generate.disabled;showPreview.classList.toggle('primary',generate.disabled);if(!generate.disabled){result.textContent=preview.documents.length+'건의 발주서입니다. 전표별 담당자·조건·금액을 확인하고 생성하세요.';previewBox.focus();}}catch(e){preview=undefined;generate.disabled=generate.hidden=true;error.textContent=e.message;}},'primary');
    const footer=N('div',undefined,'plan-footer'),actions=N('div',undefined,'inv-toolbar');actions.append(showPreview,generate,button('닫기',close));footer.append(result,error,actions);d.append(footer);generate.hidden=true;for(const [name,el]of Object.entries(controls))el.addEventListener(['query','reference'].includes(name)?'input':'change',()=>{if(name==='partner')partnerManual=true;invalidate();mode();if(name==='query'){page=0;refresh();}});
    if(options.ids?.length){P.candidates(data(options),{ids:options.ids}).filter(r=>!options.selections?.length||options.selections.some(x=>x.documentId===r.documentId&&(x.lineId?x.lineId===r.lineId:x.item===r.item))).forEach(r=>selected.add(r.key));}mode();refresh();if(!rows.length)error.textContent='발주서로 생성할 미처리 수량이 없습니다. 이미 처리했거나 완료한 계획인지 확인하세요.';showPreview.disabled=!writable(options);d.showModal();return d;
  }
  root.PurchasePlanUI={open,groups};
})(typeof globalThis==='object'?globalThis:this);
