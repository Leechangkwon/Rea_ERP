(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
 const groupings=['일별','월별','라인별','전표별','품목별','전표별품목별','거래처별','담당자별'];
 const summaryDimensions={'품목별':{id:'item',master:'items'},'거래처별':{id:'partner',master:'partners'},'창고별':{id:'warehouse',master:'warehouses'},'담당자별':{id:'employee',master:'employees'},'프로젝트별':{id:'project',master:'projects'},'품목그룹1별':{id:'group1',itemField:'group1'},'품목그룹2별':{id:'group2',itemField:'group2'},'품목그룹3별':{id:'group3',itemField:'group3'},'일별':{id:'periodDay',dateUnit:'day'},'월별':{id:'periodMonth',dateUnit:'month'},'분기별':{id:'periodQuarter',dateUnit:'quarter'},'반기별':{id:'periodHalf',dateUnit:'half'},'연별':{id:'periodYear',dateUnit:'year'}};
 summaryDimensions['전표별']={id:'voucher',identity:'document'};
 summaryDimensions['라인별']={id:'voucherLine',identity:'line'};
 for(const [name,master]of [['거래처','partners'],['프로젝트','projects']])for(const n of [1,2])summaryDimensions[name+'그룹'+n+'별']={id:(master==='partners'?'partner':'project')+'Group'+n,groupMaster:master,groupField:'group'+n};
 const summaryAxes=Object.keys(summaryDimensions);
 const legacySummary=type=>['plan','purchaseorder'].includes(type);
 const planSummaryAxes=summaryAxes.filter(axis=>!summaryDimensions[axis].identity),planAxisLabels={'품목별':'품목명[규격]','거래처별':'거래처','창고별':'창고','담당자별':'담당자','프로젝트별':'프로젝트'};
 for(const axis of planSummaryAxes)if(/그룹[123]별$/.test(axis))planAxisLabels[axis]=axis.slice(0,-1);
 const availableSummaryAxes=type=>legacySummary(type)?planSummaryAxes:summaryAxes;
 const axisLabel=(type,axis)=>legacySummary(type)?(planAxisLabels[axis]||axis):axis;
 const graphMetrics={quantity:'수량',supply:'공급가액',tax:'부가세',total:'합계'};
 const purchaseColumns=['입고일자 _ NO','발주 일자 - NO','창고명','사원(담당)명','거래처명','품목코드','품목명','규격정보','단가(vat포함)','수량','박스단위','단위','공급가액','부가세','합계','적요','품목그룹1명','품목그룹2명','품목그룹3명'];
 const specifications={
  request:{title:'발주요청현황',header:['일자-No.','거래처명','사원(담당)명','납기일자','참조','진행상태'],headerKeys:['id','partner','employee','dueDate','reference','progress'],line:['품목명(규격)','낱개수량','단가','공급가액','부가세'],lineKeys:['name','qty','price','supply','tax'],menu:'현황',number:true,managed:true,summaryAllowed:true,summarySlots:5,summaryQuantityLabel:'수량 (낱개 단위)'},
  plan:{title:'발주계획현황',header:['일자-No.','거래처명','담당자명','납기일자','참조','진행상태'],headerKeys:['id','partner','employee','dueDate','reference','progress'],line:['품목명[규격명]','수량','단가','공급가액','부가세',''],lineKeys:['name','qty','price','supply','tax','blank'],menu:'내역',automaticAlert:true,summaryAllowed:true,summaryTargets:true},
  purchaseorder:{title:'발주서현황',header:['일자-No.','거래처','담당자','창고명','납기일자','참조','진행상태'],headerKeys:['id','partner','employee','warehouse','dueDate','reference','progress'],line:['품목명[규격]','','낱개수량','단가','공급가액','부가세','품목별납기일자'],lineKeys:['name','blank','qty','price','supply','tax','dueDate'],menu:'내역',automaticAlert:true,years:true,approval:true,summaryAllowed:true,summaryTargets:true},
  purchase:{title:'구매현황',header:purchaseColumns,headerKeys:[],line:purchaseColumns,lineKeys:['receipt','order','warehouse','employee','partner','item','name','spec','vatPrice','qty','boxUnit','unit','supply','tax','total','memo','group1','group2','group3'],menu:'현황',flat:true,template:'REA 구매 내역 양식',purchaseFilters:true,weekStart:0,summarySlots:5}
 };
 const lookup=(db,key,code)=>C.master(db,key,code)?.name||code||'';
 const within=(date,from,to)=>!from&&!to||Boolean(date)&&(!from||date>=from)&&(!to||date<=to);
 function sortFields(type,filter={}){
  if(type!=='purchase')return [];
  if(filter.mode==='summary')return [...(filter.axes||[]).filter(x=>summaryAxes.includes(x)).map(x=>({id:summaryDimensions[x].id,label:x,kind:'text'})),...['qty','supply','tax','total'].map((id,i)=>({id,label:['수량','공급가액','부가세','합계'][i],kind:'number'}))];
  return specifications.purchase.lineKeys.map((id,i)=>({id,label:purchaseColumns[i],kind:['qty','vatPrice','supply','tax','total'].includes(id)?'number':'text'}));
 }
 function validateSort(type,filter,fields){
  const order=filter.sort===undefined?[]:filter.sort;if(!Array.isArray(order)||order.length>5)throw Error('정렬 기준은 최대 5개입니다.');
  if(order.length&&type!=='purchase')throw Error('이 화면의 정렬 기준 결과는 아직 확인하지 않았습니다.');
  const allowed=new Set(fields.map(f=>f.id));
  for(const row of order)if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['field','direction'].includes(k))||!allowed.has(row.field)||!['asc','desc'].includes(row.direction))throw Error('현재 조회의 정렬 기준과 방법을 확인하세요.');
  if(new Set(order.map(x=>x.field)).size!==order.length)throw Error('정렬 기준을 중복 선택할 수 없습니다.');
  return order.map(x=>({...x}));
 }
 function sortResult(result,fields,order){
  if(order.length){const indexes=new Map(fields.map((f,i)=>[f.id,i])),decorated=result.rows.map((row,index)=>({row,index}));decorated.sort((a,b)=>{for(const rule of order){const i=indexes.get(rule.field),left=a.row[i],right=b.row[i],emptyA=left==null||left==='',emptyB=right==null||right==='';let value=emptyA||emptyB?(emptyA===emptyB?0:emptyA?-1:1):fields[i].kind==='number'?Number(left)-Number(right):String(left).localeCompare(String(right),'ko',{numeric:true});if(value)return rule.direction==='desc'?-value:value;}return a.index-b.index;});result.rows=decorated.map(x=>x.row);if(result.rowRecords)result.rowRecords=decorated.map(x=>result.rowRecords[x.index]);if(result.records)result.records=decorated.map(x=>result.records[x.index]);}
  result.sort=order;result.sortFields=fields;result.sortLabel=order.map(r=>(fields.find(f=>f.id===r.field)?.label||r.field)+' '+(r.direction==='desc'?'내림차순':'오름차순')).join(' / ');return result;
 }
 function validateDates(filter){
  for(const [from,to,label]of [['from','to','조회'],['dueFrom','dueTo','납기']]){
   for(const key of [from,to]){const value=filter[key];if(value!==undefined&&value!==''){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error(label+' 일자를 확인하세요.');}}
   if(filter[from]&&filter[to]&&filter[from]>filter[to])throw Error(label+' 시작일은 종료일보다 늦을 수 없습니다.');
  }
 }
 // Legacy credit returns store positive frozen amounts; only the report projection is signed.
 function reportAmount(doc,line){
  const amount=C.effectiveLineTotals(doc,line);
  if(doc.type!=='purchasereturn'||doc.settlementMode!=='credit')return amount;
  return {...amount,...Object.fromEntries(['qty','supply','tax','total'].map(key=>[key,amount[key]===0?0:-amount[key]]))};
 }
 const purchaseKinds={all:'전체',normal:'일반',return:'반품'};
 function search(db,type,filter={}){
  const spec=specifications[type];if(!spec)throw Error('직접 관찰되지 않은 현황 화면입니다.');
  validateDates(filter);
  const purchaseKind=filter.purchaseKind??'all';
  if(!Object.hasOwn(purchaseKinds,purchaseKind)||typeof purchaseKind!=='string'||type!=='purchase'&&filter.purchaseKind!==undefined)throw Error('구매구분을 확인하세요.');
  const purchaseContext=type==='purchase'?{purchaseKind,purchaseKindLabel:'구매구분 '+purchaseKinds[purchaseKind]}:{};
  const mode=filter.mode||'detail';if(!['detail','summary'].includes(mode))throw Error('조회 메뉴를 확인하세요.');
  if(filter.graph!==undefined&&typeof filter.graph!=='boolean')throw Error('그래프 표시 조건을 확인하세요.');
  if(filter.graph&&(type!=='purchase'||mode!=='summary'))throw Error('그래프는 구매 집계에서 사용할 수 있습니다.');
  if(mode==='summary'&&type!=='purchase'&&!spec.summaryAllowed)throw Error('이 화면의 집계 결과는 아직 확인하지 않았습니다.');
  let axes=[],axisDirections=[],axisSubtotals=[],measureIds=Object.keys(graphMetrics);if(mode==='summary'){
   if(!Array.isArray(filter.axes)||filter.axes.some(x=>typeof x!=='string'))throw Error('집계조건은 1개 이상 선택해야 합니다.');
   if(filter.axes.length>5)throw Error('집계조건은 최대 5개입니다.');
   const directions=filter.axisDirections===undefined?[]:filter.axisDirections;if(!Array.isArray(directions)||directions.length&&directions.length!==filter.axes.length||directions.some(x=>!['asc','desc'].includes(x)))throw Error('집계 방향을 확인하세요.');
   axisDirections=filter.axes.flatMap((axis,i)=>axis?[directions[i]||'asc']:[]);
   const subtotals=filter.axisSubtotals;if(subtotals!==undefined&&(!Array.isArray(subtotals)||subtotals.length!==filter.axes.length||subtotals.some(x=>typeof x!=='boolean')))throw Error('집계 소계 표시를 확인하세요.');
   axisSubtotals=filter.axes.flatMap((axis,i)=>axis?[subtotals?.[i]??false]:[]);
   axes=filter.axes.filter(Boolean);if(!axes.length)throw Error('집계조건은 1개 이상 선택해야 합니다.');
   if(axes.some(x=>!availableSummaryAxes(type).includes(x)))throw Error('지원하는 집계조건을 선택하세요.');
   if(new Set(axes).size!==axes.length)throw Error('집계조건을 중복 선택할 수 없습니다.');
   if(filter.summaryMeasures!==undefined){const selected=filter.summaryMeasures;if(!spec.summaryTargets)throw Error('이 화면의 집계대상 결과는 아직 확인하지 않았습니다.');if(!Array.isArray(selected)||selected.length>4||Array.from(selected).some(x=>typeof x!=='string'||!Object.hasOwn(graphMetrics,x))||new Set(selected).size!==selected.length)throw Error('집계대상을 확인하세요.');if(selected.length)measureIds=measureIds.filter(x=>selected.includes(x));}

  }
  if(mode==='detail'&&filter.grouping&&filter.grouping!=='라인별')throw Error('이 구분의 결과 화면은 아직 확인하지 않았습니다.');
  const fields=sortFields(type,{mode,axes}),order=validateSort(type,filter,fields);
  if(filter.tradeType||filter.serialLot)throw Error('해당 검색 조건의 원본 하위 규칙은 아직 확인하지 않았습니다.');
  if(filter.managedItem)throw Error('관리항목 조회 규칙은 아직 확인하지 않았습니다.');
  if(filter.comparison&&filter.comparison!=='사용안함')throw Error('기간 비교 결과는 아직 확인하지 않았습니다.');
  const query=String(filter.query||'').trim().toLowerCase(),groups=[];
  for(const doc of db.documents){
   if(!(doc.type===type||type==='purchase'&&doc.type==='purchasereturn'&&doc.settlementMode==='credit')||!C.listed(doc)||!within(doc.date,filter.from,filter.to)||filter.number&&!doc.id.includes(filter.number)||filter.warehouse&&doc.warehouse!==filter.warehouse||filter.project&&doc.project!==filter.project)continue;
   const foreign=Boolean(doc.currency&&doc.currency!=='KRW');if(filter.currency==='domestic'&&foreign||filter.currency==='foreign'&&!foreign)continue;
   const lines=doc.lines.filter(line=>(type!=='purchase'||purchaseKind==='all'||(purchaseKind==='normal'?reportAmount(doc,line).qty>0:reportAmount(doc,line).qty<0))&&within(line.dueDate||doc.dueDate,filter.dueFrom,filter.dueTo)&&(!filter.partner||(line.supplier||doc.partner)===filter.partner)&&(!filter.item||line.item===filter.item));
   if(!lines.length)continue;
   const lineState=line=>C.purchasingLineState?C.purchasingLineState(doc,line).progress:line.progress??(C.purchasingState?C.purchasingState(doc).progress:doc.status);
   const state=doc.lines.every(l=>lineState(l)==='완료')?'완료':'진행중';
   const headerValues={id:doc.date+' '+doc.id,partner:lookup(db,'partners',doc.partner),employee:lookup(db,'employees',doc.employee),warehouse:lookup(db,'warehouses',doc.warehouse),dueDate:doc.dueDate||'',reference:doc.reference||'',progress:state};
   const header=spec.headerKeys.map(key=>headerValues[key]??'');
   const details=lines.map(line=>{const item=C.master(db,'items',line.item),amount=reportAmount(doc,line),name=(item?.name||line.item)+(item?.spec?(type==='request'?' ('+item.spec+')':' ['+item.spec+']'):'');const order=doc.sourceId?db.documents.find(d=>d.id===doc.sourceId&&d.type==='purchaseorder'):null;const fields={receipt:doc.date+' '+doc.id,order:order?order.date+' '+order.id:'',warehouse:lookup(db,'warehouses',doc.warehouse),employee:lookup(db,'employees',doc.employee),partner:lookup(db,'partners',line.supplier||doc.partner),item:line.item,spec:item?.spec||'',vatPrice:C.money(amount.price*(1+Number(doc.vatRate??10)/100)),boxUnit:item?.boxUnit??'',unit:item?.unit??'',total:amount.total,memo:line.memo??'',group1:item?.group1Name??item?.group1??'',group2:item?.group2Name??item?.group2??'',group3:item?.group3Name??item?.group3??'',name:spec.flat?(item?.name||line.item):name,qty:amount.qty,price:amount.price,supply:amount.supply,tax:amount.tax,blank:'',dueDate:line.dueDate||doc.dueDate||''};return {line,amount,values:spec.lineKeys.map(key=>fields[key]??'')};});
   if(query&&!JSON.stringify([header,details.map(x=>x.values)]).toLowerCase().includes(query))continue;
   groups.push({document:doc,header,lines:details});
  }
  groups.sort((a,b)=>a.document.date.localeCompare(b.document.date)||a.document.id.localeCompare(b.document.id));
  if(mode==='summary')return {...summaryOutput(sortResult(summarize(db,groups,axes,spec.title,axisDirections,type,measureIds),fields,order),axisSubtotals,type),...purchaseContext};
  return sortResult({...purchaseContext,layout:spec.flat?'flat':'grouped',columns:[...spec.header],rows:spec.flat?groups.flatMap(g=>g.lines.map(l=>l.values)):undefined,rowRecords:spec.flat?groups.flatMap(g=>g.lines.map(l=>({document:g.document,line:l.line}))):undefined,title:spec.title,headerColumns:[...spec.header],lineColumns:[...spec.line],groups,summary:{documents:groups.length,lines:groups.reduce((n,g)=>n+g.lines.length,0),quantity:C.quantity(groups.reduce((n,g)=>n+g.lines.reduce((s,l)=>s+l.amount.qty,0),0)),supply:C.money(groups.reduce((n,g)=>n+g.lines.reduce((s,l)=>s+l.amount.supply,0),0)),tax:C.money(groups.reduce((n,g)=>n+g.lines.reduce((s,l)=>s+l.amount.tax,0),0))}},fields,order);
 }
 function summaryAxisCode(db,doc,line,axis,position){
  const dimension=summaryDimensions[axis];if(dimension.groupMaster){const code=dimension.groupMaster==='partners'?(line.supplier||doc.partner):doc.project;return String(C.master(db,dimension.groupMaster,code)?.[dimension.groupField]??'');}if(dimension.identity)return dimension.identity==='document'?doc.id:JSON.stringify([doc.id,line.lineId?'id':'position',line.lineId||position]);if(dimension.itemField){const item=C.master(db,'items',line.item);return String((dimension.itemField==='group1'?(item?.group1??item?.group):item?.[dimension.itemField])??'');}if(!dimension.dateUnit)return axis==='품목별'?line.item:axis==='거래처별'?(line.supplier||doc.partner||''):(doc[dimension.id]||'');
  validateDates({from:doc.date});if(!doc.date)throw Error('집계 일자를 확인하세요.');const year=doc.date.slice(0,4),month=Number(doc.date.slice(5,7));
  return dimension.dateUnit==='day'?doc.date:dimension.dateUnit==='month'?doc.date.slice(0,7):dimension.dateUnit==='quarter'?year+'-Q'+Math.ceil(month/3):dimension.dateUnit==='half'?year+'-H'+(month<=6?1:2):year;
 }
 function summaryAxisLabel(db,axis,code,doc,position,type){
  if(!code)return '미지정';const dimension=summaryDimensions[axis];if(dimension.identity)return doc.date+' '+doc.id+(dimension.identity==='line'?' · '+position+'행':'');if(dimension.itemField||dimension.groupMaster)return code;if(dimension.dateUnit){if(['day','month'].includes(dimension.dateUnit))return code.replaceAll('-','/');if(dimension.dateUnit==='quarter')return code.slice(0,4)+'/ '+code.at(-1)+'분기';if(dimension.dateUnit==='half')return code.slice(0,4)+'/ '+(code.endsWith('1')?'상반기':'하반기');return code+'/';}
  const master=C.master(db,dimension.master,code);if(legacySummary(type))return (master?.name||code)+(axis==='품목별'&&master?.spec?'['+master.spec+']':'');return code+(master?.name?' · '+master.name:'');
 }
 // Own report arithmetic over selected local voucher lines; original server formulas remain unknown.
 function summarize(db,documents,axes,title,axisDirections,type,measureIds){
  const currencies=new Set(documents.map(g=>g.document.currency||'KRW'));if(currencies.size>1)throw Error('서로 다른 통화는 함께 집계할 수 없습니다. 내·외자 또는 거래처 조건을 좁혀 주세요.');
  const groups=new Map(),summary={documents:documents.length,lines:0,quantity:0,supply:0,tax:0,total:0};
  for(const group of documents){const positions=axes.includes('라인별')?new Map(group.document.lines.map((line,i)=>[line,i+1])):null;for(const detail of group.lines){
   const doc=group.document,line=detail.line,position=positions?.get(line),axis=axes.map(x=>summaryAxisCode(db,doc,line,x,position)),key=JSON.stringify(axis);
   let row=groups.get(key);if(!row){row={axis,labels:axis.map((code,i)=>summaryAxisLabel(db,axes[i],code,doc,position,type)),quantity:0,supply:0,tax:0,total:0};groups.set(key,row);}
   row.quantity=C.quantity(row.quantity+detail.amount.qty);summary.quantity=C.quantity(summary.quantity+detail.amount.qty);summary.lines++;
   for(const k of ['supply','tax','total']){row[k]=C.money(row[k]+detail.amount[k]);summary[k]=C.money(summary[k]+detail.amount[k]);}
  }}
  const records=[...groups.values()].sort((a,b)=>{for(let i=0;i<axes.length;i++){const order=(summaryDimensions[axes[i]].identity?a.labels[i]:a.axis[i]).localeCompare(summaryDimensions[axes[i]].identity?b.labels[i]:b.axis[i],'ko',{numeric:true});if(order)return axisDirections[i]==='desc'?-order:order;}return JSON.stringify(a.axis).localeCompare(JSON.stringify(b.axis));});
  const columns=[...axes.map(axis=>axisLabel(type,axis)),...measureIds.map(id=>id==='quantity'?(specifications[type].summaryQuantityLabel||graphMetrics[id]):graphMetrics[id])];
  const currency=[...currencies][0]||'';return {layout:'summary',title:title+' 집계'+(currency?' · '+currency:''),columns,headerColumns:columns,lineColumns:columns,rows:records.map(r=>[...r.labels,...measureIds.map(id=>r[id])]),records,measureIds:[...measureIds],measureLabel:measureIds.length<4?'집계대상 '+measureIds.map(id=>graphMetrics[id]).join(' / '):'',axes:[...axes],identityBasisLabel:axes.some(axis=>summaryDimensions[axis].identity)?'전표별·라인별은 REA 전표 번호와 현재 행 번호로 표시합니다.':'',groupBasisLabel:['품목','거래처','프로젝트'].filter(name=>axes.some(axis=>axis.startsWith(name+'그룹'))).map(name=>name+'그룹은 현재 '+name+' 등록정보 기준으로 집계합니다.').join(' '),axisDirections:[...axisDirections],axisOrderLabel:axes.map((axis,i)=>axisLabel(type,axis)+' '+(axisDirections[i]==='desc'?'내림차순':'오름차순')).join(' / '),groups:documents,summary,currency};
 }
 // Legacy plan/order reports keep full prefix boundaries and suppress leaf subtotals.
 // Request reports retain leaf subtotals but also keep full prefix boundaries.
 // Purchase reports retain their separate enabled-axis boundary policy.
 function summaryOutput(result,flags,type){
  const active=flags.flatMap((enabled,i)=>enabled&&(!legacySummary(type)||i<result.axes.length-1)?[i]:[]),amountKeys=result.measureIds||['quantity','supply','tax','total'],tableRows=[],accumulators=active.map(()=>amountKeys.map(()=>0));let previous;
  const appendTotal=(kind,label,amounts,axisIndex)=>tableRows.push({kind,axisIndex,labelSpan:result.axes.length,values:[label,...Array(result.axes.length-1).fill(''),...amounts]});
  const flush=from=>{for(let j=active.length-1;j>=from;j--){const axisIndex=active[j];appendTotal('subtotal',(previous.labels[axisIndex]||'미지정')+' 계',[...accumulators[j]],axisIndex);accumulators[j].fill(0);}};
  result.records.forEach((record,i)=>{if(previous){const changed=active.findIndex(axisIndex=>(legacySummary(type)||type==='request')?previous.axis.slice(0,axisIndex+1).some((value,i)=>value!==record.axis[i]):previous.axis[axisIndex]!==record.axis[axisIndex]);if(changed>=0)flush(changed);}tableRows.push({kind:'data',recordKey:JSON.stringify(record.axis),values:[...result.rows[i]]});for(const amounts of accumulators)amountKeys.forEach((key,j)=>{amounts[j]=(key==='quantity'?C.quantity:C.money)(amounts[j]+record[key]);});previous=record;});
  if(previous){flush(0);appendTotal('total',legacySummary(type)?'합계':'총합계',amountKeys.map(key=>result.summary[key]));}
  result.axisSubtotals=[...flags];result.subtotalLabel=active.length?'소계 '+active.map(i=>axisLabel(type,result.axes[i])).join(' / '):'소계 표시 안 함';result.tableRows=tableRows;result.exportRows=tableRows.map(row=>[...row.values]);return result;
 }
 const drilldownAxes=summaryAxes.filter(axis=>!summaryDimensions[axis].identity);
 function drilldown(db,filter,key){
  if(filter?.mode!=='summary'||typeof key!=='string')throw Error('집계 상세 조건을 확인하세요.');
  const source=search(db,'purchase',filter);if(source.axes.some(axis=>!drilldownAxes.includes(axis)))throw Error('전표별·라인별 상세 범위는 아직 확인하지 않았습니다.');
  const selected=source.records.find(record=>JSON.stringify(record.axis)===key);if(!selected)throw Error('선택한 집계가 변경됐습니다. 다시 조회하세요.');
  const result=search(db,'purchase',{...filter,mode:'detail',grouping:'라인별',graph:false,sort:[],comparison:'사용안함'}),matches=(doc,line)=>source.axes.every((axis,i)=>summaryAxisCode(db,doc,line,axis)===selected.axis[i]);
  const keep=result.rowRecords.map(({document,line})=>matches(document,line));result.rows=result.rows.filter((_,i)=>keep[i]);result.rowRecords=result.rowRecords.filter((_,i)=>keep[i]);result.groups=result.groups.map(group=>({...group,lines:group.lines.filter(detail=>matches(group.document,detail.line))})).filter(group=>group.lines.length);
  result.summary={documents:result.groups.length,lines:result.rows.length,quantity:0,supply:0,tax:0,total:0};for(const group of result.groups)for(const detail of group.lines){result.summary.quantity=C.quantity(result.summary.quantity+detail.amount.qty);for(const key of ['supply','tax','total'])result.summary[key]=C.money(result.summary[key]+detail.amount[key]);}
  result.title='구매현황 집계 상세'+(source.currency?' · '+source.currency:'');result.period={from:filter.from||'',to:filter.to||''};result.drilldownLabel=source.axes.map((axis,i)=>axis+' '+selected.labels[i]).join(' / ');result.groupBasisLabel=source.groupBasisLabel;return result;
 }
 // Internal arithmetic only. Rendering is gated by observed result specifications.
 function aggregate(facts,grouping){
  if(!groupings.includes(grouping))throw Error('현황 구분을 확인하세요.');
  const groups=new Map();
  for(const fact of facts){
   const d=fact.document,l=fact.line,axis=grouping==='일별'?[d.date]:grouping==='월별'?[d.date.slice(0,7)]:grouping==='전표별'?[d.id]:grouping==='품목별'?[l.item]:grouping==='전표별품목별'?[d.id,l.item]:grouping==='거래처별'?[l.supplier||d.partner||'']:grouping==='담당자별'?[d.employee||'']:[d.id,l.lineId||d.lines.indexOf(l)];
   const key=JSON.stringify(axis),row=groups.get(key)||{key,axis,quantity:0,supply:0,tax:0,total:0,facts:[]},amount=C.effectiveLineTotals(d,l);
   row.quantity=C.quantity(row.quantity+amount.qty);for(const k of ['supply','tax','total'])row[k]=C.money(row[k]+amount[k]);row.facts.push(fact);groups.set(key,row);
  }
  return [...groups.values()];
 }
 function preset(key,today=C.today(),options={}){
  validateDates({from:today,to:today});if(!today)throw Error('조회 일자를 확인하세요.');
  if(key==='enddate')return {from:today,to:today};
  const weekStart=options.weekStart??1;if(![0,1].includes(weekStart))throw Error('주 시작일을 확인하세요.');
  const date=new Date(today+'T12:00:00Z'),format=d=>d.toISOString().slice(0,10),add=n=>new Date(date.getTime()+n*86400000);let from=today,to=today;
  if(key==='yesterday')from=to=format(add(-1));
  if(key==='thisweek'||key==='lastweek'){const start=add(-((date.getUTCDay()-weekStart+7)%7)+(key==='lastweek'?-7:0));from=format(start);to=format(new Date(start.getTime()+6*86400000));}
  if(key==='thisweektoday'||key==='thismonthtoday'){const base=preset(key==='thisweektoday'?'thisweek':'thismonth',today,options);return {from:base.from,to:today};}
  if(key==='lastandthismonth'){from=format(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1,12)));to=today;}
  if(key==='thisyear'||key==='lastyear'){const year=date.getUTCFullYear()+(key==='lastyear'?-1:0);from=year+'-01-01';to=year+'-12-31';}
  if(key==='thismonth'||key==='lastmonth'){const m=date.getUTCMonth()+(key==='lastmonth'?-1:0),y=date.getUTCFullYear();from=format(new Date(Date.UTC(y,m,1,12)));to=format(new Date(Date.UTC(y,m+1,0,12)));}return {from,to};
 }
 // Own chart policy: use each already-aggregated record once, in report order.
 function graphData(result,metric='quantity'){
  if(!Object.hasOwn(graphMetrics,metric))throw Error('그래프 지표를 선택하세요.');
  if(result.layout!=='summary'||!Array.isArray(result.axes)||!result.axes.length||!Array.isArray(result.records)||!result.records.length)throw Error('그래프로 표시할 집계 자료가 없습니다.');
  const keys=new Set(),points=result.records.map(record=>{const value=record[metric];if(!Array.isArray(record.axis)||!Array.isArray(record.labels)||record.axis.length!==result.axes.length||record.labels.length!==result.axes.length||record.axis.some(x=>typeof x!=='string')||record.labels.some(x=>typeof x!=='string')||typeof value!=='number'||!Number.isFinite(value))throw Error('그래프 집계 자료를 확인하세요.');const key=JSON.stringify(record.axis);if(keys.has(key))throw Error('그래프 집계 조합이 중복됐습니다.');keys.add(key);return {key,labels:[...record.labels],label:record.labels.join(' / '),value};});
  return {metric,metricLabel:graphMetrics[metric],currency:metric==='quantity'?'':result.currency||'',title:result.title,axes:[...result.axes],period:result.period?{...result.period}:null,basis:[result.identityBasisLabel,result.groupBasisLabel,result.axisOrderLabel?'집계 방향 '+result.axisOrderLabel:'',result.sortLabel?'정렬 '+result.sortLabel:''].filter(Boolean),color:'#315ca8',...graphDomain(points)};
 }
 function graphDomain(source){const points=source.map(p=>({...p,labels:[...p.labels]}));let min=0,max=0;for(const p of points){min=Math.min(min,p.value);max=Math.max(max,p.value);}const scale=Math.max(Math.abs(min),Math.abs(max))||1,low=min/scale,span=max/scale-low||1,zero=(0-low)/span*1000;for(const p of points){const position=(p.value/scale-low)/span*1000;p.x=Math.min(zero,position);p.width=Math.abs(position-zero);}return {points,zero};}
 function normalizeGraphColor(value,label='색상'){if(typeof value!=='string'||!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value))throw Error(label+' 값을 확인하세요.');const hex=value.slice(1).toLowerCase();return '#'+(hex.length===3?[...hex].map(c=>c+c).join(''):hex);}
 // Independent HSV math. Original tinycolor implementation/rounding was not retained.
 function graphHexToHsv(value){const hex=normalizeGraphColor(value),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),[r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;let h=0;if(delta){h=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;h=(h*60+360)%360;}return {h,s:max?delta/max:0,v:max};}
 function graphHsvToHex(value){if(!value||typeof value!=='object'||['h','s','v'].some(k=>typeof value[k]!=='number'||!Number.isFinite(value[k]))||value.h<0||value.h>360||value.s<0||value.s>1||value.v<0||value.v>1)throw Error('색조·채도·밝기 값을 확인하세요.');const h=value.h===360?0:value.h,c=value.v*value.s,x=c*(1-Math.abs((h/60)%2-1)),m=value.v-c,rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');}
 function filterGraph(graph,selection,pruneMissing=false){
  if(!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(k=>!['keys','color','categoryColors'].includes(k))||!Array.isArray(selection.keys)||!selection.keys.length||selection.keys.some(k=>typeof k!=='string')||new Set(selection.keys).size!==selection.keys.length)throw Error('범주를 하나 이상 선택하세요.');
  const color=normalizeGraphColor(selection.color,'범례 색상'),available=new Set(graph.points.map(p=>p.key));if(!pruneMissing&&selection.keys.some(k=>!available.has(k)))throw Error('그래프 범주가 변경됐습니다. 필터를 다시 여세요.');const colors=selection.categoryColors===undefined?{}:selection.categoryColors;if(!colors||typeof colors!=='object'||Array.isArray(colors))throw Error('범주 색상을 확인하세요.');const categoryColors={};for(const [key,value]of Object.entries(colors)){const normalized=normalizeGraphColor(value,'범주 색상');if(!available.has(key)){if(!pruneMissing)throw Error('색상을 지정한 그래프 범주가 변경됐습니다.');continue;}categoryColors[key]=normalized;}
  const keys=new Set(selection.keys),points=graph.points.filter(p=>keys.has(p.key)).map(p=>({...p,color:categoryColors[p.key]||color}));if(!points.length)throw Error('선택한 그래프 범주에 자료가 없습니다.');
  return {...graph,color,categoryColors,totalPoints:graph.points.length,...graphDomain(points)};
 }
 const api={specifications,groupings,summaryAxes,availableSummaryAxes,axisLabel,sortFields,search,drilldownAxes,drilldown,preset,aggregate,graphMetrics,graphData,filterGraph,normalizeGraphColor,graphHexToHsv,graphHsvToHex};if(typeof module==='object'&&module.exports)module.exports=api;else root.PurchasingReportCore=api;
})(typeof globalThis==='object'?globalThis:this);
