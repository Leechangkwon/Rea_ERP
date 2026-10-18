(function(root){
 'use strict';
 const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
 const columns=Object.freeze(['품목코드','품목명[규격]','재고수량','금액(재고수량*입고단가)','입고단가']);
 const limitations=['자체 전표·기초재고로 계산한 결과입니다. 원본 서버의 재고평가 알고리즘과 동일함을 의미하지 않습니다.','금액은 품목에 등록한 입고단가 원값 × 재고수량입니다. 특별단가·VAT 역산·평균원가를 적용하지 않습니다.','선택 창고의 수량을 먼저 합산한 뒤 수량 범위와 안전재고 조건을 적용합니다.','안전재고는 창고 하나 선택 시 해당 창고 설정을 우선하고 전체·복수 창고는 품목 안전재고를 사용합니다. 이는 자체 정책입니다.','기본 조회에는 재고가 0인 등록 품목도 포함합니다. 원본의 기본 0재고 노출과 동등함은 미확인입니다.','재고수량관리 제외 품목을 포함해도 자체 재고 모델의 해당 품목 수량은 0입니다.'];
 function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('재고 기준일을 확인하세요.');return value;}
 function number(value,label,min=-1e12,max=1e12){if(typeof value==='boolean'||value===null||typeof value==='string'&&!value.trim())throw Error(label+' 값을 확인하세요.');const result=Number(value);if(!Number.isFinite(result)||result<min||result>max)throw Error(label+' 값을 확인하세요.');return result;}
 function bound(value,label){return value===undefined||value===null||value===''?undefined:number(value,label);}
 function selection(value,masters,label){if(value===undefined)return [];if(!Array.isArray(value)||value.length>10000||new Set(value).size!==value.length||value.some(code=>typeof code!=='string'||!masters.some(m=>m.code===code)))throw Error(label+' 선택을 확인하세요.');return [...value];}
 function flag(value,fallback,label){if(value===undefined)return fallback;if(typeof value!=='boolean')throw Error(label+' 값을 확인하세요.');return value;}
 function normalizeSorts(value){
  if(!Array.isArray(value)||value.length>3)throw Error('재고 정렬은 3개 기준까지 지정하세요.');const seen=new Set();
  return value.map(sort=>{if(!sort||typeof sort!=='object'||Array.isArray(sort))throw Error('재고 정렬을 확인하세요.');const column=sort.column==='name'||sort.column==='품목명'?'name':typeof sort.column==='string'?columns.indexOf(sort.column):sort.column??0,direction=sort.direction??'asc';if(column!=='name'&&(!Number.isInteger(column)||column<0||column>=columns.length)||!['asc','desc'].includes(direction))throw Error('재고 정렬을 확인하세요.');if(seen.has(column))throw Error('동일한 재고 정렬 기준을 중복 지정할 수 없습니다.');seen.add(column);return {column,direction};});
 }
 function query(db,filter={}){
  if(!db||!db.masters||!Array.isArray(db.documents)||!Array.isArray(db.opening)||!Array.isArray(db.masters.items)||!Array.isArray(db.masters.warehouses)||!filter||typeof filter!=='object'||Array.isArray(filter))throw Error('재고 조회 자료를 확인하세요.');
  const asOf=date(filter.asOf===undefined?C.today():filter.asOf),warehouses=selection(filter.warehouses,db.masters.warehouses,'창고'),items=selection(filter.items,db.masters.items,'품목'),includeNonStock=flag(filter.includeNonStock,false,'수량관리 제외 포함'),includeDisabled=flag(filter.includeDisabled,true,'사용중단 포함'),safetyBelow=flag(filter.safetyBelow,false,'안전재고 미만'),minQty=bound(filter.minQty,'최소 재고수량'),maxQty=bound(filter.maxQty,'최대 재고수량');
  if(minQty!==undefined&&maxQty!==undefined&&minQty>maxQty)throw Error('최소 수량은 최대 수량보다 클 수 없습니다.');
  const sorts=normalizeSorts(filter.sorts===undefined?[filter.sort===undefined?{column:0,direction:'asc'}:filter.sort]:filter.sorts);
  const quantities=new Map(),selectedWarehouses=new Set(warehouses),add=row=>{if((!row.date||row.date<=asOf)&&(!selectedWarehouses.size||selectedWarehouses.has(row.warehouse)))quantities.set(row.item,(quantities.get(row.item)||0)+Number(row.qty));};db.opening.forEach(add);C.movements(db).forEach(add);
  const records=[];for(const item of db.masters.items){if(!includeDisabled&&item.disabled||!includeNonStock&&item.trackInventory===false||items.length&&!items.includes(item.code))continue;
   // Same opening + active movement basis as InventoryCore.stock, aggregated once before filters; nonstock stays 0.
   const quantity=item.trackInventory===false?0:C.quantity(quantities.get(item.code)||0),cost=number(item.buyPrice??0,'등록 입고단가',0),amount=C.money(quantity*cost),override=warehouses.length===1?(item.warehouseSafety||[]).find(row=>row.warehouse===warehouses[0]):undefined,safety=number(override?override.qty:item.safety??0,'안전재고',0),belowSafety=quantity<safety;
   if(minQty!==undefined&&quantity<minQty||maxQty!==undefined&&quantity>maxQty||safetyBelow&&!belowSafety)continue;
   const name=item.name||item.code,spec=item.spec||'';records.push({item:item.code,name,spec,nameSpec:name+(spec?' ['+spec+']':''),quantity,cost,amount,safety,belowSafety,disabled:item.disabled===true,nonStock:item.trackInventory===false});
  }
  const values=record=>[record.item,record.nameSpec,record.quantity,record.amount,record.cost],compare=(a,b)=>{for(const {column,direction}of sorts){const x=column==='name'?a.name:values(a)[column],y=column==='name'?b.name:values(b)[column],difference=(typeof x==='number'?x-y:String(x).localeCompare(String(y),'ko-KR',{numeric:true}))*(direction==='desc'?-1:1);if(difference)return difference;}return String(a.item).localeCompare(String(b.item),'ko-KR',{numeric:true});};records.sort(compare);
  return {columns:[...columns],rows:records.map(values),records,summary:{items:records.length,quantity:C.quantity(records.reduce((sum,r)=>sum+r.quantity,0)),amount:C.money(records.reduce((sum,r)=>sum+r.amount,0))},filter:{asOf,warehouses,items,includeNonStock,includeDisabled,safetyBelow,minQty,maxQty,sort:sorts[0]||{column:0,direction:'asc'},sorts},limitations:[...limitations]};
 }
 function ledger(db,filter={}){
  if(!filter||typeof filter!=='object'||Array.isArray(filter)||typeof filter.item!=='string'||!filter.item)throw Error('수불내역 품목을 선택하세요.');
  const report=query(db,{asOf:filter.asOf,warehouses:filter.warehouses,items:[filter.item],includeDisabled:true,includeNonStock:true}),asOf=report.filter.asOf,warehouses=report.filter.warehouses,item=report.records[0],ledgerColumns=['일자','전표번호','구분','창고','입고','출고','잔량'];
  const caveats=['자체 기초재고와 전표로 만든 수불내역입니다. 원본 ESZ003R 화면·서버 결과와의 동등성은 미확인입니다.','창고 복수 선택 시 선택 창고 전체의 합산 잔량을 표시합니다.'];
  if(item.nonStock)return {columns:ledgerColumns,rows:[],records:[],endingQuantity:0,item:filter.item,asOf,warehouses:[...warehouses],limitations:caveats};
  const whSet=new Set(warehouses),included=row=>(!row.date||row.date<=asOf)&&(!whSet.size||whSet.has(row.warehouse)),events=[];
  db.opening.forEach((row,index)=>{if(row.item===filter.item&&included(row))events.push({date:row.date||'',documentId:'',type:'opening',warehouse:row.warehouse,qty:Number(row.qty),opening:true,index});});
  C.movements(db).forEach((row,index)=>{if(row.item===filter.item&&included(row))events.push({date:row.date,documentId:row.id,type:row.type,warehouse:row.warehouse,qty:Number(row.qty),opening:false,index});});
  events.sort((a,b)=>a.date.localeCompare(b.date)||(a.opening===b.opening?0:a.opening?-1:1)||a.documentId.localeCompare(b.documentId)||a.index-b.index);
  let balance=0;const records=events.map(event=>{if(!Number.isFinite(event.qty))throw Error('수불 수량을 확인하세요.');balance+=event.qty;const quantity=C.quantity(balance);return {date:event.date,documentId:event.documentId,type:event.type,warehouse:event.warehouse,warehouseName:C.master(db,'warehouses',event.warehouse)?.name||event.warehouse,label:event.opening?'기초재고':C.types[event.type]||event.type,incoming:event.qty>0?event.qty:0,outgoing:event.qty<0?-event.qty:0,balance:quantity};});
  const endingQuantity=C.quantity(balance);if(endingQuantity!==item.quantity)throw Error('조회 재고와 수불 잔량을 다시 확인하세요.');return {columns:ledgerColumns,rows:records.map(row=>[row.date,row.documentId,row.label,row.warehouseName,row.incoming,row.outgoing,row.balance]),records,endingQuantity,item:filter.item,asOf,warehouses:[...warehouses],limitations:caveats};
 }
 const api={query,ledger,columns,normalizeSorts};if(typeof module==='object'&&module.exports)module.exports=api;else root.StockReportCore=api;
})(typeof globalThis==='object'?globalThis:this);
