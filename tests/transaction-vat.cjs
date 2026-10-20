const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../dist/transaction-vat-core.js'),C=require('../dist/inventory-core.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function document(extra={}){return {type:'request',date:'2026-10-21',warehouse:'W001',currency:'KRW',vatRate:10,supplyRounding:{method:'round',digits:0},lines:[1,2,3].map(n=>({lineId:'L'+n,item:'A',qty:5,price:909.09,discount:0,memo:'행 '+n})),...extra};}
function freeze(value){Object.values(value).filter(v=>v&&typeof v==='object').forEach(freeze);return Object.freeze(value);}
const cents=n=>Math.round(n*100);
test('manual example: total preserved and difference belongs only to the last row',()=>{
 const input=freeze(document()),p=V.preview(input);
 assert.deepEqual(p.before,{supply:13635,tax:1365,total:15000});assert.deepEqual(p.after,{supply:13636,tax:1364,total:15000});
 assert.deepEqual(p.delta,{supply:1,tax:-1,total:0});assert.equal(p.lastIndex,2);assert.equal(p.hasDifference,true);
 assert.deepEqual(p.rows.slice(0,2).map(r=>r.after),p.rows.slice(0,2).map(r=>r.before));assert.deepEqual(p.rows[2].after,{supply:4546,tax:454,total:5000});
 assert.deepEqual(p.rows.map(r=>r.adjusted),[false,false,true]);assert.deepEqual(V.verify(input,p),p);
 assert.deepEqual(V.preview(input),p);assert.equal(input.lines[2].price,909.09);assert.equal(input.lines[2].supply,undefined);
});
test('legacy supply precision remains two decimals unless explicitly selected',()=>{
 const input=document();delete input.supplyRounding;const before=clone(input),baseline=C.totals(input),p=V.preview(input);
 assert.deepEqual(p.before,{supply:baseline.supply,tax:baseline.tax,total:baseline.total});assert.deepEqual(p.before,{supply:13636.35,tax:1365,total:15001.35});
 assert.deepEqual(p.after,{supply:13637.59,tax:1363.76,total:15001.35});assert.deepEqual(input,before);
 assert.deepEqual(C.totals(input),baseline);assert.equal(Object.hasOwn(input,'vatAdjustment'),false);
});
test('round/floor/ceil and each supported supply precision retain the gross total',()=>{
 for(const method of ['round','floor','ceil'])for(const digits of [0,1,2]){
  const input=document({supplyRounding:{method,digits}}),p=V.preview(input),exact=p.before.total/1.1,expected=Math[method](exact*10**digits)/10**digits;
  assert.equal(p.after.supply,expected,method+'/'+digits);assert.equal(cents(p.after.supply)+cents(p.after.tax),cents(p.before.total));
 }
});
test('integer ratio rounding is stable at an exact half cent',()=>{
 const p=V.preview(document({vatRate:100,supplyRounding:{method:'round',digits:2},lines:[{item:'A',qty:1,price:1.01}]}));
 assert.deepEqual(p.before,{supply:1.01,tax:1,total:2.01});assert.deepEqual(p.after,p.before);assert.equal(p.hasDifference,false);
});
test('line VAT rounding policy is retained, not silently replaced by the transaction split',()=>{
 for(const method of ['round','floor','ceil'])for(const digits of [0,1,2]){
  const input=document({taxRounding:{method,digits}}),p=V.preview(input),old=C.totals(input);
  assert.deepEqual(p.before,{supply:old.supply,tax:old.tax,total:old.total});assert.equal(p.after.total,old.total);
 }
});
test('zero rate, zero price and a single row have explicit no-difference results',()=>{
 for(const input of [document({vatRate:0}),document({lines:[{item:'A',qty:1,price:0}]}),document({lines:[{item:'A',qty:1,price:100}]})]){
  const p=V.preview(input);assert.deepEqual(p.before,p.after);assert.equal(p.hasDifference,false);assert.ok(p.rows.every(r=>!r.adjusted));
 }
});
test('fractional rate, decimal quantities and discounts use existing line amounts',()=>{
 const input=document({vatRate:7.5,supplyRounding:{method:'round',digits:2},lines:[{item:'A',qty:2.25,price:11.79,discount:13.25},{item:'B',qty:3.125,price:71.33,discount:0}]}),p=V.preview(input),old=C.totals(input);
 assert.deepEqual(p.before,{supply:old.supply,tax:old.tax,total:old.total});assert.equal(p.after.total,old.total);
 assert.equal(cents(p.after.supply),Math.round(p.before.total/1.075*100));
});
test('calculation and document changes invalidate an earlier preview',()=>{
 const input=document(),p=V.preview(input);
 const changes=[d=>d.lines[0].qty++,d=>d.lines[0].price++,d=>d.lines[0].discount++,d=>d.vatRate=11,d=>d.taxRounding={method:'floor',digits:0},d=>d.supplyRounding={method:'ceil',digits:0},d=>d.lines.reverse(),d=>d.lines.pop(),d=>d.lines.push({...d.lines[0],lineId:'L4'}),d=>d.lines[2].lineId='LAST',d=>d.lines[2].item='B',d=>d.partner='NEW',d=>d.id='OTHER',d=>d.date='2026-10-22',d=>d.lines[0].memo='changed'];
 for(const change of changes){const next=clone(input);change(next);assert.throws(()=>V.verify(next,p),/다시 확인/);}
});
test('identical legacy lines without IDs still bind memo, metadata and row order',()=>{
 const input=document();input.lines.forEach(row=>delete row.lineId);const p=V.preview(input),changed=clone(input);changed.lines.reverse();assert.throws(()=>V.verify(changed,p),/다시 확인/);
 changed.lines.reverse();changed.lines[2].importedFrom=[{documentId:'SOURCE',qty:5}];assert.throws(()=>V.verify(changed,p),/다시 확인/);
});
test('numeric form strings and key order are canonical; computed row caches never compound',()=>{
 const input=document(),p=V.preview(input),converted=clone(input);converted.vatRate='10';converted.lines=converted.lines.map(row=>({memo:row.memo,discount:'0',price:'909.09',qty:'5',item:row.item,lineId:row.lineId,supply:99999,tax:999,total:888888,_new:true}));
 assert.deepEqual(V.verify(converted,p),p);assert.deepEqual(V.preview(converted),p);
});
test('same snapshot does not authorize altered targets, deltas, row indices or extra fields',()=>{
 const input=document(),p=V.preview(input),changes=[v=>v.after.tax++,v=>v.delta.supply++,v=>v.lastIndex=0,v=>v.rows[0].after.supply++,v=>v.rows[2].adjusted=false,v=>v.hasDifference=false,v=>v.scope='saved',v=>v.version=2,v=>v.saved=true];
 for(const change of changes){const next=clone(p);change(next);assert.throws(()=>V.verify(input,next),/근거가 다릅니다/);}
 assert.throws(()=>V.verify(input,null),/다시 확인/);
});
test('foreign currency, mixed rates and returns are not represented as supported',()=>{
 assert.throws(()=>V.preview(document({currency:'USD'})),/외화/);
 const mixed=document();mixed.lines[1].vatRate=0;assert.throws(()=>V.preview(mixed),/혼합/);
 for(const type of ['purchasereturn','exchangereceipt','adjust','production'])assert.throws(()=>V.preview(document({type})),/대상 전표/);
 const matching=document();matching.lines[0].vatRate='10';assert.equal(V.preview(matching).after.total,15000);
});
test('pre-existing allocation or adjustment evidence is never discarded',()=>{
 assert.throws(()=>V.preview(document({vatAdjustment:{version:1}})),/기존 부가세/);
 for(const key of ['returnAmounts','vatAdjustment']){const input=document();input.lines[1][key]={supply:1,tax:0,total:1};assert.throws(()=>V.preview(input),/배분·조정/);}
});
test('last-row underflow is reported instead of inventing a different allocation rule',()=>{
 const input=document();input.lines.push({item:'FREE',lineId:'L4',qty:1,price:0});assert.throws(()=>V.preview(input),/마지막 품목행.*음수/);
});
test('empty/oversized lines, invalid identities, numbers and policies fail without mutation',()=>{
 for(const lines of [[],Array.from({length:501},()=>({item:'A',qty:1,price:1})),[{item:'',qty:1,price:1}]])assert.throws(()=>V.preview(document({lines})),/1~500|빈 품목행/);
 for(const [field,values]of [['qty',[0,-1,NaN,Infinity,' ',true,null,1e13]],['price',[-1,NaN,Infinity,' ',true,1e13]],['discount',[-1,101,NaN,Infinity,' ',true]]])for(const value of values){const input=document();input.lines[0][field]=value;assert.throws(()=>V.preview(input),/수량|단가|할인율/);}
 for(const vatRate of [-1,101,Infinity,' ',true,0.0000001])assert.throws(()=>V.preview(document({vatRate})),/부가세율/);
 assert.throws(()=>V.preview(document({supplyRounding:{method:'round',digits:3}})),/공급가액/);
 assert.throws(()=>V.preview(document({taxRounding:{method:'none',digits:0}})),/부가세 반올림/);
 const duplicate=document();duplicate.lines[1].lineId='L1';assert.throws(()=>V.preview(duplicate),/중복/);
});
test('maximum aggregate and multiplication precision are bounded before preview is accepted',()=>{
 const atLimit=document({vatRate:0,lines:[{item:'A',qty:1,price:1e12}]});assert.equal(V.preview(atLimit).after.total,1e12);
 assert.throws(()=>V.preview(document({vatRate:0,lines:[{item:'A',qty:1e12,price:1e12}]})),/1조/);
 assert.throws(()=>V.preview(document({vatRate:0,lines:[{item:'A',qty:1,price:1e12},{item:'B',qty:1,price:1}]})),/합계.*1조/);
});
test('all five purchase types and the manual quotation example share the same pure contract',()=>{
 for(const type of ['request','plan','pricerequest','purchaseorder','purchase','quote'])assert.deepEqual(V.preview(document({type})).after,{supply:13636,tax:1364,total:15000});
});
test('deterministic generated cases preserve every line gross and total with one adjustment at most',()=>{
 let seed=211021,checked=0,rejected=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<1500;i++){
  const input=document({vatRate:[0,5,7.5,10,20,100][rand()%6],supplyRounding:{method:['round','floor','ceil'][rand()%3],digits:rand()%3},taxRounding:{method:['round','floor','ceil'][rand()%3],digits:rand()%3},lines:Array.from({length:1+rand()%12},(_,n)=>({item:'A'+n,qty:(1+rand()%500)/10,price:(1+rand()%100000)/100,discount:rand()%50}))});
  let p;try{p=V.preview(input);}catch(e){assert.match(e.message,/마지막 품목행.*음수/);rejected++;continue;}
  assert.equal(cents(p.before.total),cents(p.after.total));assert.equal(cents(p.after.supply)+cents(p.after.tax),cents(p.after.total));assert.equal(cents(p.delta.supply)+cents(p.delta.tax),0);
  assert.equal(p.rows.reduce((s,r)=>s+cents(r.after.supply),0),cents(p.after.supply));assert.equal(p.rows.reduce((s,r)=>s+cents(r.after.tax),0),cents(p.after.tax));
  for(const r of p.rows){assert.equal(r.before.total,r.after.total);assert.equal(cents(r.after.supply)+cents(r.after.tax),cents(r.after.total));if(r.index!==p.lastIndex)assert.deepEqual(r.after,r.before);}
  assert.ok(p.rows.filter(r=>r.adjusted).length<=1);assert.deepEqual(V.verify(input,p),p);checked++;
 }
 assert.ok(checked>1400);assert.equal(checked+rejected,1500);
});

