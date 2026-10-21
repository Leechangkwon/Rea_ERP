(function(root){
  'use strict';
  const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
  const salesTypes=['quote','order','sale','shippingorder','shipment'];
  const purchaseTypes=['request','plan','pricerequest','purchaseorder','purchase','purchasereturn','exchangereceipt'];
  const sourceTypes=Object.keys(C.types);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const q=C.quantity;
  function date(value,label='기준일'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error(label+'을 확인하세요.');
    return value;
  }
  function amount(value,label='수량'){
    const number=Number(value);
    if(value===''||value===null||typeof value==='boolean'||!Number.isFinite(number)||number<=0||number>1e12||q(number)<=0)throw Error(label+'은 0보다 큰 수로 입력하세요.');
    return q(number);
  }
  function enabled(db,key,code,label){
    const record=C.master(db,key,code);
    if(!record||record.disabled)throw Error((label||C.masterNames[key])+'을 선택하세요.');
    return record;
  }
  function stockDb(db,{asOf,excludeId}={}){
    return {...db,documents:db.documents.filter(d=>d.id!==excludeId&&(!asOf||d.date<=asOf))};
  }
  function textMatch(values,query){
    const needle=String(query||'').trim().toLocaleLowerCase('ko-KR');
    return !needle||values.some(v=>String(v||'').toLocaleLowerCase('ko-KR').includes(needle));
  }
  function sourceRecord(db,id){
    const d=db.documents.find(x=>x.id===id);
    if(!d||!C.active(d)||!sourceTypes.includes(d.type))throw Error('불러올 수 있는 전표가 아닙니다.');
    enabled(db,'warehouses',d.warehouse,'원본 창고');
    if(d.partner)enabled(db,'partners',d.partner,'원본 거래처');
    return d;
  }
  function documentCandidates(db,options={}){
    const {targetType,sourceType,warehouse,partner,from,to,query,excludeId}=options,mode=options.mode||'copy';
    if(!['copy','linked'].includes(mode))throw Error('전표 불러오기 방식을 확인하세요.');
    if(mode==='linked'&&!C.types[targetType])throw Error('작성할 전표 종류를 선택하세요.');
    if(from)date(from,'기간 시작');if(to)date(to,'기간 종료');if(from&&to&&from>to)throw Error('조회 기간을 확인하세요.');
    if(warehouse)enabled(db,'warehouses',warehouse);if(partner)enabled(db,'partners',partner);
    const view=stockDb(db,{excludeId});
    return db.documents.filter(d=>d.id!==excludeId&&C.active(d)&&sourceTypes.includes(d.type)&&(!sourceType||d.type===sourceType)&&(!warehouse||(mode==='linked'?C.linkedWarehouse(d,targetType):d.warehouse)===warehouse)&&(!partner||mode==='linked'&&d.type==='transfer'&&targetType==='sale'||d.partner===partner||['request','plan'].includes(d.type)&&(mode==='copy'||!d.partner)&&d.lines.some(l=>l.supplier===partner))&&(!from||d.date>=from)&&(!to||d.date<=to)&&(!C.master(db,'warehouses',d.warehouse)?.disabled)&&(!d.partner||!C.master(db,'partners',d.partner)?.disabled)&&
      (mode==='copy'||C.nextTypes[d.type]?.includes(targetType)&&!(d.type==='purchasereturn'&&targetType==='exchangereceipt'&&d.settlementMode!=='exchange'))).map(d=>{
      const lines=(mode==='linked'?C.remaining(view,d,targetType):d.lines).filter(l=>l.qty>0&&C.master(db,'items',l.item)&&!C.master(db,'items',l.item).disabled&&(!partner||!['request','plan'].includes(d.type)||(l.supplier||d.partner)===partner)&&(mode!=='linked'||d.type!=='plan'||targetType!=='purchaseorder'||C.purchasingLineState(d,l).progress!=='완료')).map(l=>({
        ...copy(l),key:d.id+'|'+(l.lineId||l.item),name:C.master(db,'items',l.item).name,originalQty:d.lines.find(x=>l.lineId?x.lineId===l.lineId:x.item===l.item).qty
      }));
      const processingWarehouse=mode==='linked'?C.linkedWarehouse(d,targetType):d.warehouse,partnerCodes=[...new Set(['request','plan'].includes(d.type)?lines.map(l=>l.supplier||d.partner).filter(Boolean):[d.partner].filter(Boolean))],partnerNames=partnerCodes.map(code=>C.master(db,'partners',code)?.name||code);return {id:d.id,type:d.type,date:d.date,partner:d.partner||'',partnerName:partnerNames.join(', '),warehouse:processingWarehouse,warehouseName:C.master(db,'warehouses',processingWarehouse)?.name||'',memo:d.memo||'',lines};
    }).filter(d=>d.lines.length&&textMatch([d.id,d.memo,d.partner,d.partnerName,...d.lines.flatMap(l=>[l.item,l.name,l.supplier||''])],query)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  }
  function stockCandidates(db,options={}){
    const {warehouse,excludeId}=options,asOf=date(options.asOf||C.today());
    const safetyScope=options.safetyScope||'warehouse';if(!['item','warehouse'].includes(safetyScope))throw Error('안전재고 기준을 선택하세요.');
    enabled(db,'warehouses',warehouse);
    const view=stockDb(db,{asOf,excludeId}),includePending=options.includePending!==false;
    const pending=(type,target)=>{
      const result=new Map();
      for(const d of view.documents.filter(d=>C.active(d)&&d.type===type&&d.warehouse===warehouse))for(const l of C.remaining(view,d,target))result.set(l.item,q((result.get(l.item)||0)+Math.max(0,l.qty)));
      return result;
    };
    const sales=pending('order','sale'),purchases=pending('purchaseorder','purchase'),balances=new Map();
    for(const row of [...db.opening.filter(o=>!o.date||o.date<=asOf),...C.movements(view)])if(row.warehouse===warehouse)balances.set(row.item,q((balances.get(row.item)||0)+row.qty));
    return db.masters.items.filter(i=>!i.disabled&&i.trackInventory!==false&&(!options.supplier||i.supplier===options.supplier)&&textMatch([i.code,i.name,i.spec,i.barcode,i.group,i.group1,i.group2,i.group3],options.query)).map(i=>{
      const stock=balances.get(i.code)||0,pendingSales=sales.get(i.code)||0,pendingPurchases=purchases.get(i.code)||0;
      const override=safetyScope==='warehouse'?(i.warehouseSafety||[]).find(w=>w.warehouse===warehouse):undefined,safety=Number(override?override.qty:i.safety||0);
      const expected=q(stock-(includePending?pendingSales:0)+(includePending?pendingPurchases:0)),shortage=q(Math.max(0,safety-expected));
      return {item:i.code,name:i.name,spec:i.spec||'',unit:i.unit||'',warehouse,asOf,stock,pendingSales,pendingPurchases,expected,safety,shortage,qty:options.onlyShortage?shortage:Math.max(0,stock),price:C.priceFor(db,i.code,options.partner||'',purchaseTypes.includes(options.targetType),options.vatRate),safetyScope,safetySource:override?'warehouse':'item'};
    }).filter(row=>options.onlyShortage?row.shortage>0:options.includeZero===true||row.stock>0).sort((a,b)=>a.item.localeCompare(b.item,'ko-KR',{numeric:true}));
  }
  function selectedRows(selections){
    if(!Array.isArray(selections)||!selections.length||selections.length>500)throw Error('불러올 행을 1~500개 선택하세요.');
    const seen=new Set();
    for(const s of selections){if(!s||!s.item)throw Error('중복되거나 올바르지 않은 선택입니다.');const key=(s.documentId||'')+'|'+(s.lineId||s.item);if(seen.has(key))throw Error('중복되거나 올바르지 않은 선택입니다.');seen.add(key);}
    return selections;
  }
  function sameValue(a,b){
    if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
    const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();return ak.length===bk.length&&ak.every((k,i)=>k===bk[i]&&sameValue(a[k],b[k]));
  }
  function mergeLines(existing,incoming,options={}){
    const result=copy(existing||[]),structured=['request','plan'].includes(options.type)&&(options.structured===true||result.length>0&&result.every(l=>typeof l.lineId==='string'&&l.lineId));
    const comparable=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['qty','supply','tax','total','importedFrom','lineId','_new'].includes(key)));
    const normalized=value=>comparable({...value,price:Number(value.price||0),discount:Number(value.discount||0),memo:value.memo||'',custom:value.custom||{},supplier:value.supplier||''});
    const add=line=>{const row=copy(line);if(structured){const ids=new Set(result.map(l=>l.lineId));let serial=1;while(ids.has('L'+serial))serial++;row.lineId='L'+serial;}else if(row.lineId&&result.some(l=>l.lineId===row.lineId)){delete row.lineId;}result.push(row);};
    for(const line of incoming){
      const peers=result.filter(x=>x.item===line.item);
      if(!peers.length){add(line);continue;}
      if(peers.some(x=>Boolean(x.sourceLineId)!==Boolean(line.sourceLineId)))throw Error(line.item+': 원본 연결 행과 일반 행을 섞을 수 없습니다.');
      const sameSource=peers.filter(x=>(x.sourceLineId||'')===(line.sourceLineId||''));
      if(!sameSource.length&&line.sourceLineId){add(line);continue;}
      // Source-line children may retain identical parent allocation metadata; ordinary copies cannot mix it.
      if((line.planAllocations||sameSource.some(x=>x.planAllocations))&&(!line.sourceLineId||sameSource.some(x=>!sameValue(x.planAllocations,line.planAllocations))))throw Error(line.item+': 원본 연결 배분이 있는 행에는 복사·재고 수량을 섞을 수 없습니다.');
      const old=sameSource.find(x=>sameValue(normalized(x),normalized(line)));
      if(!old){
        // Different exact source lines remain separate; structured purchasing rows retain differing terms.
        if(!sameSource.length&&line.sourceLineId||structured&&!line.sourceLineId){add(line);continue;}
        throw Error(line.item+': 단가·할인·적요 또는 추가 항목이 다릅니다. 기존 행을 정리하거나 덮어쓰기를 선택하세요.');
      }
      old.qty=amount(q(Number(old.qty)+Number(line.qty)));
      old.importedFrom=[...(old.importedFrom||[]),...(line.importedFrom||[])];
      delete old.supply;delete old.tax;delete old.total;
    }
    if(result.length>500)throw Error('전표 품목은 500행까지 입력할 수 있습니다.');
    return result;
  }
  function appendRequestOrderLines(existing,incoming){
    const result=copy(existing||[]),ids=new Set();
    for(const row of result){
      if(row.sourceLineId||row.planAllocations)throw Error('원본 연결 행에는 주문 복사 행을 섞을 수 없습니다.');
      if(row.lineId!==undefined){if(typeof row.lineId!=='string'||!row.lineId||row.lineId.length>200||ids.has(row.lineId))throw Error('기존 전표 라인 구분을 확인하세요.');ids.add(row.lineId);}
    }
    let serial=1;const allocate=()=>{while(ids.has('L'+serial))serial++;const id='L'+serial++;ids.add(id);return id;};
    for(const row of result)if(!row.lineId)row.lineId=allocate();
    for(const line of incoming)result.push({...copy(line),lineId:allocate()});
    if(result.length>500)throw Error('전표 품목은 500행까지 입력할 수 있습니다.');
    return result;
  }
  function stageDocuments(db,draft,options={}){
    if(!draft||!C.types[draft.type])throw Error('작성할 전표 종류를 선택하세요.');
    const mode=options.mode||'copy',selections=selectedRows(options.selections),result=copy(draft),replace=options.replace===true;
    if(!['copy','linked'].includes(mode))throw Error('전표 불러오기 방식을 확인하세요.');
    if(mode==='copy'&&result.sourceId)throw Error('연결 처리 중인 전표에는 복사 행을 섞을 수 없습니다.');
    const ids=[...new Set(selections.map(s=>s.documentId))];
    if(mode==='linked'&&ids.length!==1)throw Error('잔량 연결은 원본 전표 한 개씩 처리하세요.');
    if(mode==='linked'&&result.sourceId&&result.sourceId!==ids[0])throw Error('다른 원본 전표가 이미 연결되어 있습니다.');
    if(mode==='linked'&&!result.sourceId&&(result.lines||[]).length&&!replace)throw Error('잔량 연결은 기존 행을 비우거나 덮어쓰기를 선택한 뒤 적용하세요.');
    const sources=new Map(ids.map(id=>[id,sourceRecord(db,id)]));
    if(ids.includes(result.id))throw Error('작성 중인 전표를 자기 자신에게 불러올 수 없습니다.');
    if(options.adoptHeader===true){
      if(ids.length!==1)throw Error('머리 항목은 원본 전표 한 개에서만 적용할 수 있습니다.');
      if((result.lines||[]).length&&!replace)throw Error('머리 항목을 적용하려면 기존 행 덮어쓰기를 선택하세요.');
      const source=sources.get(ids[0]);for(const field of ['partner','warehouse','employee','project','currency','vatRate'])if(Object.hasOwn(source,field)&&!(mode==='linked'&&source.type==='transfer'&&result.type==='sale'&&field==='partner'))result[field]=copy(source[field]);
      if(mode==='linked')result.warehouse=C.linkedWarehouse(source,result.type);
      // An explicit default also overrides an earlier editor header when the source has no policy.
      result.taxRounding=C.taxRounding(source.taxRounding);result.supplyRounding=C.supplyRounding(source.supplyRounding);
    }
    const source=sources.get(ids[0]);
    if(mode==='linked'){
      if(!C.nextTypes[source.type]?.includes(result.type))throw Error('이 전표 종류는 잔량을 연결할 수 없습니다.');
      if(!(result.lines||[]).length){if(!result.partner&&!(source.type==='transfer'&&result.type==='sale'))result.partner=source.partner||'';if(!result.warehouse)result.warehouse=C.linkedWarehouse(source,result.type);}
      if(!C.linkedPartner(source,result.type,result.partner))throw Error('원본 전표와 거래처가 다릅니다.');
      if(!C.linkedWarehouseMatches(source,result.type,result.warehouse))throw Error('원본 전표와 창고가 다릅니다.');
      if(result.type==='exchangereceipt'){if(source.settlementMode!=='exchange')throw Error('교환 방식의 반품 전표를 선택하세요.');result.settlementMode='exchange';}
    }
    enabled(db,'warehouses',result.warehouse);if(result.partner)enabled(db,'partners',result.partner);
    const view=stockDb(db,{excludeId:result.id}),incoming=selections.map(selection=>{
      const d=sources.get(selection.documentId),matches=d.lines.filter(l=>l.item===selection.item&&(!selection.lineId||l.lineId===selection.lineId));if(matches.length>1)throw Error('동일 품목의 원본 라인을 선택하세요.');const line=matches[0];enabled(db,'items',selection.item);
      if(!line)throw Error('원본 전표에 없는 품목입니다.');
      if(mode==='linked'&&d.type==='plan'&&result.type==='purchaseorder'){
        if(C.purchasingLineState(d,line).progress==='완료')throw Error('완료된 발주계획 품목행은 발주서로 연결할 수 없습니다.');
        if(line.supplier&&line.supplier!==result.partner)throw Error('발주계획 품목행의 거래처와 발주서 거래처가 다릅니다.');
      }
      const limit=mode==='linked'?C.remaining(view,d,result.type).find(l=>line.lineId?l.lineId===line.lineId:l.item===selection.item).qty:line.qty;
      const qty=amount(selection.qty===undefined?limit:selection.qty);
      if(mode==='linked'&&qty>limit+0.000001)throw Error('원본 전표의 잔량을 초과했습니다.');
      const row=copy(line);delete row.supply;delete row.tax;delete row.total;
      if(result.type!=='plan')delete row.progress;
      // A new link refers to this source row, never to the source's own ancestor.
      if(mode==='linked'){if(line.lineId)row.sourceLineId=line.lineId;else delete row.sourceLineId;}else {delete row.lineId;delete row.sourceLineId;delete row.planAllocations;}
      return {...row,qty,importedFrom:[{documentId:d.id,type:d.type,date:d.date,item:line.item,...(line.lineId?{sourceLineId:line.lineId}:{}),qty,mode}]};
    });
    const orderLineCopy=mode==='copy'&&result.type==='request'&&options.grouping==='line'&&[...sources.values()].every(d=>d.type==='order');
    result.lines=orderLineCopy?appendRequestOrderLines(replace?[]:result.lines,incoming):mergeLines(replace?[]:result.lines,incoming,{type:result.type,structured:['item','document'].includes(options.grouping)&&mode==='copy'&&(!result.id||(result.lines||[]).every(l=>l.lineId))});
    if(mode==='linked'){
      const limits=new Map(C.remaining(view,source,result.type).map(l=>[l.lineId||l.item,l.qty]));
      for(const line of result.lines){const key=line.sourceLineId||line.item;if(!limits.has(key)||Number(line.qty)>limits.get(key)+0.000001)throw Error('원본 전표의 잔량을 초과하거나 원본에 없는 품목이 있습니다.');}
      result.sourceId=source.id;
      C.validatePlanOrderRows(db,result,source);
    }
    return result;
  }
  function stageStock(db,draft,options={}){
    if(!draft||!C.types[draft.type])throw Error('작성할 전표 종류를 선택하세요.');
    if(draft.sourceId)throw Error('연결 처리 중인 전표에는 재고 행을 섞을 수 없습니다.');
    const kind=options.kind||'stock';if(!['stock','safety'].includes(kind))throw Error('재고 불러오기 방식을 확인하세요.');
    if(options.asOf&&options.asOf!==draft.date)throw Error('조회한 기준일과 작성 중인 전표의 일자가 다릅니다.');
    const transferSafety=kind==='safety'&&draft.type==='transfer',warehouse=transferSafety?draft.targetWarehouse:draft.warehouse;
    if(transferSafety){enabled(db,'warehouses',draft.warehouse,'출발창고');enabled(db,'warehouses',warehouse,'안전재고 보충 도착창고');if(warehouse===draft.warehouse)throw Error('출발창고와 다른 보충 도착창고를 선택하세요.');}
    if(options.warehouse&&options.warehouse!==warehouse)throw Error(transferSafety?'조회한 창고와 보충 도착창고가 다릅니다.':'조회한 창고와 작성 중인 전표의 창고가 다릅니다.');
    const selections=selectedRows(options.selections),result=copy(draft),rows=stockCandidates(db,{warehouse,asOf:result.date,excludeId:result.id,includePending:options.includePending,safetyScope:options.safetyScope,onlyShortage:kind==='safety',includeZero:kind==='stock',partner:result.partner,targetType:result.type,vatRate:result.vatRate}),map=new Map(rows.map(row=>[row.item,row]));
    const incoming=selections.map(selection=>{
      const row=map.get(selection.item);if(!row)throw Error('사용 중인 재고 품목이나 안전재고 부족 품목을 선택하세요.');
      if(selection.warehouse&&selection.warehouse!==warehouse)throw Error(transferSafety?'조회한 창고와 보충 도착창고가 다릅니다.':'조회한 창고와 작성 중인 전표의 창고가 다릅니다.');
      const qty=amount(selection.qty===undefined?row.qty:selection.qty);
      return {item:row.item,qty,price:row.price,discount:0,importedFrom:[{kind,warehouse,...(transferSafety?{sourceWarehouse:result.warehouse}:{}),date:result.date,stock:row.stock,safety:row.safety,safetyScope:row.safetyScope,expected:row.expected,includePending:options.includePending!==false,qty}]};
    });
    result.lines=mergeLines(options.replace===true?[]:result.lines,incoming,{type:result.type});return result;
  }
  function safetyWarnings(db,draft){
    const action=draft.type==='consume'?'selfuse':draft.type;
    if(!['order','sale','issue','production','transfer','consume','defect'].includes(draft.type))return [];
    const rows=stockCandidates(db,{warehouse:draft.warehouse,asOf:draft.date,excludeId:draft.id,includeZero:true,includePending:false}),byItem=new Map(rows.map(row=>[row.item,row]));
    const warnings=[];
    for(const line of draft.lines||[]){
      const item=C.master(db,'items',line.item),row=byItem.get(line.item);if(!row||item.safetyActions&&!item.safetyActions.includes(action))continue;
      const delta=draft.type==='production'?Number(line.qty):-Number(line.qty),after=q(row.stock+delta);
      if(Number.isFinite(after)&&row.safety>0&&after<row.safety)warnings.push({...row,quantity:Number(line.qty),after,shortage:q(row.safety-after)});
    }
    return warnings;
  }
  const api={salesTypes,purchaseTypes,sourceTypes,documentCandidates,stockCandidates,stageDocuments,stageStock,safetyWarnings};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EntryCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
