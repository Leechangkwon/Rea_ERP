(function(root){
  'use strict';
  const F=typeof module==='object'&&module.exports?require('./form-core.js'):root.FormCore;
  const I=typeof module==='object'&&module.exports?require('./item-core.js'):root.ItemCore;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  const quantity=n=>Math.round(Number(n)*1000000)/1000000;
  const num=(x,label,min=0)=>{const n=Number(x);if(!Number.isFinite(n)||n<min||Math.abs(n)>1e12)throw Error(label+' 값을 확인하세요.');return n;};
  const types={quote:'견적서',order:'주문서',sale:'판매',shippingorder:'출하지시서',shipment:'출하',request:'발주요청',plan:'발주계획',pricerequest:'단가요청',purchaseorder:'발주서',purchase:'구매',purchasereturn:'구매반품',exchangereceipt:'교환입고',workorder:'작업지시서',issue:'생산불출',work:'작업내역',production:'생산입고',transfer:'창고이동',consume:'자가사용',defect:'불량처리',count:'재고실사',adjust:'재고조정',shoporder:'쇼핑몰주문'};
  const nextTypes={quote:['order'],order:['sale','shippingorder'],shippingorder:['shipment'],request:['plan','purchaseorder','transfer'],plan:['purchaseorder'],pricerequest:['purchaseorder'],purchaseorder:['purchase'],purchase:['purchasereturn'],purchasereturn:['exchangereceipt'],transfer:['sale'],workorder:['issue','work','production'],count:['adjust'],shoporder:['order']};
  const masterNames={items:'품목',partners:'거래처',warehouses:'창고',departments:'부서',projects:'프로젝트',employees:'사원(담당)',controls:'관리항목',approvals:'인쇄용결재라인',currencies:'외화',pricegroups:'거래처특별단가그룹',processes:'공정',resources:'자원',shops:'쇼핑몰'};
  const documentStatuses=['미확인','확인','진행','완료','보류','취소','배송','반품','교환'];
  const statusValue=value=>value==='진행중'?'진행':value||'진행';
  const statusLabel=d=>statusValue(d.status)==='진행'?'진행중':statusValue(d.status);
  const listed=d=>!['취소','반품','교환','보류'].includes(d.status);
  // Unconfirmed vouchers remain visible but do not post stock, money or linked quantities.
  const purchasingTypes=['request','plan','purchaseorder','purchase'];
  const historyActions=['신규','수정','상태변경'];
  const purchaseTransactionTypes=[['21','부가세율 적용'],['22','부가세율 미적용']];
  const historyDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  function validateDocumentHistory(value){
    const string=(x,max=200)=>typeof x==='string'&&x.length<=max;
    const timestamp=x=>string(x,30)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
    const recordKeys=['id','sequence','at','workDate','type','documentId','date','action','partnerCode','partnerCodes','partnerName','itemCodes','itemName','itemCount','employeeCode','employeeName','warehouseCode','projectCode','status','changes'];
    if(!value||value.version!==1||Object.keys(value).some(k=>!['version','sequence','startedAt','records'].includes(k))||!Number.isSafeInteger(value.sequence)||value.sequence<0||!timestamp(value.startedAt)||!Array.isArray(value.records)||value.records.length>200)throw Error('전표 이력 보관 구조를 확인하세요.');
    const ids=new Set();let previous=value.sequence+1;
    for(const r of value.records){
      if(!r||Object.keys(r).some(k=>!recordKeys.includes(k))||!Number.isSafeInteger(r.sequence)||r.sequence<1||r.sequence>=previous||r.id!=='H'+r.sequence||ids.has(r.id)||!timestamp(r.at)||!historyDate(r.workDate)||!historyDate(r.date)||!purchasingTypes.includes(r.type)||!historyActions.includes(r.action)||!Array.isArray(r.itemCodes)||r.itemCodes.some(x=>typeof x!=='string'||!x)||new Set(r.itemCodes).size!==r.itemCodes.length||!Number.isSafeInteger(r.itemCount)||r.itemCount<1||r.itemCodes.length>r.itemCount||!Array.isArray(r.partnerCodes)||r.partnerCodes.length>r.itemCount+1||r.partnerCodes.some(x=>typeof x!=='string'||!x)||new Set(r.partnerCodes).size!==r.partnerCodes.length||!Array.isArray(r.changes)||r.changes.length>100||r.changes.some(x=>!string(x,100)))throw Error('전표 이력 항목을 확인하세요.');
      for(const key of ['documentId','partnerCode','employeeCode','warehouseCode','projectCode'])if(typeof r[key]!=='string')throw Error('전표 이력 식별 자료를 확인하세요.');
      for(const key of ['partnerName','itemName','employeeName','status'])if(!string(r[key]))throw Error('전표 이력 표시 자료를 확인하세요.');
      if(!r.documentId||!documentStatuses.includes(r.status))throw Error('전표 이력 전표·상태를 확인하세요.');
      previous=r.sequence;ids.add(r.id);
    }
    return clone(value);
  }
  function recordDocumentHistory(input,db,op){
    const beforeById=new Map(input.documents.map(d=>[d.id,d]));
    const changed=db.documents.filter(d=>purchasingTypes.includes(d.type)&&JSON.stringify(beforeById.get(d.id))!==JSON.stringify(d));
    if(!changed.length)return;
    const at=new Date().toISOString(),history=input.documentHistory?validateDocumentHistory(input.documentHistory):{version:1,sequence:0,startedAt:at,records:[]};
    const labels={date:'전표일자',partner:'거래처',warehouse:'창고',employee:'담당자',project:'프로젝트',currency:'통화',transactionType:'거래유형',status:'전표상태',confirmation:'확인',progress:'진행',accounted:'회계반영',lines:'품목행',memo:'적요',reference:'참조',vatRate:'부가세율',taxRounding:'부가세 반올림',supplyRounding:'공급가액 반올림'};
    for(const d of changed){
      const before=beforeById.get(d.id),sequence=++history.sequence;
      if(!Number.isSafeInteger(sequence))throw Error('전표 이력 순번 한도에 도달했습니다.');
      const name=(key,code)=>String(master(db,key,code)?.name||'').slice(0,200),code=x=>String(x||''),itemCodes=[...new Set(d.lines.map(l=>code(l.item)))],partnerCodes=[...new Set([d.partner,...(['request','plan'].includes(d.type)?d.lines.map(l=>l.supplier):[])].filter(Boolean).map(code))],partnerCode=code(d.partner)||partnerCodes[0]||'',partnerName=(name('partners',partnerCode)+(partnerCodes.length>1?' 외 '+(partnerCodes.length-1)+'곳':'')).slice(0,200);
      const changes=before?Object.keys(labels).filter(k=>JSON.stringify(before[k])!==JSON.stringify(d[k])).map(k=>labels[k]):['신규 전표'];
      if(before&&!changes.length)changes.push('기타 전표 항목');
      const changedKeys=before?[...new Set([...Object.keys(before),...Object.keys(d)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(d[k])):[];
      const stripProgress=lines=>lines.map(({progress,...line})=>line),stateOnly=before&&changedKeys.length&&changedKeys.every(k=>['status','confirmation','progress','accounted'].includes(k)||k==='lines'&&JSON.stringify(stripProgress(before.lines))===JSON.stringify(stripProgress(d.lines)));
      if(!before)d.createdAt=at;
      d.modifiedAt=at;
      history.records.unshift({id:'H'+sequence,sequence,at,workDate:today(),type:d.type,documentId:code(d.id),date:d.date,action:!before?'신규':['transition','planLineProgress'].includes(op)||stateOnly?'상태변경':'수정',partnerCode,partnerCodes,partnerName,itemCodes,itemName:(name('items',d.lines[0]?.item)||code(d.lines[0]?.item)).slice(0,200),itemCount:d.lines.length,employeeCode:code(d.employee),employeeName:name('employees',d.employee),warehouseCode:code(d.warehouse),projectCode:code(d.project),status:statusValue(d.status),changes});
    }
    history.records=history.records.slice(0,200);db.documentHistory=validateDocumentHistory(history);
  }
  const referenceCodes=value=>[...new Set((Array.isArray(value)?value:value?[value]:[]).filter(x=>typeof x==='string'&&x))];
  const matchesReference=(filter,...values)=>{const codes=referenceCodes(filter);return !codes.length||values.some(value=>codes.includes(value));};
  function sortModified(db,documents,enabled=true){
    if(!enabled)return documents.slice();
    const times=new Map();for(const r of db.documentHistory?.records||[]){const key=r.type+'|'+r.documentId,at=Date.parse(r.at);if(Number.isFinite(at))times.set(key,Math.max(times.get(key)||0,at));}
    const time=d=>Math.max(Number.isFinite(Date.parse(d.modifiedAt))?Date.parse(d.modifiedAt):0,times.get(d.type+'|'+d.id)||0);
    return documents.map((doc,index)=>({doc,index,at:time(doc)})).sort((a,b)=>b.at-a.at||a.index-b.index).map(x=>x.doc);
  }
  function filterDocumentDates(db,documents,filter={}){
    const ranges=[['createdFrom','createdTo','최초작성일자'],['modifiedFrom','modifiedTo','최종수정일시']];
    for(const [from,to,label]of ranges){
      for(const key of [from,to])if(filter[key]&&!historyDate(filter[key]))throw Error(label+' 검색 일자를 확인하세요.');
      if(filter[from]&&filter[to]&&filter[from]>filter[to])throw Error(label+' 시작일은 종료일보다 늦을 수 없습니다.');
    }
    if(ranges.every(([from,to])=>!filter[from]&&!filter[to]))return documents.slice();
    const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value?Date.parse(value):null;
    const history=new Map();
    for(const r of db.documentHistory?.records||[]){
      const at=timestamp(r.at);if(at===null)continue;
      const key=r.type+'|'+r.documentId,entry=history.get(key)||{created:null,modified:null};
      if(r.action==='신규')entry.created=entry.created===null?at:Math.min(entry.created,at);
      entry.modified=entry.modified===null?at:Math.max(entry.modified,at);history.set(key,entry);
    }
    const day=value=>value===null?'':new Date(value).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
    const matches=(value,from,to)=>!from&&!to||Boolean(value&&(!from||value>=from)&&(!to||value<=to));
    return documents.filter(doc=>{
      const retained=history.get(doc.type+'|'+doc.id),created=timestamp(doc.createdAt)??retained?.created??null,recorded=timestamp(doc.modifiedAt),modified=recorded===null?retained?.modified??null:Math.max(recorded,retained?.modified??recorded);
      return matches(day(created),filter.createdFrom,filter.createdTo)&&matches(day(modified),filter.modifiedFrom,filter.modifiedTo);
    });
  }
  function documentHistory(db,type,filter={}){
    if(!purchasingTypes.includes(type)||!filter||typeof filter!=='object'||Array.isArray(filter))throw Error('이력 조회 조건을 확인하세요.');
    for(const key of ['from','to','documentFrom','documentTo'])if(filter[key]&&!historyDate(filter[key]))throw Error('이력 조회 일자를 확인하세요.');
    if(filter.from&&filter.to&&filter.from>filter.to||filter.documentFrom&&filter.documentTo&&filter.documentFrom>filter.documentTo)throw Error('이력 조회 시작일과 종료일을 확인하세요.');
    if(filter.action&&!historyActions.includes(filter.action))throw Error('지원하는 이력 행위를 선택하세요.');
    if(filter.latest!==undefined&&typeof filter.latest!=='boolean')throw Error('최종이력 조회 조건을 확인하세요.');
    for(const key of ['partner','item','warehouse','project','employee','query'])if(filter[key]!==undefined&&typeof filter[key]!=='string')throw Error('이력 검색어를 확인하세요.');
    if(filter.query?.length>200)throw Error('이력 검색어는 200자 이내로 입력하세요.');
    let records=(db.documentHistory?validateDocumentHistory(db.documentHistory).records:[]).filter(r=>r.type===type);
    // Own policy: choose the latest retained event per voucher before applying criteria.
    if(filter.latest??type!=='request'){const seen=new Set();records=records.filter(r=>{if(seen.has(r.documentId))return false;seen.add(r.documentId);return true;});}
    records=records.filter(r=>(!filter.from||r.workDate>=filter.from)&&(!filter.to||r.workDate<=filter.to)&&(!filter.documentFrom||r.date>=filter.documentFrom)&&(!filter.documentTo||r.date<=filter.documentTo)&&(!filter.action||r.action===filter.action)&&(!filter.partner||r.partnerCodes.includes(filter.partner))&&(!filter.item||r.itemCodes.includes(filter.item))&&(!filter.warehouse||r.warehouseCode===filter.warehouse)&&(!filter.project||r.projectCode===filter.project)&&(!filter.employee||r.employeeCode===filter.employee)&&(!filter.query||[r.documentId,...r.partnerCodes,r.partnerName,r.itemName,r.employeeCode,r.employeeName].some(x=>x.toLocaleLowerCase().includes(filter.query.toLocaleLowerCase()))));
    const columns=type==='request'?['작업일자','일자-No.','행위','거래처명','품목명(요약)','담당자코드','담당자명','작업자','전표상태','이력']:['작업일자','전표번호','행위','거래처코드','거래처명','품목명','담당자코드','담당자명','작업자','전표상태','이력'];
    const rows=records.map(r=>{const row=[r.at,r.date+' / '+r.documentId,r.action,r.partnerCode,r.partnerName,r.itemName+(r.itemCount>1?' 외 '+(r.itemCount-1)+'건':''),r.employeeCode,r.employeeName,'미기록',r.status==='진행'?'진행중':r.status,'상세 미지원'];return type==='request'?row.filter((_,i)=>i!==3):row;});
    return {columns,rows,records,filter:clone(filter),startedAt:db.documentHistory?.startedAt||'',limit:200};
  }
  const supportsPurchasingState=d=>purchasingTypes.includes(d.type)||d.type==='purchasereturn'&&d.settlementMode==='credit';
  function validatePlanQuantity(type,line){if(type==='plan'&&(!['number','string'].includes(typeof line.qty)||typeof line.qty==='string'&&!line.qty.trim()))throw Error('계획 수량을 입력하세요.');}
  function purchasingState(d){return {confirmation:d.confirmation??(d.status==='미확인'?'미확인':'확인'),progress:d.progress??(d.status==='완료'?'완료':'진행')};}
  function purchasingLineState(d,line){return {...purchasingState(d),progress:line.progress??purchasingState(d).progress};}
  function validateLineProgress(d,line){if(line.progress!==undefined&&(d.type!=='plan'||!['진행','완료'].includes(line.progress)))throw Error('품목행 진행상태를 확인하세요.');}
  function validatePurchasingState(d){
    if(d.confirmation===undefined&&d.progress===undefined)return;
    if(!supportsPurchasingState(d)||d.confirmation!==undefined&&!['미확인','확인'].includes(d.confirmation)||d.progress!==undefined&&!['진행','완료'].includes(d.progress))throw Error('확인 여부와 진행상태를 확인하세요.');
    const state=purchasingState(d);
    if(listed(d)&&(d.status==='미확인'&&state.confirmation!=='미확인'||d.status!=='미확인'&&state.confirmation==='미확인'||d.status==='완료'&&state.progress!=='완료'||d.status==='진행'&&state.progress!=='진행'))throw Error('확인 여부·진행상태와 기존 상태가 다릅니다.');
  }
  const active=d=>listed(d)&&(supportsPurchasingState(d)?purchasingState(d).confirmation!=='미확인':d.status!=='미확인');
  function empty(){return {version:2,sequence:0,masters:Object.fromEntries(Object.keys(masterNames).map(k=>[k,[]])),documents:[],payments:[],bom:[],bor:[],prices:[],mappings:[],opening:[],logs:[],settings:{priceOrder:['특별단가','품목단가'],allowNegative:false,customization:F.empty()}};}
  function taxRounding(value){if(value===undefined)return {method:'round',digits:0};if(!value||!['round','floor','ceil'].includes(value.method)||![0,1,2].includes(value.digits))throw Error('부가세 반올림 방법과 소수 자릿수를 확인하세요.');return {method:value.method,digits:value.digits};}
  function supplyRounding(value){if(value===undefined)return {method:'round',digits:2};if(!value||!['round','floor','ceil'].includes(value.method)||![0,1,2].includes(value.digits)||Object.keys(value).some(k=>!['method','digits'].includes(k)))throw Error('공급가액 반올림 방법과 소수 자릿수를 확인하세요.');return {method:value.method,digits:value.digits};}
  function roundSupply(value,policy){const factor=10**policy.digits,scaled=value*factor,nearest=Math.round(scaled),stable=Math.abs(scaled-nearest)<=Number.EPSILON*Math.max(1,Math.abs(scaled))*4?nearest:scaled;return Math[policy.method](stable)/factor;}
  function lineTotals(line,rate=10,rounding,supplyPolicy){
    const qty=num(line.qty,'수량',-1e12),price=num(line.price??0,'단가'),discount=num(line.discount??0,'할인율');
    if(discount>100)throw Error('할인율은 0~100 사이여야 합니다.');
    const rawSupply=qty*price*(1-discount/100),supplyRule=supplyRounding(supplyPolicy),supply=supplyPolicy===undefined||supplyRule.method==='round'&&supplyRule.digits===2?money(rawSupply):roundSupply(rawSupply,supplyRule),policy=taxRounding(rounding),factor=10**policy.digits,tax=Math[policy.method](supply*num(rate,'부가세율')/100*factor)/factor;
    return {...line,qty,price,discount,supply,tax,total:money(supply+tax)};
  }
  const vatModule=()=>{const value=typeof module==='object'&&module.exports?require('./transaction-vat-core.js'):root.TransactionVatCore;if(!value)throw Error('부가세 계산 모듈을 다시 불러오세요.');return value;};
  const hasVatContract=doc=>['vatCalculation','vatAdjustment','vatConfirmation'].some(key=>Object.hasOwn(doc,key));
  function effectiveDocumentLines(doc){
    if(hasVatContract(doc)){
      const rows=vatModule().documentLines(doc);
      return rows.map(line=>['purchasereturn','exchangereceipt'].includes(doc.type)&&line.returnAmounts?{...line,supply:line.returnAmounts.supply,tax:line.returnAmounts.tax,total:line.returnAmounts.total}:line);
    }
    return doc.lines.map(line=>['purchasereturn','exchangereceipt'].includes(doc.type)&&line.returnAmounts?{...line,supply:line.returnAmounts.supply,tax:line.returnAmounts.tax,total:line.returnAmounts.total}:lineTotals(line,doc.vatRate,doc.taxRounding,doc.supplyRounding));
  }
  function effectiveLineTotals(doc,line){
    if(!hasVatContract(doc))return ['purchasereturn','exchangereceipt'].includes(doc.type)&&line.returnAmounts?{...line,supply:line.returnAmounts.supply,tax:line.returnAmounts.tax,total:line.returnAmounts.total}:lineTotals(line,doc.vatRate,doc.taxRounding,doc.supplyRounding);
    const indexes=doc.lines.flatMap((candidate,index)=>(candidate.item===line.item&&(line.lineId?candidate.lineId===line.lineId:line.sourceLineId?candidate.sourceLineId===line.sourceLineId:true))?[index]:[]);
    if(indexes.length!==1)throw Error('부가세 계산 품목행을 구분할 수 없습니다.');
    const original=doc.lines[indexes[0]];for(const key of ['qty','price','discount'])if(Number(original[key]??0)!==Number(line[key]??0))throw Error('부가세 계산 품목행의 금액 기준이 바뀌었습니다.');
    return {...line,...effectiveDocumentLines(doc)[indexes[0]]};
  }
  function totals(doc){return effectiveDocumentLines(doc).reduce((a,x)=>{for(const k of ['qty','supply','tax','total'])a[k]=money(a[k]+x[k]);return a;},{qty:0,supply:0,tax:0,total:0});}
  function master(db,key,code){return db.masters[key]?.find(x=>x.code===code);}
  function requireCode(db,key,code){const x=master(db,key,code);if(!x||x.disabled)throw Error((masterNames[key]||key)+' 코드를 선택하세요.');return x;}
  function movements(db){
    const rows=[];const add=(d,l,warehouse,qty,note)=>{if(qty&&master(db,'items',l.item)?.trackInventory!==false)rows.push({id:d.id,date:d.date,type:d.type,warehouse,item:l.item,qty:quantity(qty),price:l.price||0,partner:d.partner||'',memo:note||d.memo||''});};
    for(const d of db.documents.filter(active))for(const l of d.lines){
      if(['purchase','production','exchangereceipt'].includes(d.type))add(d,l,d.warehouse,l.qty);
      if(['sale','issue','consume','defect','purchasereturn'].includes(d.type))add(d,l,d.warehouse,-l.qty);
      if(d.type==='adjust')add(d,l,d.warehouse,l.qty);
      if(d.type==='transfer'){add(d,l,d.warehouse,-l.qty);add(d,l,d.targetWarehouse,l.qty);}
      if(d.type==='production'&&d.autoConsume){const usage=d.consumption?.filter(x=>x.product===l.item)||db.bom.filter(b=>b.product===l.item).map(b=>({product:l.item,item:b.material,qty:l.qty*b.qty*(1+b.loss/100)}));for(const b of usage)add(d,{item:b.item,price:master(db,'items',b.item)?.buyPrice||0},d.materialWarehouse||d.warehouse,-b.qty,'BOM 자동소모');}
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  }
  function stock(db,item,warehouse,asOf='9999-12-31'){
    if(master(db,'items',item)?.trackInventory===false)return 0;
    const opening=db.opening.filter(x=>x.item===item&&(!warehouse||x.warehouse===warehouse)&&(!x.date||x.date<=asOf)).reduce((s,x)=>s+x.qty,0);
    return quantity(opening+movements(db).filter(x=>x.item===item&&(!warehouse||x.warehouse===warehouse)&&x.date<=asOf).reduce((s,x)=>s+x.qty,0));
  }
  function remaining(db,doc,target){
    const accepted=target?[target]:nextTypes[doc.type]||[];
    // Parallel execution streams (work, issue, receipt) each have their own remainder.
    const exact=new Map(),legacy=new Map();for(const child of db.documents.filter(d=>active(d)&&accepted.includes(d.type)))for(const line of child.lines)for(const a of allocations(child,line))if(a.documentId===doc.id){const map=a.sourceLineId?exact:legacy,key=a.sourceLineId||a.item;map.set(key,quantity((map.get(key)||0)+a.qty));}
    return doc.lines.map(l=>{const specific=l.lineId?exact.get(l.lineId)||0:0,available=quantity(l.qty-specific),used=Math.min(Math.max(0,available),legacy.get(l.item)||0);legacy.set(l.item,quantity((legacy.get(l.item)||0)-used));return {...l,qty:quantity(available-used)};});
  }
  function allocations(doc,line){if(doc.type==='purchaseorder'&&doc.generatedFrom==='purchase-plan')return line.planAllocations||[];return doc.sourceId?[{documentId:doc.sourceId,item:line.item,qty:line.qty,sourceLineId:line.sourceLineId||''}]:[];}
  function ownLineIds(d){return d.lines.every(l=>typeof l.lineId==='string'&&l.lineId.length>0&&l.lineId.length<=200)&&new Set(d.lines.map(l=>l.lineId)).size===d.lines.length;}
  function structuredLines(db,d){return d.type==='purchaseorder'&&d.generatedFrom==='purchase-plan'||ownLineIds(d)||!!(d.sourceId&&db.documents.find(x=>x.id===d.sourceId)?.lines.some(l=>l.lineId));}
  function linkedWarehouse(source,type){return source.type==='transfer'&&type==='sale'?source.targetWarehouse:source.warehouse;}
  function linkedWarehouseMatches(source,type,warehouse){return source.type==='purchaseorder'&&type==='purchase'||linkedWarehouse(source,type)===warehouse;}
  function linkedPartner(source,type,partner,lines){if(source.type==='pricerequest'&&type==='purchaseorder'&&lines?.some(line=>line.priceRequestBasis))return true;return source.type==='transfer'&&type==='sale'||!source.partner||source.partner===partner;}
  const linkedWarehouseTypes=['quote','order','sale','shippingorder','shipment','request','plan','pricerequest','purchaseorder','purchase','purchasereturn','exchangereceipt','transfer'];
  function planLineSupplierMatches(source,line,partner){
    const suppliers=new Set(source.lines.filter(row=>row.item===line.item&&(!line.sourceLineId||row.lineId===line.sourceLineId)).map(row=>row.supplier).filter(Boolean));
    return !suppliers.size||suppliers.size===1&&suppliers.has(partner);
  }
  function validateLinkedSource(db,d){
    const source=db.documents.find(x=>x.id===d.sourceId);
    if(!source||!active(source)||!nextTypes[source.type]?.includes(d.type))throw Error('유효한 연결 전표가 아닙니다.');
    if(!linkedPartner(source,d.type,d.partner,d.lines))throw Error('원본 전표와 거래처가 다릅니다.');
    if(linkedWarehouseTypes.includes(d.type)&&!linkedWarehouseMatches(source,d.type,d.warehouse))throw Error('원본 전표와 창고가 다릅니다.');
    if(source.type==='plan'&&d.type==='purchaseorder'&&d.lines.some(line=>!planLineSupplierMatches(source,line,d.partner)))throw Error('발주계획 품목행의 거래처와 발주서 거래처가 다릅니다.');
    return source;
  }
  function validateLinkedSourceChange(db,previous,next){
    if(!previous)return;
    // Guard newly broken links only. Never rewrite children or reinterpret historical backups.
    for(const child of db.documents.filter(d=>d.sourceId===previous.id&&active(d))){
      if(previous.type==='plan'&&child.type==='purchaseorder')for(const line of child.lines)if(planLineSupplierMatches(previous,line,child.partner)&&!planLineSupplierMatches(next,line,child.partner))throw Error('연결된 후속 발주서와 품목행 거래처가 달라지는 수정은 할 수 없습니다.');
      if(linkedPartner(previous,child.type,child.partner,child.lines)&&!linkedPartner(next,child.type,child.partner,child.lines))throw Error('연결된 후속 전표와 거래처가 달라지는 수정은 할 수 없습니다.');
      if(linkedWarehouseTypes.includes(child.type)&&linkedWarehouseMatches(previous,child.type,child.warehouse)&&!linkedWarehouseMatches(next,child.type,child.warehouse))throw Error('연결된 후속 전표와 창고가 달라지는 수정은 할 수 없습니다.');
    }
  }
  function payableImpact(d){return ['purchase','production'].includes(d.type)?1:d.type==='purchasereturn'&&d.settlementMode==='credit'?-1:0;}
  function setReturnAmounts(db,d){
    if(!['purchasereturn','exchangereceipt'].includes(d.type))return;
    const source=db.documents.find(x=>x.id===d.sourceId);if(!source)throw Error('반품·교환의 원본 전표를 선택하세요.');
    for(const line of d.lines){
      const matches=source.lines.filter(l=>l.item===line.item&&(!line.sourceLineId||l.lineId===line.sourceLineId));if(matches.length!==1)throw Error('반품·교환의 원본 라인을 선택하세요.');
      const original=matches[0],basis=effectiveLineTotals(source,original),others=db.documents.filter(x=>x.id!==d.id&&x.sourceId===source.id&&x.type===d.type&&active(x)).flatMap(x=>x.lines.filter(l=>original.lineId?l.sourceLineId===original.lineId:l.item===original.item).map(l=>effectiveLineTotals(x,l)));
      const available=quantity(original.qty-others.reduce((s,l)=>s+l.qty,0));if(line.qty>available+.000001)throw Error('원본 전표의 잔량을 초과했습니다.');
      const amounts={};for(const key of ['supply','tax']){const left=money(basis[key]-others.reduce((s,l)=>s+l[key],0));amounts[key]=line.qty===available?left:Math.min(left,money(basis[key]*line.qty/original.qty));}
      amounts.total=money(amounts.supply+amounts.tax);line.sourceAmounts={qty:original.qty,supply:basis.supply,tax:basis.tax,total:basis.total};line.returnAmounts=amounts;Object.assign(line,amounts);
    }
  }
  function expectedReturnAmounts(db,source,type){
    const expected=new Map(),children=db.documents.filter(d=>active(d)&&d.sourceId===source.id&&d.type===type).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    for(const original of source.lines){
      const basis=effectiveLineTotals(source,original),rows=children.flatMap(d=>d.lines.filter(l=>original.lineId?l.sourceLineId===original.lineId:l.item===original.item)),totalQty=quantity(rows.reduce((s,l)=>s+l.qty,0));
      if(totalQty>original.qty+.000001)throw Error('원본 전표의 잔량을 초과했습니다.');
      const left={supply:basis.supply,tax:basis.tax};
      rows.forEach((line,index)=>{const amounts={};for(const key of ['supply','tax']){amounts[key]=index===rows.length-1&&totalQty===original.qty?left[key]:Math.min(left[key],money(basis[key]*line.qty/original.qty));left[key]=money(left[key]-amounts[key]);}amounts.total=money(amounts.supply+amounts.tax);expected.set(line,{sourceAmounts:{qty:original.qty,supply:basis.supply,tax:basis.tax,total:basis.total},returnAmounts:amounts});});
    }
    return expected;
  }
  function rebalanceReturnAmounts(db){
    // Purchase returns precede their exchange receipts so both levels use the same deterministic cent allocation.
    for(const type of ['purchasereturn','exchangereceipt'])for(const sourceId of new Set(db.documents.filter(d=>active(d)&&d.type===type).map(d=>d.sourceId))){
      const source=db.documents.find(d=>d.id===sourceId);if(!source)throw Error('반품·교환의 원본 전표를 선택하세요.');
      for(const [line,expected] of expectedReturnAmounts(db,source,type)){
        const keys=type==='purchasereturn'?['qty','supply','tax','total']:['qty'];for(const key of keys)if(line.sourceAmounts?.[key]!==expected.sourceAmounts[key])throw Error('반품·교환 후 원본 수량·금액 기준은 변경할 수 없습니다.');
        line.sourceAmounts=expected.sourceAmounts;line.returnAmounts=expected.returnAmounts;Object.assign(line,expected.returnAmounts);
      }
    }
  }
  function validateOperationLink(db,d){
    const special=['purchasereturn','exchangereceipt'].includes(d.type),source=d.sourceId&&db.documents.find(x=>x.id===d.sourceId);
    if(special&&!source)throw Error('반품·교환입고에는 원본 전표 연결이 필요합니다.');
    if(!source)return;
    if(special||source.type==='request'&&d.type==='transfer'||source.type==='transfer'&&d.type==='sale'){
      if(!nextTypes[source.type]?.includes(d.type)||source.id===d.id)throw Error('유효한 연결 전표가 아닙니다.');
      if(!linkedPartner(source,d.type,d.partner,d.lines))throw Error('원본 전표와 거래처가 다릅니다.');
      if(linkedWarehouse(source,d.type)!==d.warehouse)throw Error('원본 전표의 처리 창고와 다릅니다.');
      if(d.date<source.date)throw Error('처리 일자는 원본 전표 일자보다 빠를 수 없습니다.');
    }
    if(d.type==='purchasereturn'){
      if(source.type!=='purchase'||!['credit','exchange'].includes(d.settlementMode))throw Error('구매 원본과 반품 정산 방식(credit/exchange)을 선택하세요.');
    }
    if(d.type==='exchangereceipt'&&(source.type!=='purchasereturn'||source.settlementMode!=='exchange'||d.settlementMode!=='exchange'))throw Error('교환입고는 교환 방식의 구매반품 잔량에서만 처리하세요.');
    if(special&&active(d)){
      if(d.vatRate!==source.vatRate||JSON.stringify(taxRounding(d.taxRounding))!==JSON.stringify(taxRounding(source.taxRounding))||JSON.stringify(supplyRounding(d.supplyRounding))!==JSON.stringify(supplyRounding(source.supplyRounding)))throw Error('반품·교환의 부가세는 원본 전표 기준을 유지하세요.');
      const expected=expectedReturnAmounts(db,source,d.type);
      for(const line of d.lines){const matches=source.lines.filter(l=>l.item===line.item&&(!line.sourceLineId||l.lineId===line.sourceLineId));if(matches.length!==1||line.price!==matches[0].price||line.discount!==matches[0].discount)throw Error('반품·교환은 원본 라인의 품목·단가·할인율을 유지하세요.');const basis=effectiveLineTotals(source,matches[0]);for(const key of ['qty','supply','tax','total'])if(line.sourceAmounts?.[key]!==basis[key])throw Error('반품·교환 후 원본 수량·금액 기준은 변경할 수 없습니다.');if(line.returnAmounts&&Object.keys(line.returnAmounts).some(k=>!['supply','tax','total'].includes(k)))throw Error('반품·교환 배분금액 구조를 확인하세요.');for(const key of ['supply','tax','total'])if(typeof line.returnAmounts?.[key]!=='number'||!Number.isFinite(line.returnAmounts[key])||line.returnAmounts[key]<0||line.returnAmounts[key]>basis[key]+.001)throw Error('반품·교환 배분금액을 확인하세요.');if(money(line.returnAmounts.supply+line.returnAmounts.tax)!==line.returnAmounts.total)throw Error('반품·교환 배분금액 합계가 다릅니다.');}
      for(const line of d.lines)for(const key of ['supply','tax','total'])if(line.returnAmounts[key]!==expected.get(line)?.returnAmounts[key])throw Error('반품·교환 배분금액이 원본 수량 비례 및 잔여 금액과 다릅니다.');
    }
  }
  function validateProvenance(db,d){
    validateOperationLink(db,d);
    const grouped=d.type==='purchaseorder'&&d.generatedFrom==='purchase-plan';
    if(d.generatedFrom==='purchase-plan'&&!grouped)throw Error('발주계획 생성 표시는 발주서에만 사용할 수 있습니다.');
    if(grouped&&d.sourceId)throw Error('발주계획 배분과 단일 원본 연결을 함께 사용할 수 없습니다.');
    if(!d.sourceId&&d.lines.some(l=>l.sourceLineId))throw Error('원본 라인 연결에는 원본 전표번호가 필요합니다.');
    if(grouped){
      const ids=new Set();for(const line of d.lines){
        if(typeof line.lineId!=='string'||!line.lineId||line.lineId.length>200||ids.has(line.lineId))throw Error('발주서 원본 라인 구분을 확인하세요.');ids.add(line.lineId);
        if(!Array.isArray(line.planAllocations)||!line.planAllocations.length||line.planAllocations.length>500)throw Error('발주계획 원본 배분을 확인하세요.');
        let sum=0;const sources=new Set();for(const a of line.planAllocations){
          if(!a||typeof a.documentId!=='string'||a.item!==line.item||a.sourceLineId!==undefined&&(typeof a.sourceLineId!=='string'||!a.sourceLineId)||sources.has(a.documentId+'|'+(a.sourceLineId||a.item)))throw Error('발주계획 원본 배분이 중복되거나 잘못되었습니다.');sources.add(a.documentId+'|'+(a.sourceLineId||a.item));
          const source=db.documents.find(x=>x.id===a.documentId);if(!source||source.type!=='plan'||!source.lines.some(l=>l.item===a.item&&(!a.sourceLineId||l.lineId===a.sourceLineId))||source.lines.some(l=>l.lineId)&&!a.sourceLineId||source.warehouse!==d.warehouse||source.id===d.id)throw Error('발주계획의 원본 품목과 창고를 확인하세요.');if(typeof a.qty!=='number')throw Error('발주계획 배분 수량을 숫자로 입력하세요.');sum+=num(a.qty,'발주계획 배분 수량',.000001);
        }
        if(Math.abs(quantity(sum)-line.qty)>.000001)throw Error('발주계획 배분 수량과 발주서 수량이 다릅니다.');
      }
    }
    if(d.sourceId){const source=db.documents.find(x=>x.id===d.sourceId);for(const line of d.lines)if(line.sourceLineId){const original=source?.lines.find(l=>l.lineId===line.sourceLineId);if(!original||original.item!==line.item)throw Error('연결된 원본 라인과 품목을 확인하세요.');}}
    if(d.sourceId&&db.documents.find(x=>x.id===d.sourceId)?.lines.some(l=>l.lineId)&&!grouped){const keys=new Set();for(const line of d.lines){if(!line.sourceLineId||keys.has(line.sourceLineId))throw Error('원본 라인별로 수량을 입력하세요.');keys.add(line.sourceLineId);}}
  }
  function validateStock(db){
    if(db.settings.allowNegative)return;
    for(const w of db.masters.warehouses)for(const i of db.masters.items){
      if(i.trackInventory===false)continue;
      let balance=db.opening.filter(x=>x.item===i.code&&x.warehouse===w.code).reduce((s,x)=>s+x.qty,0);
      for(const m of movements(db).filter(x=>x.item===i.code&&x.warehouse===w.code)){balance=quantity(balance+m.qty);if(balance<-.000001)throw Error(`${i.name} / ${w.name}: ${m.date} 재고가 ${balance}입니다. 입고 또는 수량을 확인하세요.`);}
    }
  }
  function validateLinks(db){
    for(const d of db.documents)validateProvenance(db,d);
    for(const source of db.documents){
      const children=db.documents.filter(d=>active(d)&&d.lines.some(l=>allocations(d,l).some(a=>a.documentId===source.id)));if(children.length&&!active(source))throw Error('연결된 후속 전표를 먼저 취소하세요.');
      for(const type of new Set(children.map(d=>d.type)))for(const item of new Set(children.filter(d=>d.type===type).flatMap(d=>d.lines.flatMap(l=>allocations(d,l).filter(a=>a.documentId===source.id).map(a=>a.item))))){
        const related=children.filter(d=>d.type===type).flatMap(d=>d.lines.flatMap(l=>allocations(d,l))).filter(a=>a.documentId===source.id&&a.item===item),sum=related.reduce((s,a)=>s+a.qty,0),limit=source.lines.filter(l=>l.item===item).reduce((s,l)=>s+l.qty,0);
        // Material issues can contain BOM components rather than finished goods.
        if(type!=='issue'&&(sum>limit+.000001||source.type==='plan'&&limit===0&&sum>0))throw Error('원본 전표의 잔량을 초과했습니다.');
        for(const line of source.lines.filter(l=>l.lineId&&l.item===item)){const used=related.filter(a=>a.sourceLineId===line.lineId).reduce((s,a)=>s+a.qty,0);if(used>line.qty+.000001||source.type==='plan'&&line.qty===0&&used>0)throw Error('원본 라인의 잔량을 초과했습니다.');}
        if(['purchasereturn','exchangereceipt'].includes(type))for(const original of source.lines.filter(l=>l.item===item)){const lines=children.filter(d=>d.type===type).flatMap(d=>d.lines.filter(l=>original.lineId?l.sourceLineId===original.lineId:l.item===original.item)),basis=effectiveLineTotals(source,original);for(const key of ['supply','tax','total'])if(money(lines.reduce((s,l)=>s+(l.returnAmounts?.[key]||0),0))>basis[key]+.001)throw Error('원본 전표의 반품·교환 금액을 초과했습니다.');}
      }
    }
  }
  function log(db,text){db.logs.unshift({id:'L'+(++db.sequence),date:today(),text});db.logs=db.logs.slice(0,1000);}
  function applyForm(db,key,context,record,conditionValues=record,errorContext=''){
    const store=db.settings.customization,meta=F.effective(store,key,context,[],conditionValues),form=F.screen(store,key).forms.find(f=>f.id===meta.id);if(!form)return record;
    let values;try{values=F.compute(form.fields,{...record,...record.custom});F.check(form.fields,values);}catch(error){if(!errorContext)throw error;throw Error(errorContext+' · '+error.message);}record.custom={...record.custom,...Object.fromEntries(form.fields.filter(f=>f.custom).map(f=>[f.id,values[f.id]??'']))};return record;
  }
  function validateMasterGroups(key,record){
    if(!['partners','projects'].includes(key))return;
    for(const field of ['group1','group2'])if(Object.hasOwn(record,field)&&(typeof record[field]!=='string'||record[field].length>200))throw Error(masterNames[key]+'그룹은 200자 이하 문자열로 입력하세요.');
  }
  function purchaseSupplier(db,line,document={}){return line?.supplier||(['request','plan','purchaseorder','purchase'].includes(document?.type)?document.partner:'')||master(db,'items',line?.item)?.supplier||'';}
  function saveMaster(db,{key,record,originalCode}){
    if(!masterNames[key])throw Error('등록 구분을 확인하세요.');
    let x={...record,code:String(record.code||'').trim(),name:String(record.name||'').trim()};if(!x.code||!x.name)throw Error('코드와 명칭은 필수입니다.');
    if(x.code.length>60||x.name.length>200)throw Error('코드/명칭 길이를 확인하세요.');
    validateMasterGroups(key,x);
    const previous=originalCode||x.code,index=db.masters[key].findIndex(i=>i.code===previous);
    if(x.code!==previous)throw Error('코드는 각종코드변경에서 변경하세요.');
    if(!originalCode&&index>=0)throw Error('이미 존재하는 코드입니다.');
    if(originalCode&&index<0)throw Error('수정할 등록 자료가 없습니다.');
    if(key==='items'){
      if(I)x=I.validate(x,db);else {x.buyPrice=num(x.buyPrice||0,'입고단가');x.sellPrice=num(x.sellPrice||0,'출고단가');x.safety=num(x.safety||0,'안전재고');}
      const old=db.masters.items[index];
      if(!old&&!x.supplier||old?.supplier&&!x.supplier)throw Error('품목 구매처는 필수입니다. 등록된 거래처를 선택하세요.');
      if(x.supplier&&x.supplier!==old?.supplier)requireCode(db,'partners',x.supplier);
      if(old&&(old.trackInventory!==false)!==(x.trackInventory!==false)&&(db.opening.some(o=>o.item===x.code)||db.documents.some(d=>d.lines.some(l=>l.item===x.code))))throw Error('재고 이력이 있는 품목은 재고수량관리 여부를 변경할 수 없습니다.');
      if(index<0&&!x.createdAt)x.createdAt=new Date().toISOString();
      if(old?.createdAt)x.createdAt=old.createdAt;
      if(x.relatedItems!==undefined&&(!Array.isArray(x.relatedItems)||x.relatedItems.length>200||x.relatedItems.some(code=>typeof code!=='string'||code===x.code||!master(db,'items',code))))throw Error('관계 품목은 등록된 다른 품목을 선택하세요.');
      if(x.relatedItems)x.relatedItems=[...new Set(x.relatedItems)];
    }
    if(key==='currencies'){
      const old=db.masters.currencies[index],same=key=>old&&Object.hasOwn(old,key)===Object.hasOwn(x,key)&&JSON.stringify(old[key])===JSON.stringify(x[key]);
      // Preserve legacy metadata when unchanged; never invent a fixed rate for an empty value.
      if(!same('rate')&&!(old&&!Object.hasOwn(x,'rate')&&!Object.hasOwn(old,'rate'))){
        if(x.rate!==undefined&&x.rate!==null&&x.rate!==''&&!['number','string'].includes(typeof x.rate))throw Error('환율 값을 확인하세요.');
        x.rate=x.rate===undefined||x.rate===null||x.rate===''?null:num(x.rate,'환율',.000001);
      }
      if(Object.hasOwn(x,'fractionDigits')&&!same('fractionDigits')){
        const value=x.fractionDigits;
        if(!['number','string'].includes(typeof value)||!/^([0-4])$/.test(String(value)))throw Error('금액 소수점은 사용안함 또는 1~4를 선택하세요.');
        x.fractionDigits=Number(value);
      }
    }
    applyForm(db,'master:'+key,'input',x);if(key==='items'&&I)x=I.compact(x,db);
    if(index<0)db.masters[key].push(x);else db.masters[key][index]=x;log(db,masterNames[key]+' 등록/수정: '+x.code);return x;
  }
  function validatePlanOrderRows(db,doc,source){
    if(source?.type!=='plan'||doc.type!=='purchaseorder')return;
    const previous=db.documents.find(row=>row.id===doc.id&&row.sourceId===source.id);
    const allocationKey=line=>line.sourceLineId?'line:'+line.sourceLineId:'item:'+line.item;
    const quantities=lines=>{const result=new Map();for(const line of lines){const qty=Number(line.qty);if(!Number.isFinite(qty)||qty<0)throw Error('연결 수량을 확인하세요.');const key=allocationKey(line);result.set(key,quantity((result.get(key)||0)+qty));}return result;};
    const oldQuantities=quantities(previous?.lines||[]),newQuantities=quantities(doc.lines);
    for(const line of doc.lines){
      const originals=source.lines.filter(row=>row.item===line.item&&(!line.sourceLineId||row.lineId===line.sourceLineId));
      if(!originals.length)throw Error('원본 발주계획 품목행을 확인하세요.');
      if(!planLineSupplierMatches(source,line,doc.partner))throw Error('발주계획 품목행의 거래처와 발주서 거래처가 다릅니다.');
      if(originals.some(row=>purchasingLineState(source,row).progress==='완료')&&(newQuantities.get(allocationKey(line))||0)>(oldQuantities.get(allocationKey(line))||0))throw Error('완료된 발주계획 품목행의 발주 수량을 늘릴 수 없습니다.');
    }
  }
  function validateGroupedPlanProgress(db,doc){
    if(doc.type!=='purchaseorder'||doc.generatedFrom!=='purchase-plan')return;
    validateProvenance(db,doc);
    const previous=db.documents.find(row=>row.id===doc.id&&row.generatedFrom==='purchase-plan');
    const quantities=record=>{const result=new Map();for(const line of record?.lines||[])for(const ref of line.planAllocations){
      const key=JSON.stringify([ref.documentId,ref.item,ref.sourceLineId||'']),old=result.get(key);
      result.set(key,{ref,qty:quantity((old?.qty||0)+ref.qty)});
    }return result;};
    const oldQuantities=quantities(previous),newQuantities=quantities(doc);
    // Compare the complete voucher allocation, including splits across several order rows.
    for(const [key,{ref,qty}]of newQuantities){
      const source=db.documents.find(row=>row.id===ref.documentId),originals=source.lines.filter(row=>row.item===ref.item&&(!ref.sourceLineId||row.lineId===ref.sourceLineId));
      if(originals.some(row=>purchasingLineState(source,row).progress==='완료')&&qty>(oldQuantities.get(key)?.qty||0))throw Error('완료된 발주계획 품목행의 발주 수량을 늘릴 수 없습니다.');
    }
  }
  function validateReceiptWarehouseChange(db,previous,next){
    if(!previous||previous.warehouse===next.warehouse||!['purchase','exchangereceipt'].includes(previous.type))return;
    const room=db.settings.purchaseRoom;
    if(['inspections','racks'].some(key=>(room?.[key]||[]).some(row=>row.documentId===previous.id)))throw Error('검수 또는 RACK 적재 기록이 있는 입고전표의 창고는 변경할 수 없습니다.');
  }
  function saveDoc(db,input){
    const d=clone(input);if(!types[d.type])throw Error('전표 종류가 올바르지 않습니다.');
    const previous=d.id?db.documents.find(x=>x.id===d.id):null;
    if(purchasingTypes.includes(d.type)&&d.transactionType!==previous?.transactionType){if(d.transactionType!==undefined&&(typeof d.transactionType!=='string'||d.transactionType.length>200))throw Error('거래유형 코드를 확인하세요.');}
    if(purchasingTypes.includes(d.type)&&d.transactionType==='22'&&(!previous||previous.transactionType!=='22'||Number(d.vatRate??10)!==Number(previous.vatRate??10)))d.vatRate=0;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date)throw Error('일자를 확인하세요.');
    requireCode(db,'warehouses',d.warehouse);if(d.partner)requireCode(db,'partners',d.partner);
    for(const [field,key] of [['employee','employees'],['project','projects'],['currency','currencies']])if(d[field])requireCode(db,key,d[field]);
    if(d.type==='work')d.minutes=num(d.minutes||0,'작업시간');
    if(['quote','order','sale','purchaseorder','purchase','purchasereturn','exchangereceipt','shoporder'].includes(d.type)&&!d.partner)throw Error('거래처는 필수입니다.');
    if(d.type==='transfer'){requireCode(db,'warehouses',d.targetWarehouse);if(d.warehouse===d.targetWarehouse)throw Error('보내는 창고와 받는 창고가 같습니다.');}
    if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>500)throw Error('품목을 1~500행 입력하세요.');
    d.vatRate=num(d.vatRate??10,'부가세율');if(d.vatRate>100)throw Error('부가세율을 확인하세요.');
    if(d.taxRounding!==undefined)d.taxRounding=taxRounding(d.taxRounding);if(d.supplyRounding!==undefined)d.supplyRounding=supplyRounding(d.supplyRounding);
    if(d.lines.some(l=>l.lineId)&&!ownLineIds(d))throw Error('전표 라인 구분을 중복 없이 입력하세요.');
    const seen=new Set(),allowStructured=structuredLines(db,d);d.lines=d.lines.map((l,lineIndex)=>{requireCode(db,'items',l.item);if(purchasingTypes.includes(d.type)&&l.managementItem!==undefined){if(typeof l.managementItem!=='string')throw Error('관리항목 코드를 확인하세요.');if(l.managementItem){const old=previous?.lines.find((x,i)=>l.lineId?x.lineId===l.lineId:i===lineIndex);if(old?.managementItem===l.managementItem){if(!master(db,'controls',l.managementItem))throw Error('관리항목 코드를 확인하세요.');}else requireCode(db,'controls',l.managementItem);}}if(seen.has(l.item)&&!allowStructured)throw Error('같은 품목은 한 행으로 합쳐 입력하세요.');seen.add(l.item);validateLineProgress(d,l);if(['request','plan'].includes(d.type)&&l.supplier!==undefined&&typeof l.supplier!=='string')throw Error('품목행 거래처를 확인하세요.');if(['request','plan'].includes(d.type)&&l.supplier)requireCode(db,'partners',l.supplier);const value=['request','plan'].includes(d.type)&&!previous&&!l.supplier?{...l,supplier:purchaseSupplier(db,l,d)}:l;if(['request','plan'].includes(d.type)&&value.supplier)requireCode(db,'partners',value.supplier);validatePlanQuantity(d.type,value);const x=lineTotals(value,d.vatRate,d.taxRounding,d.supplyRounding);if(d.type!=='adjust'&&(x.qty<0||(!['count','plan'].includes(d.type)&&x.qty===0)))throw Error('수량은 0보다 커야 합니다.');return x;});
    if(hasVatContract(d)||previous&&hasVatContract(previous)){const adjusted=vatModule().forSave(d,previous);delete d.vatConfirmation;if(!Object.hasOwn(adjusted,'vatAdjustment'))delete d.vatAdjustment;Object.assign(d,adjusted);}
    if(d.autoConsume&&d.type==='production'){for(const l of d.lines)if(!db.bom.some(b=>b.product===l.item))throw Error('BOM이 없는 품목입니다. BOM을 등록하거나 자동소모를 해제하세요.');requireCode(db,'warehouses',d.materialWarehouse||d.warehouse);}
    d.consumption=d.type==='production'&&d.autoConsume?d.lines.flatMap(l=>db.bom.filter(b=>b.product===l.item).map(b=>({product:l.item,item:b.material,qty:quantity(l.qty*b.qty*(1+b.loss/100))}))):[];
    setReturnAmounts(db,d);
    applyForm(db,'doc:'+d.type,'input',d);d.lines=d.lines.map((l,index)=>applyForm(db,'doc:'+d.type,'lines',l,d,'입력된 품목 중 '+(index+1)+'번째 ['+l.item+']'));
    const index=d.id?db.documents.findIndex(x=>x.id===d.id):-1;
    if(d.id&&index<0)throw Error('수정할 전표가 없습니다.');
    if(index>=0&&db.documents[index].type!==d.type)throw Error('전표 종류는 변경할 수 없습니다.');
    if(index>=0&&db.documents[index].accounted)throw Error('회계반영을 취소한 후 수정하세요.');
    // Modification time belongs to successful commands, never to an incoming form payload. Creation time is immutable.
    if(purchasingTypes.includes(d.type)){for(const key of ['createdAt','modifiedAt']){if(index>=0&&db.documents[index][key]!==undefined)d[key]=db.documents[index][key];else delete d[key];}}
    if(index>=0){const old=db.documents[index];if(old.generatedFrom==='purchase-plan'&&d.generatedFrom!==old.generatedFrom)throw Error('발주계획 생성 연결은 제거할 수 없습니다.');if(old.sourceId&&(db.documents.find(x=>x.id===old.sourceId)?.generatedFrom==='purchase-plan'||['purchasereturn','exchangereceipt'].includes(old.type)||old.type==='transfer'||old.type==='sale'&&db.documents.find(x=>x.id===old.sourceId)?.type==='transfer')&&d.sourceId!==old.sourceId)throw Error('처리한 원본 전표 연결은 제거하거나 바꿀 수 없습니다.');}
    if(d.sourceId){
      const source=validateLinkedSource(db,d);
      validatePlanOrderRows(db,d,source);
    }
    if(d.type==='purchaseorder'&&(db.settings.priceRequests||d.lines.some(line=>line.priceRequestBasis)||previous?.lines.some(line=>line.priceRequestBasis)))priceRequestModule().validateOrder(db,d,previous,api);
    validateGroupedPlanProgress(db,d);
    d.status=statusValue(d.status);validatePurchasingState(d);if(!documentStatuses.includes(d.status))throw Error('처리 상태를 확인하세요.');
    d.id=d.id||`${d.type.toUpperCase()}-${d.date.replaceAll('-','')}-${String(++db.sequence).padStart(5,'0')}`;d.accounted=Boolean(d.accounted);
    if(d.accounted&&!active(d))throw Error('미확인·취소 전표는 회계반영할 수 없습니다.');
    validateReceiptWarehouseChange(db,previous,d);
    validateLinkedSourceChange(db,previous,d);
    if(index<0)db.documents.push(d);else db.documents[index]=d;
    rebalanceReturnAmounts(db);validateLinks(db);validateStock(db);log(db,types[d.type]+' 저장: '+d.id);return d;
  }
  function convert(db,{id,type,quantities,partner,warehouse,targetWarehouse,date,settlementMode}){
    const src=db.documents.find(x=>x.id===id);if(!src||!active(src)||!nextTypes[src.type]?.includes(type))throw Error('변환할 수 없는 전표입니다.');
    let lines=remaining(db,src,type).filter(l=>l.qty>0).map(l=>{const x={...l};if(l.lineId)x.sourceLineId=l.lineId;else delete x.sourceLineId;if(type!=='plan')delete x.progress;return x;});
    if(quantities)lines=lines.map(l=>({...l,qty:num(quantities[l.lineId||l.item]??l.qty,'처리수량')})).filter(l=>l.qty>0);
    if(src.type==='pricerequest'&&type==='purchaseorder'){lines=priceRequestModule().orderLines(db,src,lines,api);if(lines.some(line=>line.priceRequestBasis))partner=priceRequestModule().orderPartner(lines,partner);}
    if(type==='issue'){
      const components=new Map();for(const l of lines)for(const b of db.bom.filter(b=>b.product===l.item))components.set(b.material,(components.get(b.material)||0)+l.qty*b.qty*(1+b.loss/100));
      lines=[...components].map(([item,qty])=>({item,qty,price:master(db,'items',item)?.buyPrice||0}));
      if(db.documents.some(d=>active(d)&&d.sourceId===src.id&&d.type==='issue'))throw Error('이 작업지시서의 생산불출이 이미 있습니다.');
    }
    if(src.type==='count'&&type==='adjust'){
      if(db.documents.some(d=>active(d)&&d.sourceId===src.id&&d.type==='adjust'))throw Error('이미 조정한 실사 전표입니다.');
      lines=src.lines.map(l=>({...l,qty:quantity(l.qty-stock(db,l.item,src.warehouse,src.date))})).filter(l=>l.qty!==0);
    }
    if(!lines.length)throw Error('처리할 잔량이 없습니다.');
    if(purchasingTypes.includes(type)&&src.transactionType==='22'&&Number(src.vatRate??10)!==0)throw Error('원본 거래유형과 부가세율을 함께 변환할 수 없습니다. 원본 전표의 머리 항목을 확인하세요.');
    const header={...src};delete header.generatedFrom;delete header.planGeneration;delete header.confirmation;delete header.progress;delete header.vatCalculation;delete header.vatAdjustment;delete header.vatConfirmation;
    if(src.type==='transfer'&&type==='sale'){header.warehouse=src.targetWarehouse;header.partner=partner||'';delete header.targetWarehouse;}
    if(type==='transfer')header.targetWarehouse=targetWarehouse||src.targetWarehouse||'';
    if(warehouse!==undefined){if(!linkedWarehouseMatches(src,type,warehouse))throw Error('원본 전표의 처리 창고와 다릅니다.');header.warehouse=warehouse;}
    if(partner!==undefined)header.partner=partner;
    if(['request','plan'].includes(src.type)&&type==='purchaseorder'&&!header.partner){const suppliers=lines.map(l=>purchaseSupplier(db,l,src));if(suppliers.every(Boolean)&&new Set(suppliers).size===1)header.partner=suppliers[0];}
    if(type==='purchasereturn')header.settlementMode=settlementMode;
    else if(type==='exchangereceipt')header.settlementMode='exchange';
    else delete header.settlementMode;
    return saveDoc(db,{...header,id:undefined,type,date:date||today(),lines,sourceId:src.id,status:'진행',accounted:false,autoConsume:type==='production'?!db.documents.some(d=>active(d)&&d.sourceId===src.id&&d.type==='issue'):false});
  }
  function transition(db,{ids,status,accounted,confirmation,progress}){
    if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length)throw Error('변경할 전표를 중복 없이 1~500개 선택하세요.');
    const inactiveBefore=new Set(db.documents.filter(d=>ids.includes(d.id)&&!active(d)).map(d=>d.id));
    if(status!==undefined&&status!=='')status=statusValue(status);
    if(confirmation!==undefined&&!['미확인','확인'].includes(confirmation)||progress!==undefined&&!['진행','완료'].includes(progress)||(status!==undefined||typeof accounted==='boolean')&&(confirmation!==undefined||progress!==undefined))throw Error('확인 여부와 진행상태를 확인하세요.');
    if(!documentStatuses.includes(status)&&typeof accounted!=='boolean'&&confirmation===undefined&&progress===undefined)throw Error('처리 상태를 확인하세요.');
    for(const id of ids){const d=db.documents.find(x=>x.id===id);if(!d)throw Error('전표를 찾을 수 없습니다.');const before=statusLabel(d),beforeState=purchasingState(d);if(typeof accounted==='boolean'){if(!['sale','purchase','production'].includes(d.type)||!active(d))throw Error('회계반영할 수 없는 전표입니다.');d.accounted=accounted;}else {if(d.accounted)throw Error('회계반영을 취소한 후 상태를 변경하세요.');if(confirmation!==undefined||progress!==undefined){
        if(!supportsPurchasingState(d)||!listed(d))throw Error('취소·보류 전표는 먼저 복원하세요.');
        const state=purchasingState(d);d.confirmation=confirmation??state.confirmation;d.progress=progress??state.progress;d.status=d.confirmation==='미확인'?'미확인':d.progress;
      }else {if(supportsPurchasingState(d)&&(d.confirmation!==undefined||d.progress!==undefined)){const state=purchasingState(d);d.confirmation=['미확인'].includes(status)?'미확인':['확인','진행','완료'].includes(status)?'확인':state.confirmation;d.progress=['진행','완료'].includes(status)?status:state.progress;}d.status=status;}validatePurchasingState(d);}log(db,typeof accounted==='boolean'?'회계반영 변경: '+id:'전표 상태 변경: '+id+' / '+before+' → '+statusLabel(d)+((confirmation!==undefined||progress!==undefined)?' / 확인: '+beforeState.confirmation+' → '+purchasingState(d).confirmation+' / 진행: '+beforeState.progress+' → '+purchasingState(d).progress:''));}
    // Validate after the whole batch so restoring parent and child is order independent.
    for(const d of db.documents)if(inactiveBefore.has(d.id)&&active(d)&&d.sourceId)validateLinkedSource(db,d);
    rebalanceReturnAmounts(db);validateLinks(db);validateStock(db);for(const partner of db.masters.partners)for(const side of ['receivable','payable'])if(outstanding(db,side,partner.code)<-.001)throw Error('수금/지급 기록을 먼저 취소하세요.');return ids;
  }
  function planLineProgress(db,{selections,progress}){
    if(!['진행','완료'].includes(progress)||!Array.isArray(selections)||!selections.length||selections.length>500)throw Error('변경할 발주계획 품목행과 진행상태를 확인하세요.');
    const seen=new Set();for(const row of selections){const d=db.documents.find(d=>d.id===row?.documentId);if(!d||d.type!=='plan'||!active(d)||d.accounted)throw Error('진행상태를 변경할 수 있는 발주계획을 선택하세요.');const matches=d.lines.filter(l=>row.lineId?l.lineId===row.lineId&&(!row.item||l.item===row.item):l.item===row.item);if(matches.length!==1||!row.lineId&&matches[0].lineId)throw Error('발주계획 원본 품목행을 선택하세요.');const l=matches[0],key=d.id+'|'+(l.lineId||l.item);if(seen.has(key))throw Error('같은 발주계획 품목행을 중복 선택했습니다.');seen.add(key);const before=purchasingLineState(d,l).progress;l.progress=progress;log(db,'발주계획 품목행 진행 변경: '+key+' / '+before+' → '+progress);}
    return selections;
  }
  function outstanding(db,side,partner){
    const amount=db.documents.filter(d=>active(d)&&d.partner&&(!partner||d.partner===partner)).reduce((s,d)=>s+totals(d).total*(side==='receivable'?(d.type==='sale'?1:0):payableImpact(d)),0);
    return money(amount-db.payments.filter(p=>p.side===side&&(!partner||p.partner===partner)).reduce((s,p)=>s+p.amount,0));
  }
  function payment(db,p){
    requireCode(db,'partners',p.partner);if(!['receivable','payable'].includes(p.side))throw Error('수금/지급 구분을 확인하세요.');
    if(p.warehouse)requireCode(db,'warehouses',p.warehouse);
    const amount=num(p.amount,'금액',.01);if(amount>outstanding(db,p.side,p.partner)+.001)throw Error('잔액을 초과한 수금/지급/할인입니다.');
    const date=p.date||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('수금/지급 일자를 확인하세요.');
    const x={...p,amount,id:'PAY-'+(++db.sequence),date,kind:p.kind==='discount'?'discount':'cash'};db.payments.push(x);log(db,'수금/지급 기록: '+x.id);return x;
  }
  function setBom(db,p){
    requireCode(db,'items',p.product);const components=p.lines.map(l=>{requireCode(db,'items',l.material);if(l.material===p.product)throw Error('자기 자신을 BOM 원료로 등록할 수 없습니다.');return {product:p.product,material:l.material,qty:num(l.qty,'소요량',.000001),loss:num(l.loss||0,'로스율')};});
    if(!components.length)throw Error('원료를 입력하세요.');if(new Set(components.map(x=>x.material)).size!==components.length)throw Error('중복 원료를 합쳐 주세요.');
    db.bom=[...db.bom.filter(b=>b.product!==p.product),...components];
    const visit=(item,path)=>{if(path.includes(item))throw Error('BOM 순환 참조가 있습니다.');for(const b of db.bom.filter(b=>b.product===item))visit(b.material,[...path,item]);};visit(p.product,[]);validateStock(db);log(db,'BOM 저장: '+p.product);return components;
  }
  function rename(db,{key,from,to}){
    if(['items','partners'].includes(key)&&db.documents.some(doc=>doc.lines.some(line=>line.priceRequestBasis&&(key==='items'?line.priceRequestBasis.item===from:line.priceRequestBasis.vendorCode===from))))throw Error('발주 확정단가 근거에 사용된 코드는 변경할 수 없습니다. 기존 발주 근거를 보존하세요.');
    const adjusted=db.documents.filter(d=>d.vatCalculation==='transaction');if(key==='currencies'&&adjusted.some(d=>d.currency===from))throw Error('거래별 계산 전표가 사용하는 원화 코드는 변경할 수 없습니다. 원화 코드 별칭 규칙 확인이 필요합니다.');
    const originals=key==='items'?new Map(adjusted.map(d=>{vatModule().stored(d);return [d.id,clone(d)];})):null;
    const x=requireCode(db,key,from);to=String(to||'').trim();if(!to||master(db,key,to))throw Error('변경할 코드를 확인하세요.');x.code=to;
    const field={items:'item',partners:'partner',warehouses:'warehouse',employees:'employee',projects:'project',departments:'department',currencies:'currency'}[key];
    for(const d of db.documents){if(field&&d[field]===from)d[field]=to;if(key==='warehouses')for(const f of ['targetWarehouse','materialWarehouse'])if(d[f]===from)d[f]=to;for(const l of [...d.lines,...(d.consumption||[])]){if(key==='partners'&&l.supplier===from)l.supplier=to;if(key==='controls'&&l.managementItem===from)l.managementItem=to;if(key==='items'){if(l.item===from)l.item=to;if(l.product===from)l.product=to;for(const ref of l.planAllocations||[])if(ref.item===from)ref.item=to;}}}
    if(originals)for(const d of adjusted)d.vatAdjustment=vatModule().renamedItems(originals.get(d.id),d);
    for(const r of [...db.opening,...db.payments,...db.prices,...db.mappings])if(field&&r[field]===from)r[field]=to;
    for(const b of db.bom)for(const f of key==='items'?['product','material']:[])if(b[f]===from)b[f]=to;
    for(const b of db.bor){if(key==='items'&&b.product===from)b.product=to;if(key==='processes'&&b.process===from)b.process=to;if(key==='resources'&&b.resource===from)b.resource=to;}
    if(key==='shops'){for(const m of db.mappings)if(m.shop===from)m.shop=to;for(const d of db.documents)if(d.shop===from)d.shop=to;}
    if(key==='pricegroups'){for(const p of db.masters.partners)if(p.priceGroup===from)p.priceGroup=to;for(const p of db.prices)if(p.group===from)p.group=to;}
    if(key==='departments')for(const e of db.masters.employees)if(e.department===from)e.department=to;
    if(key==='partners')for(const i of db.masters.items)if(i.supplier===from)i.supplier=to;
    for(const item of db.masters.items){
      if(key==='partners'&&item.relatedPartner===from)item.relatedPartner=to;
      if(key==='processes'&&item.productionProcess===from)item.productionProcess=to;
      if(key==='warehouses')for(const row of item.warehouseSafety||[])if(row.warehouse===from)row.warehouse=to;
      if(key==='items'&&item.relatedItems)item.relatedItems=item.relatedItems.map(code=>code===from?to:code);
    }
    const itemConfig=db.settings.itemRegistration;
    if(itemConfig){
      if(key==='partners'&&itemConfig.features?.supplier===from)itemConfig.features.supplier=to;
      for(const field of itemConfig.fields||[]){
        if((key==='partners'&&['supplier','relatedPartner'].includes(field.id)||key==='processes'&&field.id==='productionProcess')&&field.defaultValue===from)field.defaultValue=to;
        if(key==='warehouses'&&field.id==='warehouseSafety')for(const row of field.defaultValue||[])if(row.warehouse===from)row.warehouse=to;
      }
    }
    log(db,'코드변경 '+from+' → '+to);return x;
  }
  function priceFor(db,item,partner,buy=false,vatRate){
    const group=master(db,'partners',partner)?.priceGroup;
    const special=db.prices.find(p=>p.item===item&&p.partner===partner&&Boolean(p.buy)===buy)||db.prices.find(p=>p.item===item&&p.group&&p.group===group&&Boolean(p.buy)===buy);
    const record=master(db,'items',item);
    return db.settings.priceOrder[0]==='특별단가'&&special?special.price:I&&record?I.netPrice(record,buy,vatRate):Number(record?.[buy?'buyPrice':'sellPrice']||0);
  }
  function requirements(db,product,qty,warehouse,{bomDepth='all'}={}){
    if(!['all','first'].includes(bomDepth))throw Error('BOM구분을 확인하세요.');
    const result=new Map();const walk=(code,amount,path)=>{if(path.includes(code))throw Error('BOM 순환 참조');const bs=db.bom.filter(b=>b.product===code);if(!bs.length||bomDepth==='first'&&path.length===1){result.set(code,(result.get(code)||0)+amount);return;}for(const b of bs)walk(b.material,amount*b.qty*(1+b.loss/100),[...path,code]);};walk(product,num(qty,'생산수량',.000001),[]);
    return [...result].map(([item,required])=>({item,required:quantity(required),stock:stock(db,item,warehouse),shortage:quantity(Math.max(0,required-stock(db,item,warehouse)))}));
  }
  function report(db,config,filter={}){
    const n=config.name,from=filter.from||'0000-01-01',to=filter.to||'9999-12-31',wh=filter.warehouse||'',partner=filter.partner||'',query=(filter.query||'').toLowerCase();
    const match=d=>d.date>=from&&d.date<=to&&(!partner||d.partner===partner)&&(!wh||d.warehouse===wh||d.targetWarehouse===wh);
    let columns,rows;
    if(n==='BOM환산재고현황'){
      columns=['생산품코드','생산품명','창고','완제품재고','원료기준 생산가능수량'];rows=[];
      for(const product of [...new Set(db.bom.map(b=>b.product))])for(const w of db.masters.warehouses.filter(w=>!wh||w.code===wh)){
        const req=requirements(db,product,1,w.code);rows.push([product,master(db,'items',product)?.name||product,w.name,stock(db,product,w.code,to),Math.floor(Math.min(...req.map(r=>stock(db,r.item,w.code,to)/r.required)))]);
      }
    }else if(n==='관계별재고현황'||n==='다규격별재고현황'){
      columns=[n==='관계별재고현황'?'품목그룹':'규격','품목수','현재고','재고금액'];const grouped=new Map();for(const i of db.masters.items){const key=(n==='관계별재고현황'?i.group:i.spec)||'미분류';const r=grouped.get(key)||[key,0,0,0],q=stock(db,i.code,wh,to);r[1]++;r[2]=quantity(r[2]+q);r[3]=money(r[3]+q*i.buyPrice);grouped.set(key,r);}rows=[...grouped.values()];
    }else if(n==='재고잔량분석표'){
      columns=['품목코드','품목명','현재고','미판매수량','미구매수량','예상잔량','안전재고','부족수량'];rows=db.masters.items.map(i=>{
        const pending=(type,target)=>db.documents.filter(d=>active(d)&&d.type===type&&(!wh||d.warehouse===wh)&&d.date<=to).flatMap(d=>remaining(db,d,target)).filter(l=>l.item===i.code).reduce((s,l)=>s+Math.max(0,l.qty),0);const q=stock(db,i.code,wh,to),sale=pending('order','sale'),purchase=pending('purchaseorder','purchase'),expected=quantity(q-sale+purchase);return [i.code,i.name,q,quantity(sale),quantity(purchase),expected,i.safety||0,quantity(Math.max(0,(i.safety||0)-expected))];});
    }else if(n==='일별재고현황'){
      columns=['일자','품목코드','품목명','창고','입고','출고','일말재고'];rows=[];const dates=[...new Set(movements(db).filter(m=>m.date>=from&&m.date<=to).map(m=>m.date))];if(!dates.length)dates.push(to);for(const date of dates)for(const i of db.masters.items)for(const w of db.masters.warehouses.filter(w=>!wh||w.code===wh)){const ms=movements(db).filter(m=>m.date===date&&m.item===i.code&&m.warehouse===w.code);rows.push([date,i.code,i.name,w.name,quantity(ms.reduce((s,m)=>s+Math.max(0,m.qty),0)),quantity(ms.reduce((s,m)=>s+Math.max(0,-m.qty),0)),stock(db,i.code,w.code,date)]);}
    }else if(/월별채권|월별채무/.test(n)){
      const side=/채권/.test(n)?'receivable':'payable',impact=d=>side==='receivable'?(d.type==='sale'?1:0):payableImpact(d);columns=['월','발생금액','수금/지급/할인','순증감'];const grouped=new Map();for(const d of db.documents.filter(d=>active(d)&&impact(d)&&match(d))){const key=d.date.slice(0,7),r=grouped.get(key)||[key,0,0,0];r[1]=money(r[1]+totals(d).total*impact(d));grouped.set(key,r);}for(const p of db.payments.filter(p=>p.side===side&&p.date>=from&&p.date<=to&&(!partner||p.partner===partner))){const key=p.date.slice(0,7),r=grouped.get(key)||[key,0,0,0];r[2]=money(r[2]+p.amount);grouped.set(key,r);}rows=[...grouped.values()].sort((a,b)=>a[0].localeCompare(b[0])).map(r=>[r[0],r[1],r[2],money(r[1]-r[2])]);
    }else if(/효율/.test(n)){
      columns=['작업지시번호','품목','지시수량','생산완료수량','달성률 %','표준시간(분)','실제시간(분)','시간효율 %'];rows=[];for(const d of db.documents.filter(d=>active(d)&&d.type==='workorder'&&match(d)))for(const l of d.lines){const children=db.documents.filter(x=>active(x)&&x.sourceId===d.id),produced=children.filter(x=>x.type==='production').flatMap(x=>x.lines).filter(x=>x.item===l.item).reduce((s,x)=>s+x.qty,0),standard=db.bor.filter(b=>b.product===l.item).reduce((s,b)=>s+b.minutes*produced,0),actual=children.filter(x=>x.type==='work').reduce((s,x)=>s+Number(x.minutes||0),0);rows.push([d.id,master(db,'items',l.item)?.name||l.item,l.qty,produced,money(produced/l.qty*100),standard,actual,actual?money(standard/actual*100):0]);}
    }else if(/생산입고\/소모/.test(n)){
      columns=['일자','전표','생산품','생산수량','원료품목','원료소모량'];rows=[];for(const d of db.documents.filter(d=>active(d)&&d.type==='production'&&match(d)))for(const l of d.lines){const materials=movements(db).filter(m=>m.id===d.id&&m.qty<0);if(!materials.length)rows.push([d.date,d.id,l.item,l.qty,'별도 생산불출',0]);else for(const m of materials)rows.push([d.date,d.id,l.item,l.qty,m.item,-m.qty]);}
    }else if(/불량률/.test(n)){
      columns=['품목코드','품목명','생산/구매수량','불량수량','불량률 %'];rows=db.masters.items.map(i=>{const amount=types=>db.documents.filter(d=>active(d)&&types.includes(d.type)&&match(d)).flatMap(d=>d.lines).filter(l=>l.item===i.code).reduce((s,l)=>s+l.qty,0),base=amount(['production','purchase']),bad=amount(['defect']);return [i.code,i.name,base,bad,base?money(bad/base*100):0];});
    }else if(n==='단가변동표'){
      columns=['일자','전표번호','구분','품목','거래처','이전단가','현재단가','변동률 %'];rows=[];const previous=new Map();for(const d of db.documents.filter(d=>active(d)&&['sale','purchase'].includes(d.type)&&match(d)).sort((a,b)=>a.date.localeCompare(b.date)))for(const l of d.lines){const key=d.type+'|'+l.item+'|'+d.partner,old=previous.get(key);rows.push([d.date,d.id,types[d.type],l.item,d.partner,old??l.price,l.price,old?money((l.price-old)/old*100):0]);previous.set(key,l.price);}
    }else if(/수불|변동|일보/.test(n)&&!/이익/.test(n)){
      columns=['일자','전표번호','구분','품목코드','품목명','창고','입고','출고','잔고'];const balance=new Map();
      const all=movements(db).filter(m=>(!wh||m.warehouse===wh)&&(!partner||m.partner===partner)&&m.date<=to);
      for(const o of db.opening.filter(o=>!wh||o.warehouse===wh)){const k=o.item+'|'+o.warehouse;balance.set(k,(balance.get(k)||0)+o.qty);}
      rows=[];for(const m of all){const k=m.item+'|'+m.warehouse,b=quantity((balance.get(k)||0)+m.qty);balance.set(k,b);if(m.date>=from)rows.push([m.date,m.id,types[m.type],m.item,master(db,'items',m.item)?.name||m.item,master(db,'warehouses',m.warehouse)?.name||m.warehouse,Math.max(m.qty,0),Math.max(-m.qty,0),b]);}
    }else if(/재고현황|재고잔량|BOM환산|다규격|관계별/.test(n)){
      columns=['품목코드','품목명','규격','창고','기초','입고','출고','현재고','안전재고','재고금액'];rows=[];
      for(const item of db.masters.items.filter(i=>!i.disabled))for(const w of db.masters.warehouses.filter(w=>!wh||w.code===wh)){
        const ms=movements(db).filter(m=>m.item===item.code&&m.warehouse===w.code&&m.date>=from&&m.date<=to),base=quantity(db.opening.filter(o=>o.item===item.code&&o.warehouse===w.code&&(!o.date||o.date<=from)).reduce((a,o)=>a+o.qty,0)+movements(db).filter(m=>m.item===item.code&&m.warehouse===w.code&&m.date<from).reduce((a,m)=>a+m.qty,0)),s=stock(db,item.code,w.code,to);
        rows.push([item.code,item.name,item.spec||'',w.name,base,quantity(ms.reduce((a,m)=>a+Math.max(0,m.qty),0)),quantity(ms.reduce((a,m)=>a+Math.max(0,-m.qty),0)),s,Number(item.safety||0),money(s*item.buyPrice)]);
      }
    }else if(/수금|지급|할인/.test(n)){
      const side=/수금|판매할인/.test(n)?'receivable':'payable';columns=['일자','번호','거래처','구분','금액','적요'];rows=db.payments.filter(p=>p.side===side&&match(p)&&(!/할인/.test(n)||p.kind==='discount')).map(p=>[p.date,p.id,master(db,'partners',p.partner)?.name||p.partner,p.kind==='discount'?'할인':side==='receivable'?'수금':'지급',p.amount,p.memo||'']);
    }else if(/채권|채무|거래처관리대장/.test(n)){
      columns=['거래처코드','거래처명','매출','매입/외주','수금/할인','지급/할인','채권잔액','채무잔액'];rows=db.masters.partners.filter(p=>!partner||p.code===partner).map(p=>{
        const ds=db.documents.filter(d=>active(d)&&d.partner===p.code&&d.date<=to);const sum=ts=>money(ds.filter(d=>ts.includes(d.type)).reduce((s,d)=>s+totals(d).total,0));const cash=side=>money(db.payments.filter(x=>x.partner===p.code&&x.side===side&&x.date<=to).reduce((s,x)=>s+x.amount,0));
        const purchases=money(ds.reduce((s,d)=>s+totals(d).total*payableImpact(d),0));return [p.code,p.name,sum(['sale']),purchases,cash('receivable'),cash('payable'),money(sum(['sale'])-cash('receivable')),money(purchases-cash('payable'))];});
    }else if(/미주문|미판매|미출하|미구매/.test(n)){
      const source=/미주문/.test(n)?'quote':/미판매/.test(n)?'order':/미출하/.test(n)?'shippingorder':'purchaseorder',target={quote:'order',order:'sale',shippingorder:'shipment',purchaseorder:'purchase'}[source];
      columns=['일자','원본전표','거래처','품목코드','품목명','원수량','처리수량','잔량'];rows=[];for(const d of db.documents.filter(d=>active(d)&&d.type===source&&match(d)))for(const l of remaining(db,d,target).filter(l=>l.qty>0)){const original=d.lines.find(x=>l.lineId?x.lineId===l.lineId:x.item===l.item).qty;rows.push([d.date,d.id,master(db,'partners',d.partner)?.name||'',l.item,master(db,'items',l.item)?.name||'',original,quantity(original-l.qty),l.qty]);}
    }else if(/이익|집계|경영자|누계/.test(n)){
      columns=['품목코드','품목명','판매수량','매출공급가','구매수량','매입공급가','추정매출원가','추정이익','불량수량'];rows=db.masters.items.map(i=>{
        const ls=t=>db.documents.filter(d=>active(d)&&d.type===t&&match(d)).flatMap(d=>d.lines).filter(l=>l.item===i.code),sum=(a,k)=>money(a.reduce((s,l)=>s+l[k],0));const sales=ls('sale'),buy=ls('purchase'),q=sum(sales,'qty'),supply=sum(sales,'supply'),cost=money(q*i.buyPrice);
        return [i.code,i.name,q,supply,sum(buy,'qty'),sum(buy,'supply'),cost,money(supply-cost),sum(ls('defect'),'qty')];});
    }else if(/진행|작업처리|출고처리/.test(n)){
      columns=['일자','전표번호','구분','거래처','수량','후속전표','상태'];rows=db.documents.filter(d=>active(d)&&(!config.docType||d.type===config.docType)&&match(d)).map(d=>[d.date,d.id,types[d.type],master(db,'partners',d.partner)?.name||'',totals(d).qty,db.documents.filter(x=>active(x)&&x.lines.some(l=>allocations(x,l).some(a=>a.documentId===d.id))).length,d.status]);
    }else{
      columns=['일자','전표번호','구분','거래처','품목','수량','단가','공급가액','부가세','합계','상태','회계반영'];rows=[];
      for(const d of db.documents.filter(d=>active(d)&&(!config.docType||d.type===config.docType)&&match(d)&&(!/미반영/.test(n)||!d.accounted)&&(!/대체사용/.test(n)||d.defectMode==='대체사용')&&(!/폐기/.test(n)||d.defectMode==='폐기')))for(const l of d.lines)rows.push([d.date,d.id,types[d.type],master(db,'partners',d.partner)?.name||'',master(db,'items',l.item)?.name||l.item,l.qty,l.price,l.supply,l.tax,l.total,d.status,d.accounted?'로컬 반영':'미반영']);
    }
    return {columns,rows:rows.filter(row=>!query||row.join(' ').toLowerCase().includes(query))};
  }
  function resolve(row){
    if(row.top!==2)return null;const name=row.name,branch=row.path[2],group=row.path[1];const base={name,group,branch,id:row.id};
    if(row.branch)return {...base,kind:'hub'};
    const direct={'거래처등록':'partners','창고등록':'warehouses','부서등록':'departments','프로젝트등록':'projects','품목등록':'items','관리항목등록':'controls','사원(담당)등록':'employees','인쇄용결재라인등록(재고)':'approvals','외화등록':'currencies','거래처특별단가그룹등록':'pricegroups','공정등록':'processes','자원등록':'resources','쇼핑몰등록':'shops'};
    if(direct[name])return {...base,kind:'master',master:direct[name]};
    if(name==='각종코드변경')return {...base,kind:'rename'};
    if(name==='단가적용순서설정')return {...base,kind:'settings'};
    if(/특별단가등록|품목별단가/.test(name))return {...base,kind:'prices'};
    if(/BOM\(소요량\)조회|BOM\(소요량\)현황/.test(name))return {...base,kind:'bom'};
    if(name==='BOR(작업소요시간)')return {...base,kind:'bor'};
    if(/소요량계산|소요시간계산|MRP/.test(name))return {...base,kind:'mrp',time:name==='소요시간계산'};
    if(name==='쇼핑몰품목코드연결')return {...base,kind:'mapping'};
    if(group==='쇼핑몰관리')return {...base,kind:'shopping',docType:'shoporder'};
    if(/회계반영$|일괄회계반영$/.test(name))return {...base,kind:'accounting',docType:/판매/.test(name)?'sale':/외주/.test(name)?'production':'purchase'};
    if(/단가일괄변경/.test(name))return {...base,kind:'bulkprice',docType:/판매/.test(name)?'sale':'purchase'};
    if(/쪽지수발신|文書|문서발송|증빙센터|^출력물$/.test(name))return {...base,kind:'documents'};
    if(name==='잔량재집계')return {...base,kind:'rebuild'};
    const aliases={'견적서':'quote','주문서':'order','판매':'sale','출하지시서':'shippingorder','출하':'shipment','발주요청':'request','발주계획':'plan','단가요청':'pricerequest','발주서':'purchaseorder','구매':'purchase','작업지시서':'workorder','생산불출':'issue','작업':'work','생산입고':'production','창고이동':'transfer','자가사용':'consume','불량처리':'defect','재고조정':'adjust'};
    let docType=aliases[branch];if(!docType)for(const label of Object.keys(aliases).sort((a,b)=>b.length-a.length))if(name.startsWith(label)){docType=aliases[label];break;}
    if(/매출\(세금\)|거래명세서|회계미반영.*판매/.test(name))docType='sale';
    if(/매입\(세금\)|회계미반영.*구매/.test(name))docType=group==='생산/외주'?'production':'purchase';
    if(/대체사용|폐기|불량률/.test(name))docType='defect';
    if(/재고실사/.test(name))docType='count';
    if(/입력|^생산입고 I{1,3}$/.test(name))return {...base,kind:'form',docType:docType||'sale'};
    if(/조회$/.test(name)&&docType&&!/이력/.test(name))return {...base,kind:'list',docType};
    if(/출고처리|작업처리|진행단계/.test(name))return {...base,kind:'workflow',docType:docType||'adjust'};
    if(/수금|지급|할인/.test(name))return {...base,kind:'payment',docType,side:/수금|판매할인/.test(name)?'receivable':'payable',discount:/할인/.test(name)};
    // Report aliases under 출력물 use the same saved document source as their business menu.
    return {...base,kind:'report',docType:/채권|채무|集計|집계|이익|경영|관리대장|누계|단가변동/.test(name)?undefined:docType};
  }
  function applyPolicy(input,policy){
    const db=clone(input);if(!policy)return db;
    if(policy.features){db.settings.allowNegative=policy.features.allowNegative===true;db.settings.priceOrder=policy.features.pricePriority==='item'?['품목단가','특별단가']:['특별단가','품목단가'];}return db;
  }
  function priceRequestOrderLines(db,source,lines){return priceRequestModule().orderLines(db,source,lines,api);}
  function priceRequestOrderPartner(lines,partner){return priceRequestModule().orderPartner(lines,partner);}
  function priceRequestModule(){const Q=typeof module==='object'&&module.exports?require('./price-request-core.js'):root.PriceRequestCore;if(!Q)throw Error('단가 비교 모듈을 다시 불러오세요.');return Q;}
  function purchaseRoomModule(){return typeof module==='object'&&module.exports?require('./purchase-room-core.js'):root.PurchaseRoomCore;}
  function guardClosedPurchaseOrders(before,after){
    const oldDocs=new Map(before.documents.map(d=>[d.id,d]));
    const quantities=d=>{const result=new Map();for(const line of d?.lines||[]){const key=JSON.stringify([line.item,line.sourceLineId||'']);result.set(key,quantity((result.get(key)||0)+Number(line.qty)));}return result;};
    for(const doc of after.documents){
      const priorDoc=oldDocs.get(doc.id),priorSource=oldDocs.get(priorDoc?.sourceId),currentPriorSource=after.documents.find(d=>d.id===priorDoc?.sourceId);
      if(priorDoc?.type==='purchase'&&priorSource?.type==='purchaseorder'&&purchasingState(priorSource).progress==='완료'&&currentPriorSource&&purchasingState(currentPriorSource).progress==='완료'&&doc.sourceId!==priorDoc.sourceId)throw Error('종결된 발주서의 구매 연결은 제거하거나 변경할 수 없습니다.');
      if(doc.type!=='purchase'||!doc.sourceId)continue;
      const source=after.documents.find(d=>d.id===doc.sourceId),oldSource=oldDocs.get(doc.sourceId);
      // A normal receipt may close its source through an existing progress rule. Preserve that atomic flow.
      if(source?.type!=='purchaseorder'||purchasingState(source).progress!=='완료'||oldSource?.type!=='purchaseorder'||purchasingState(oldSource).progress!=='완료')continue;
      const previous=oldDocs.get(doc.id);
      if(!previous||previous.sourceId!==doc.sourceId)throw Error('종결된 발주서는 진행중으로 변경한 뒤 구매를 입력하세요.');
      if(JSON.stringify(previous)===JSON.stringify(doc))continue;
      if(!active(previous)&&active(doc))throw Error('종결된 발주서는 진행중으로 변경한 뒤 구매를 다시 확인하세요.');
      const prior=quantities(previous),next=quantities(doc);
      for(const [key,qty] of next)if(qty>(prior.get(key)||0))throw Error('종결된 발주서의 구매 수량을 늘릴 수 없습니다. 진행중으로 변경하세요.');
    }
  }
  function guardClosedPeriods(before,after){
    const closings=before.settings.purchaseRoom?.closings?.filter(c=>c.status==='closed')||[];
    if(!closings.length)return;
    const changed=(oldRows,newRows)=>{const old=new Map(oldRows.map(d=>[d.id,d])),now=new Map(newRows.map(d=>[d.id,d]));return [...new Set([...old.keys(),...now.keys()])].filter(id=>JSON.stringify(old.get(id))!==JSON.stringify(now.get(id))).flatMap(id=>[old.get(id),now.get(id)].filter(Boolean));};
    const documents=changed(before.documents,after.documents),payments=changed(before.payments,after.payments);
    for(const closing of closings){
      // Payments are partner balances without invoice/warehouse allocations; a warehouse label cannot bypass a monthly lock.
      if(documents.some(d=>d.date.slice(0,7)===closing.month&&[d.warehouse,d.targetWarehouse,d.materialWarehouse].includes(closing.warehouse))||payments.some(p=>p.date.slice(0,7)===closing.month))throw Error(closing.month+' / '+closing.warehouse+' 마감 자료입니다. 사유를 남겨 마감을 재개방한 뒤 처리하세요.');
    }
  }
  function applyLinkedProgressRules(db,children,policy){
    const linked=(Array.isArray(children)?children:[children]).filter(d=>d&&active(d)&&d.lines.some(l=>allocations(d,l).length));
    if(!linked.length)return;
    const rules=policy?.inventoryFeatures?.progressRules;if(rules===undefined)return;
    if(!Array.isArray(rules)||rules.length>100)throw Error('연결 진행 규칙을 다시 확인하세요.');
    const seenRules=new Set();for(const rule of rules){if(!rule||typeof rule!=='object'||Array.isArray(rule)||Object.keys(rule).some(k=>!['from','to','enabled','progress'].includes(k))||typeof rule.enabled!=='boolean'||!['진행','완료'].includes(rule.progress))throw Error('연결 진행 규칙을 다시 확인하세요.');if(!rule.enabled)continue;const key=rule.from+'|'+rule.to;if(!Object.hasOwn(types,rule.from)||!Object.hasOwn(types,rule.to)||rule.from===rule.to||seenRules.has(key))throw Error('알 수 없거나 중복된 연결 진행 규칙입니다.');seenRules.add(key);}
    const targets=new Map();for(const child of linked)for(const line of child.lines)for(const ref of allocations(child,line)){
      const source=db.documents.find(d=>d.id===ref.documentId),matches=source&&rules.filter(r=>r.enabled&&r.from===source.type&&r.to===child.type);if(!matches?.length)continue;
      if(!active(source)||!nextTypes[source.type]?.includes(child.type))throw Error('연결 진행 규칙의 원본 전표가 변경됐습니다.');
      const rule=matches[0],key=source.id+'|'+rule.progress;if(!targets.has(key))targets.set(key,{source,progress:rule.progress,selections:new Map()});
      if(source.type==='plan'){const lines=source.lines.filter(l=>l.item===ref.item&&(!ref.sourceLineId||l.lineId===ref.sourceLineId));if(lines.length!==1||lines[0].lineId&&!ref.sourceLineId)throw Error('연결 진행 규칙의 원본 품목행을 확인하세요.');const original=lines[0],id=original.lineId||original.item;targets.get(key).selections.set(id,{documentId:source.id,item:original.item,...(original.lineId?{lineId:original.lineId}:{})});}
    }
    const sourceStates=new Map();for(const target of targets.values()){const old=sourceStates.get(target.source.id);if(old&&old!==target.progress)throw Error('동일 원본에 서로 다른 진행 변경 규칙이 적용됐습니다.');sourceStates.set(target.source.id,target.progress);if(target.source.type==='plan')planLineProgress(db,{selections:[...target.selections.values()],progress:target.progress});else transition(db,{ids:[target.source.id],...(purchasingTypes.includes(target.source.type)?{progress:target.progress}:{status:target.progress})});}
    validateLinks(db);validateStock(db);
  }
  const commandNames=['master','itemBatch','itemConfig','document','purchasePlanGenerate','planLineProgress','purchaseRoom','priceRequest','priceRequestCreate','convert','transition','payment','removePayment','bom','rename','bor','price','mapping','settings','formSave','formActivate','formDelete','formRules','bulkprice','rebuild'];
  function command(input,op,payload={},policy){
    if(!commandNames.includes(op)||!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('지원하지 않는 작업 또는 요청 자료입니다.');
    if(input?.settings&&Object.hasOwn(input.settings,'priceRequests'))priceRequestModule().validateStore(input.settings.priceRequests);
    if(op==='settings'&&Object.hasOwn(payload,'priceRequests'))throw Error('단가 비교 자료는 전용 업무 명령으로 변경하세요.');
    if(op==='master'&&payload.key==='currencies'&&typeof payload.record?.rate==='number'&&!Number.isFinite(payload.record.rate))throw Error('환율 값을 확인하세요.');
    const db=applyPolicy(input,policy);payload=op==='priceRequest'?payload:clone(payload);let result;
    if(op==='master')result=saveMaster(db,payload);
    else if(op==='itemBatch'){
      if(!Array.isArray(payload.records)||!payload.records.length||payload.records.length>10000)throw Error('일괄 품목은 1~10,000행을 입력하세요.');
      if(new Set(payload.records.map(x=>String(x.record?.code||'').trim())).size!==payload.records.length)throw Error('일괄 품목코드가 중복됩니다.');
      result=payload.records.map(row=>saveMaster(db,{key:'items',record:row.record,originalCode:row.originalCode}));
    }
    else if(op==='itemConfig'){if(!I)throw Error('품목 모듈을 다시 불러오세요.');db.settings.itemRegistration=I.validateConfig(payload.config);result=db.settings.itemRegistration;log(db,'품목 입력화면·기능설정 변경');}
    else if(op==='document')result=saveDoc(db,payload);
    else if(op==='priceRequestCreate'){
      if(!payload||Object.keys(payload).length!==2||!Object.hasOwn(payload,'document')||!Object.hasOwn(payload,'vendorCodes')||!payload.document||payload.document.type!=='pricerequest'||payload.document.id)throw Error('신규 단가요청과 요청 거래처를 확인하세요.');
      if(payload.document.partner)throw Error('신규 단가요청 거래처는 다중 선택으로 지정하세요.');
      result=saveDoc(db,payload.document);
      const out=priceRequestModule().storeCommand(db,{action:'start',documentId:result.id,vendorCodes:payload.vendorCodes},api);
      db.settings.priceRequests=out.store;
    }
    else if(op==='purchasePlanGenerate'){if(!Array.isArray(payload.documents)||!payload.documents.length||payload.documents.length>200||payload.documents.some(d=>d.id||d.type!=='purchaseorder'||d.generatedFrom!=='purchase-plan'))throw Error('발주계획 발주서 일괄 생성 자료를 확인하세요.');result=payload.documents.map(d=>saveDoc(db,d));}
    else if(op==='priceRequest'){const out=priceRequestModule().storeCommand(db,payload,api);db.settings.priceRequests=out.store;result=out.result;log(db,'단가 비교 처리: '+payload.action);}
    else if(op==='purchaseRoom'){const PR=purchaseRoomModule();if(!PR)throw Error('구매실 업무 모듈을 다시 불러오세요.');const out=PR.command(db,payload,api);db.settings.purchaseRoom=PR.validateStore(out.store,db,api);result=out.result;log(db,'구매실 업무 처리: '+payload.action);}
    else if(op==='convert')result=convert(db,payload);
    else if(op==='transition')result=transition(db,payload);
    else if(op==='planLineProgress')result=planLineProgress(db,payload);
    else if(op==='payment')result=payment(db,payload);
    else if(op==='removePayment'){db.payments=db.payments.filter(x=>x.id!==payload.id);log(db,'수금/지급 취소');}
    else if(op==='bom')result=setBom(db,payload);
    else if(op==='rename')result=rename(db,payload);
    else if(op==='bor'){requireCode(db,'items',payload.product);requireCode(db,'processes',payload.process);requireCode(db,'resources',payload.resource);const row={...payload,minutes:num(payload.minutes,'소요시간',.000001)};db.bor=db.bor.filter(x=>!(x.product===row.product&&x.process===row.process));db.bor.push(row);log(db,'BOR 저장');result=row;}
    else if(op==='price'){requireCode(db,'items',payload.item);if(payload.group)requireCode(db,'pricegroups',payload.group);else requireCode(db,'partners',payload.partner);const row={...payload,group:payload.group||'',partner:payload.group?'':payload.partner,price:num(payload.price,'특별단가')};db.prices=db.prices.filter(x=>!(x.item===row.item&&x.partner===row.partner&&(x.group||'')===row.group&&Boolean(x.buy)===Boolean(row.buy)));db.prices.push(row);result=row;}
    else if(op==='mapping'){requireCode(db,'shops',payload.shop);requireCode(db,'items',payload.item);if(!payload.external)throw Error('쇼핑몰 품목코드를 입력하세요.');db.mappings=db.mappings.filter(x=>!(x.shop===payload.shop&&x.external===payload.external));db.mappings.push(payload);result=payload;}
    else if(op==='settings'){if(Object.hasOwn(payload,'purchaseRoom'))throw Error('구매실 설정은 전용 업무 명령으로 변경하세요.');db.settings={...db.settings,...payload};validateStock(db);}
    else if(op==='formSave'){db.settings.customization=F.save(db.settings.customization,payload.key,payload.context,payload.form);result=payload.form;}
    else if(op==='formActivate'){db.settings.customization=F.activate(db.settings.customization,payload.key,payload.context,payload.id);}
    else if(op==='formDelete'){db.settings.customization=F.remove(db.settings.customization,payload.key,payload.id);}
    else if(op==='formRules'){db.settings.customization=F.rules(db.settings.customization,payload.key,payload.rules);}
    else if(op==='bulkprice'){for(const d of db.documents.filter(d=>payload.ids.includes(d.id))){if(d.accounted)throw Error('회계반영을 취소하세요.');if(d.vatCalculation==='transaction'&&num(payload.percent,'변경률',-100)!==0)throw Error('거래별 조정 전표는 단가 변경 후 차액을 다시 확인하세요.');saveDoc(db,{...d,lines:d.lines.map(l=>({...l,price:money(l.price*(1+num(payload.percent,'변경률',-100)/100))}))});}}
    else if(op==='rebuild'){validateLinks(db);validateStock(db);log(db,'연결 잔량·재고 재검증 완료');}
    else throw Error('지원하지 않는 작업입니다.');
    if(['document','convert','transition','purchaseRoom','bulkprice'].includes(op))guardClosedPurchaseOrders(input,db);
    if(['document','convert','purchasePlanGenerate'].includes(op))applyLinkedProgressRules(db,result,policy);
    guardClosedPeriods(input,db);
    if(Object.hasOwn(db.settings,'priceRequests'))db.settings.priceRequests=priceRequestModule().validateStore(db.settings.priceRequests);
    if(db.settings.purchaseRoom)db.settings.purchaseRoom=purchaseRoomModule().validateStore(db.settings.purchaseRoom,db,api);
    for(const p of db.masters.partners)for(const side of ['receivable','payable'])if(outstanding(db,side,p.code)<-.001)throw Error('수금/지급 잔액을 초과하게 됩니다. 수금/지급 기록을 먼저 취소하세요.');
    recordDocumentHistory(input,db,op);
    return {db,result};
  }
  function validateBackup(value){
    if(!value||value.version!==2||!value.masters||!Array.isArray(value.documents)||value.documents.length>10000)throw Error('재고 I v2 백업 파일을 선택하세요.');
    if(value.settings&&Object.hasOwn(value.settings,'priceRequests'))priceRequestModule().validateStore(value.settings.priceRequests);
    const db=clone(value);for(const key of Object.keys(masterNames))if(!Array.isArray(db.masters[key])||db.masters[key].some(x=>!x.code||!x.name)||new Set(db.masters[key].map(x=>x.code)).size!==db.masters[key].length)throw Error('등록 자료가 올바르지 않습니다.');
    for(const key of ['partners','projects'])for(const record of db.masters[key])validateMasterGroups(key,record);
    for(const key of ['payments','bom','bor','prices','mappings','opening','logs'])if(!Array.isArray(db[key]))throw Error('백업 구조가 올바르지 않습니다.');
    if(db.documentHistory!==undefined)db.documentHistory=validateDocumentHistory(db.documentHistory);
    if(!Number.isSafeInteger(db.sequence)||db.sequence<0||!db.settings||!Array.isArray(db.settings.priceOrder)||typeof db.settings.allowNegative!=='boolean'||db.settings.priceOrder.length!==2||!db.settings.priceOrder.includes('특별단가')||!db.settings.priceOrder.includes('품목단가'))throw Error('백업 설정이 올바르지 않습니다.');
    db.settings.customization=F.validateStore(db.settings.customization);
    if(Object.hasOwn(db.settings,'priceRequests'))db.settings.priceRequests=priceRequestModule().validateStore(db.settings.priceRequests);
    if(I&&db.settings.itemRegistration)db.settings.itemRegistration=I.validateConfig(db.settings.itemRegistration);
    const dateOK=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
    for(const i of db.masters.items){if(I){const validated=I.validate(i,db);for(const key of Object.keys(i))if(Object.hasOwn(validated,key))i[key]=validated[key];for(const key of ['buyPrice','sellPrice','safety'])i[key]=validated[key];}else {i.buyPrice=num(i.buyPrice||0,'입고단가');i.sellPrice=num(i.sellPrice||0,'출고단가');i.safety=num(i.safety||0,'안전재고');}if(i.relatedItems!==undefined&&(!Array.isArray(i.relatedItems)||i.relatedItems.length>200||i.relatedItems.some(code=>code===i.code||!master(db,'items',code))))throw Error('백업 관계 품목을 확인하세요.');}
    for(const d of db.documents){
      for(const line of d.lines||[])if(line.priceRequestBasis!==undefined)priceRequestModule().validateOrderBasis(line);
      if(!d.id||!types[d.type]||!Array.isArray(d.lines)||!d.lines.length||!dateOK(d.date)||!master(db,'warehouses',d.warehouse))throw Error('백업 전표가 올바르지 않습니다.');
      if(purchasingTypes.includes(d.type)&&d.modifiedAt!==undefined&&(typeof d.modifiedAt!=='string'||!Number.isFinite(Date.parse(d.modifiedAt))||new Date(d.modifiedAt).toISOString()!==d.modifiedAt))throw Error('전표 수정 시각을 확인하세요.');
      validatePurchasingState(d);if(d.status!==undefined&&!documentStatuses.includes(statusValue(d.status)))throw Error('백업 전표 처리 상태를 확인하세요.');
      if(d.accounted&&!active(d))throw Error('백업의 미확인·취소 전표는 회계반영할 수 없습니다.');
      if(d.partner&&!master(db,'partners',d.partner))throw Error('전표 거래처를 확인하세요.');
      if(['purchasereturn','exchangereceipt'].includes(d.type)&&!d.partner)throw Error('반품·교환 거래처를 확인하세요.');
      if(d.type==='transfer'&&(!master(db,'warehouses',d.targetWarehouse)||d.targetWarehouse===d.warehouse))throw Error('이동 창고를 확인하세요.');
      d.vatRate=num(d.vatRate??10,'부가세율');if(d.vatRate>100)throw Error('부가세율을 확인하세요.');
      if(d.taxRounding!==undefined)d.taxRounding=taxRounding(d.taxRounding);if(d.supplyRounding!==undefined)d.supplyRounding=supplyRounding(d.supplyRounding);
      d.lines=d.lines.map(l=>{if(purchasingTypes.includes(d.type)&&l.managementItem!==undefined&&(typeof l.managementItem!=='string'||l.managementItem&&!master(db,'controls',l.managementItem)))throw Error('백업 관리항목 코드를 확인하세요.');if(!master(db,'items',l.item))throw Error('존재하지 않는 품목입니다.');validateLineProgress(d,l);if(['request','plan'].includes(d.type)&&l.supplier!==undefined&&typeof l.supplier!=='string')throw Error('품목행 거래처를 확인하세요.');if(['request','plan'].includes(d.type)&&l.supplier&&!master(db,'partners',l.supplier))throw Error('품목행 거래처를 확인하세요.');validatePlanQuantity(d.type,l);const x=lineTotals(l,d.vatRate,d.taxRounding,d.supplyRounding);if(d.type!=='adjust'&&(x.qty<0||(x.qty===0&&!['count','plan'].includes(d.type))))throw Error('수량을 확인하세요.');return ['purchasereturn','exchangereceipt'].includes(d.type)&&x.returnAmounts?{...x,supply:x.returnAmounts.supply,tax:x.returnAmounts.tax,total:x.returnAmounts.total}:x;});
      if(hasVatContract(d))d.lines=effectiveDocumentLines(d);
      if(d.lines.some(l=>l.lineId)&&!ownLineIds(d))throw Error('백업 전표 라인 구분이 중복되거나 누락되었습니다.');
      if(new Set(d.lines.map(l=>l.item)).size!==d.lines.length&&!structuredLines(db,d))throw Error('중복 전표 품목입니다.');
      if(d.sourceId){const source=db.documents.find(x=>x.id===d.sourceId);if(!source||!nextTypes[source.type]?.includes(d.type)||source.id===d.id)throw Error('연결 전표를 확인하세요.');}
      if(d.consumption)for(const c of d.consumption){if(!master(db,'items',c.item)||!master(db,'items',c.product))throw Error('소모 품목을 확인하세요.');c.qty=num(c.qty,'소모량');}
    }
    if(new Set(db.documents.map(d=>d.id)).size!==db.documents.length)throw Error('중복 전표번호입니다.');
    for(const o of db.opening){if(!master(db,'items',o.item)||!master(db,'warehouses',o.warehouse))throw Error('기초재고 참조를 확인하세요.');o.qty=num(o.qty,'기초재고');}
    for(const p of db.payments){if(!master(db,'partners',p.partner)||!['receivable','payable'].includes(p.side)||!dateOK(p.date)||p.warehouse&&!master(db,'warehouses',p.warehouse))throw Error('수금/지급 자료를 확인하세요.');p.amount=num(p.amount,'수금/지급금액',.01);}
    for(const b of db.bom){if(!master(db,'items',b.product)||!master(db,'items',b.material))throw Error('BOM 참조를 확인하세요.');b.qty=num(b.qty,'소요량',.000001);b.loss=num(b.loss||0,'로스율');}
    const visit=(code,path)=>{if(path.includes(code))throw Error('BOM 순환 참조입니다.');for(const b of db.bom.filter(b=>b.product===code))visit(b.material,[...path,code]);};for(const i of db.masters.items)visit(i.code,[]);
    for(const b of db.bor){if(!master(db,'items',b.product)||!master(db,'processes',b.process)||!master(db,'resources',b.resource))throw Error('BOR 참조를 확인하세요.');b.minutes=num(b.minutes,'소요시간',.000001);}
    for(const p of db.prices){if(!master(db,'items',p.item)||(!p.group&&!master(db,'partners',p.partner))||(p.group&&!master(db,'pricegroups',p.group)))throw Error('단가 참조를 확인하세요.');p.price=num(p.price,'단가');}
    validateLinks(db);validateStock(db);if(db.settings.purchaseRoom){const PR=purchaseRoomModule();if(!PR)throw Error('구매실 업무 모듈을 다시 불러오세요.');db.settings.purchaseRoom=PR.validateStore(db.settings.purchaseRoom,db,api);}for(const p of db.masters.partners)for(const side of ['receivable','payable'])if(outstanding(db,side,p.code)<-.001)throw Error('백업의 수금/지급 잔액을 확인하세요.');return db;
  }
  function seed(){
    let db=empty();db.masters.items=[{code:'P001',name:'샘플 완제품 A',spec:'표준형',unit:'EA',buyPrice:12000,sellPrice:20000,safety:10},{code:'P002',name:'샘플 완제품 B',spec:'고급형',unit:'EA',buyPrice:18000,sellPrice:30000,safety:5},{code:'M001',name:'샘플 원재료',spec:'1kg',unit:'KG',buyPrice:2000,sellPrice:3000,safety:30},{code:'S001',name:'샘플 포장재',spec:'BOX',unit:'EA',buyPrice:500,sellPrice:1000,safety:20}];
    db.masters.partners=[{code:'C001',name:'샘플 판매처',kind:'매출',memo:'가상 자료'},{code:'V001',name:'샘플 구매처',kind:'매입',memo:'가상 자료'}];
    db.masters.warehouses=[{code:'W001',name:'본사창고'},{code:'W002',name:'생산창고'}];db.masters.employees=[{code:'E001',name:'샘플 담당자'}];db.masters.departments=[{code:'D001',name:'영업부'}];db.masters.projects=[{code:'PR001',name:'샘플 프로젝트'}];db.masters.currencies=[{code:'KRW',name:'원화',rate:1},{code:'USD',name:'달러',rate:1350}];db.masters.processes=[{code:'OP01',name:'조립'}];db.masters.resources=[{code:'R01',name:'생산라인 1'}];db.masters.shops=[{code:'SHOP01',name:'샘플몰',memo:'로컬 시뮬레이션'}];
    for(const i of db.masters.items)for(const w of db.masters.warehouses)db.opening.push({item:i.code,warehouse:w.code,qty:i.code==='M001'?200:i.code==='S001'?100:50,date:'2026-01-01'});
    db.bom=[{product:'P001',material:'M001',qty:2,loss:0},{product:'P001',material:'S001',qty:1,loss:0}];db.bor=[{product:'P001',process:'OP01',resource:'R01',minutes:5}];
    const common={date:today(),warehouse:'W001',vatRate:10,employee:'E001',status:'진행'};
    for(const [type,partner,qty,item,price] of [['quote','C001',10,'P001',20000],['order','C001',8,'P001',20000],['sale','C001',3,'P001',20000],['purchaseorder','V001',40,'M001',2000],['purchase','V001',20,'M001',2000],['workorder','',5,'P001',12000],['shoporder','C001',2,'P002',30000]])db=command(db,'document',{...common,type,partner,lines:[{item,qty,price}],memo:'샘플 전표'}).db;
    return db;
  }
  const api={purchaseSupplier,priceRequestOrderLines,priceRequestOrderPartner,today,clone,money,quantity,types,nextTypes,masterNames,empty,seed,master,active,listed,purchasingState,purchasingLineState,statusValue,statusLabel,documentStatuses,taxRounding,supplyRounding,lineTotals,effectiveLineTotals,effectiveDocumentLines,totals,movements,stock,remaining,outstanding,payableImpact,linkedWarehouse,linkedWarehouseMatches,linkedPartner,validatePlanOrderRows,requirements,priceFor,report,resolve,command,validateBackup,applyPolicy,commandNames,documentHistory,validateDocumentHistory,historyActions,purchaseTransactionTypes,referenceCodes,matchesReference,sortModified,filterDocumentDates};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.InventoryCore=api;
})(typeof globalThis==='object'?globalThis:this);