test('sparse first, middle, last and all-empty slots cannot silently disappear',()=>{
 for(const index of [0,1,2]){const input=document();delete input.lines[index];assert.throws(()=>V.preview(input),/빈 품목행/);}
 assert.throws(()=>V.preview(document({lines:new Array(3)})),/빈 품목행/);
});
test('five hundred rows and six-decimal tax rates remain within exact aggregate limits',()=>{
 const input=document({vatRate:0,lines:Array.from({length:500},(_,i)=>({lineId:'L'+i,item:'A',qty:1,price:2e9}))});
 assert.equal(V.preview(input).after.total,1e12);
 for(const vatRate of [0.000001,99.999999]){const p=V.preview(document({vatRate,lines:[{item:'A',qty:1,price:1e9}]}));assert.equal(cents(p.after.supply)+cents(p.after.tax),cents(p.before.total));}
});
test('browser export can be evaluated without storage or DOM side effects',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),window={InventoryCore:C};vm.runInNewContext(fs.readFileSync(require.resolve('../dist/transaction-vat-core.js'),'utf8'),{window});
 assert.deepEqual(JSON.parse(JSON.stringify(window.TransactionVatCore.preview(document()))),V.preview(document()));assert.deepEqual(Object.keys(window).sort(),['InventoryCore','TransactionVatCore']);
});
