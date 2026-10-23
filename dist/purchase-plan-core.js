(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
 const clone=C.clone,qty=C.quantity,MAX_SELECTIONS=100;
 const modes=[['supplier-date-line','거래처별납기일자별라인별'],['supplier-date-item','거래처별납기일자별품목별'],['single-line','1장라인별'],['single-item','1장품목별'],['custom','직접설정']];
 const stable=value=>JSON.stringify(sortObject(value));
 function sortObject(value){if(Array.isArray(value))return value.map(sortObject);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortObject(value[key])]));return value;}
 function date(value,label){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error((label||'일자')+'를 확인하세요.');return value;}
 function positive(value){const n=Number(value);if(value===''||value===null||typeof value==='boolean'||!Number.isFinite(n)||n<.000001||n>1e12)throw Error('생성할 수량은 0보다 큰 값이어야 합니다.');return qty(n);}
 function candidateRows(db,options={}){
   if(options.from)date(options.from,'기간 시작');if(options.to)date(options.to,'기간 종료');if(options.from&&options.to&&options.from>options.to)throw Error('조회 기간을 확인하세요.');
   const query=String(options.query||'').trim().toLocaleLowerCase('ko-KR');
   return db.documents.filter(d=>d.type==='plan'&&C.active(d)&&(!options.ids||options.ids.includes(d.id))&&(!options.from||d.date>=options.from)&&(!options.to||d.date<=options.to)).flatMap(d=>C.remaining(db,d,'purchaseorder').filter(l=>l.qty>0&&C.purchasingLineState(d,l).progress!=='완료').map(line=>{
     const item=C.master(db,'items',line.item),supplier=C.purchaseSupplier(db,line,d),partner=C.master(db,'partners',supplier),original=d.lines.find(l=>line.lineId?l.lineId===line.lineId:l.item===line.item);
     return {key:d.id+'|'+(line.lineId||line.item),...(line.lineId?{lineId:line.lineId}:{}),documentId:d.id,date:d.date,item:line.item,name:item?.name||line.item,spec:item?.spec||'',unit:item?.unit||'',dueDate:original.dueDate||d.dueDate||'',warehouse:d.warehouse,supplier,supplierName:partner?.name||'',supplierValid:!!partner&&!partner.disabled,disabled:!item||item.disabled||!C.master(db,'warehouses',d.warehouse)||C.master(db,'warehouses',d.warehouse).disabled,originalQty:original.qty,processedQty:qty(original.qty-line.qty),qty:line.qty,price:line.price||0,discount:line.discount||0,memo:line.memo||''};
   })).filter(row=>!query||[row.documentId,row.item,row.name,row.spec,row.supplierName].some(v=>String(v).toLocaleLowerCase('ko-KR').includes(query))).sort((a,b)=>a.date.localeCompare(b.date)||a.documentId.localeCompare(b.documentId)||a.item.localeCompare(b.item,'ko-KR',{numeric:true}));
 }
 function header(source){
   if(source.transactionType!==undefined&&(typeof source.transactionType!=='string'||source.transactionType.length>200))throw Error('원본 거래유형 코드를 확인하세요.');
   const result={warehouse:source.warehouse,vatRate:source.vatRate??10};for(const field of ['employee','project','currency','transactionType','taxRounding','supplyRounding','custom'])if(source[field]!==undefined)result[field]=clone(source[field]);
   if(result.transactionType==='22'&&Number(result.vatRate)!==0)throw Error('원본 거래유형과 부가세율을 함께 적용할 수 없습니다. 원본 계획의 머리 항목을 확인하세요.');
   return result;
 }
 function preview(db,input={}){
   const request=clone(input),grouping=request.grouping||'supplier-date-line';if(!modes.some(([key])=>key===grouping))throw Error('정리 방식을 선택하세요.');
   const generationDate=date(request.date||C.today(),'생성일');if(request.dueDate)date(request.dueDate,'납기일');
   const overrideEmployee=Object.prototype.hasOwnProperty.call(request,'employeeOverride');
   if(overrideEmployee){const employee=typeof request.employeeOverride==='string'&&request.employeeOverride?C.master(db,'employees',request.employeeOverride):null;if(!employee||employee.disabled)throw Error('일괄 지정할 담당자는 사용 중인 등록 담당자를 선택하세요.');}
   const overrideReference=Object.prototype.hasOwnProperty.call(request,'referenceOverride');
   if(overrideReference&&(typeof request.referenceOverride!=='string'||!request.referenceOverride.trim()))throw Error('일괄 지정할 참조를 텍스트로 입력하세요.');
   if(!Array.isArray(request.selections)||!request.selections.length||request.selections.length>MAX_SELECTIONS)throw Error('발주계획 품목을 1~'+MAX_SELECTIONS+'행 선택하세요.');
   const resolvedSuppliers=[...new Set(request.selections.map(x=>{const source=db.documents.find(d=>d.id===x.documentId),line=source?.lines.find(l=>x.lineId?l.lineId===x.lineId:l.item===x.item);return x.supplier||C.purchaseSupplier(db,line,source);}).filter(Boolean))];
   if(!request.partner&&resolvedSuppliers.length===1)request.partner=resolvedSuppliers[0];
   const policy=grouping==='custom'?{splitSupplier:request.custom?.splitSupplier!==false,splitDueDate:request.custom?.splitDueDate!==false,mergeItems:request.custom?.mergeItems===true}:{splitSupplier:grouping.startsWith('supplier-'),splitDueDate:grouping.startsWith('supplier-'),mergeItems:grouping.endsWith('-item')};
   const issue=(key,message)=>({key,message}),issues=[],selected=[],seen=new Set(),current=new Map(candidateRows(db).map(row=>[row.key,row])),facts=[],sourceFacts=new Map(),itemFacts=new Map();
   for(const selection of request.selections){
     const key=selection.documentId+'|'+(selection.lineId||selection.item);if(seen.has(key)){issues.push(issue(key,'같은 발주계획 품목을 중복 선택했습니다.'));continue;}seen.add(key);
     const row=current.get(key),source=db.documents.find(d=>d.id===selection.documentId);if(!row||!source||row.item!==selection.item){issues.push(issue(key,'원본이 취소·완료되었거나 처리할 잔량이 없습니다.'));continue;}
     const original=source.lines.find(l=>selection.lineId?l.lineId===selection.lineId&&l.item===selection.item:l.item===selection.item),item=C.master(db,'items',selection.item);facts.push(row);sourceFacts.set(source.id,source);itemFacts.set(item?.code,item);
     try{
       if(row.disabled)throw Error('사용 중인 품목과 창고를 선택하세요.');const amount=positive(selection.qty===undefined?row.qty:selection.qty);if(amount>row.qty+.000001)throw Error('원본 발주계획의 잔량을 초과했습니다.');
       const supplier=policy.splitSupplier?(selection.supplier===undefined?row.supplier:selection.supplier):request.partner,partner=C.master(db,'partners',supplier);if(!supplier||!partner||partner.disabled)throw Error(policy.splitSupplier?row.item+' '+row.name+': 품목등록에서 구매처를 지정하거나 이 행의 구매처를 선택하세요.':'1장으로 생성할 발주서의 거래처를 지정하세요.');
       const dueDate=selection.dueDate||row.dueDate||request.dueDate;date(dueDate,'납기일');
       const line=clone(original);delete line.supply;delete line.tax;delete line.total;delete line.sourceLineId;delete line.lineId;delete line.planAllocations;delete line.progress;
       line.qty=amount;line.dueDate=dueDate;line.planAllocations=[{documentId:source.id,item:line.item,qty:amount,...(original.lineId?{sourceLineId:original.lineId}:{})}];line.importedFrom=[...(line.importedFrom||[]),{documentId:source.id,type:'plan',date:source.date,item:line.item,qty:amount,mode:'linked'}];
       selected.push({key,source,line,supplier,header:header(source),dueDate});
     }catch(e){issues.push(issue(key,e.message));}
   }
   const groups=new Map();for(const row of selected){
     const context=stable(row.header),key=stable([policy.splitSupplier?row.supplier:request.partner,policy.splitDueDate?row.dueDate:'',context]);
     if(!groups.has(key))groups.set(key,{key,partner:row.supplier,context,header:row.header,rows:[]});groups.get(key).rows.push(row);
   }
   if(!policy.splitSupplier&&!policy.splitDueDate&&groups.size>1)issues.push(issue('header','1장 생성은 창고·통화·거래유형·부가세율·담당자·프로젝트·추가 머리 항목이 같아야 합니다. 다른 조건은 나누어 선택하세요.'));
   const documents=[];
   for(const group of groups.values()){
     const lines=[];for(const row of group.rows){const line=row.line,existing=policy.mergeItems?lines.find(l=>l.item===line.item):null;
       if(existing){
         const comparable=value=>Object.fromEntries(Object.entries({...value,price:Number(value.price||0),discount:Number(value.discount||0),memo:value.memo||'',custom:value.custom||{}}).filter(([key])=>!['qty','dueDate','planAllocations','importedFrom','lineId'].includes(key)));
         if(stable(comparable(existing))!==stable(comparable(line))){issues.push(issue(row.key,'품목별 합산할 단가·할인·적요·추가 항목이 다릅니다. 라인별 정리 방식을 선택하세요.'));continue;}
         existing.qty=qty(existing.qty+line.qty);existing.planAllocations.push(...line.planAllocations);existing.importedFrom.push(...line.importedFrom);if(existing.dueDate!==line.dueDate)existing.dueDate='';
       }else lines.push({...line,lineId:'PL'+(lines.length+1)});
     }
     const dueDates=[...new Set(group.rows.map(r=>r.dueDate))],doc={...clone(group.header),...(overrideEmployee?{employee:request.employeeOverride}:{}),...(overrideReference?{reference:request.referenceOverride}:{}),type:'purchaseorder',date:generationDate,partner:group.partner,dueDate:dueDates.length===1?dueDates[0]:'',status:'진행',accounted:false,generatedFrom:'purchase-plan',planGeneration:{grouping,policy:clone(policy),sourceIds:[...new Set(group.rows.map(r=>r.source.id))]},memo:request.memo||'',lines};
     documents.push(doc);
   }
   if(documents.length>200)issues.push(issue('limit','한 번에 생성할 발주서는 200장까지 가능합니다. 선택 범위를 줄이세요.'));
   const summary={plans:new Set(selected.map(r=>r.source.id)).size,selectedLines:selected.length,documents:documents.length,lines:documents.reduce((sum,d)=>sum+d.lines.length,0),quantity:qty(selected.reduce((sum,r)=>sum+r.line.qty,0)),total:C.money(documents.reduce((sum,d)=>sum+C.totals(d).total,0)),suppliers:[...new Set(documents.map(d=>d.partner))]};
   return {documents,issues,summary,request:{...request,date:generationDate,grouping},snapshot:stable({facts,sources:[...sourceFacts.values()],items:[...itemFacts.values()],documents,issues})};
 }
 function commit(db,prepared,policy){
   if(!prepared||typeof prepared.snapshot!=='string'||!prepared.request)throw Error('생성 미리보기를 먼저 확인하세요.');
   const current=preview(db,prepared.request);if(current.issues.length)throw Error(current.issues[0].message);if(current.snapshot!==prepared.snapshot||stable(current.documents)!==stable(prepared.documents))throw Error('발주계획·품목·잔량 또는 미리보기가 변경됐습니다. 미리보기를 다시 확인하세요.');
   return C.command(db,'purchasePlanGenerate',{documents:current.documents},policy);
 }
 const api={modes,MAX_SELECTIONS,candidates:candidateRows,preview,commit};if(typeof module==='object'&&module.exports)module.exports=api;else root.PurchasePlanCore=api;
})(typeof globalThis==='object'?globalThis:this);
