const {test}=require('node:test'),assert=require('node:assert/strict');
const {previewStaticCandidate:preview}=require('../scripts/lib/transaction-vat-static-candidate.cjs');
const V=require('../dist/transaction-vat-core.js'),fixtures=require('./fixtures/transaction-vat-parity.json');
const clone=value=>JSON.parse(JSON.stringify(value));
const row=(id,price='909.09',qty='5',supply='4545',tax='455')=>({id,item:'SYNTHETIC',qty,price,supply,tax});
const input=(lines=[row('a'),row('b'),row('c')],extra={})=>({basis:'domestic-price',currency:'KRW',vatRate:10,digits:0,supplyMethod:'round',taxMethod:'round',lines,...extra});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const minor=value=>BigInt(value.replace('.',''));
test('manual example calculates independently while remaining research-only and input-pure',()=>{
 const data=freeze(input()),before=JSON.stringify(data),result=preview(data);
 assert.equal(JSON.stringify(data),before);
 assert.deepEqual(result.before,{supply:'13635',tax:'1365',total:'15000'});
 assert.deepEqual(result.after,{supply:'13636',tax:'1364',total:'15000'});
 assert.deepEqual(result.rows[2].after,{supply:'4546',tax:'454',total:'5000'});
 assert.equal(result.algorithm,'raw-supply-static-candidate-v0');assert.equal(result.persistenceVersion,null);
 assert.equal(result.canApply,false);assert.equal(result.originalRuntimeObserved,false);assert.equal(result.originalParityPassed,false);
});
test('all seven fixed static expectations are computed, including five differences from saved v1',()=>{
 let conflicts=0;
 for(const item of fixtures.cases){const base=V.preview(item.input);const d=input(item.input.lines.map((r,i)=>row(String(i),String(r.price),String(r.qty),String(base.rows[i].before.supply),String(base.rows[i].before.tax))),{vatRate:item.input.vatRate,digits:item.input.supplyRounding.digits,supplyMethod:item.input.supplyRounding.method,taxMethod:item.input.taxRounding.method});const result=preview(d),after=Object.fromEntries(Object.entries(result.after).map(([k,v])=>[k,Number(v)]));assert.deepEqual(after,item.staticRawSupplyInterpretation,item.id);if(JSON.stringify(after)!==JSON.stringify(base.after))conflicts++;}
 assert.equal(conflicts,5);
});
test('existing row amounts are explicit baselines, never recalculated from price',()=>{
 const a=preview(input([row('a','3.4','1','3','0'),row('b','3.4','1','3','0'),row('c','3.4','1','3','0')]));
 const b=preview(input([row('a','3.4','1','7','4'),row('b','3.4','1','8','5'),row('c','3.4','1','9','6')]));
 assert.deepEqual(a.after,{supply:'10',tax:'1',total:'11'});assert.deepEqual(a.after,b.after);assert.deepEqual(a.before,{supply:'9',tax:'0',total:'9'});assert.deepEqual(b.before,{supply:'24',tax:'15',total:'39'});assert.equal(a.grossChanged,true);assert.equal(b.negativeLastRow,true);
});
test('supply and VAT rounding use the same raw sum and independent methods',()=>{
 const result=preview(input([row('a','3.33','3','10','1')],{taxMethod:'floor'}));
 assert.deepEqual(result.after,{supply:'10',tax:'0',total:'10'}); // Tax from raw9.99, not rounded10.
 const result2=preview(input([row('a','3.33','3','9','1')],{supplyMethod:'floor',taxMethod:'ceil'}));
 assert.deepEqual(result2.after,{supply:'9',tax:'1',total:'10'});
});
test('decimal ties and tiny products stay exact before rounding',()=>{
 for(const [price,qty,expected] of [['0.05','0.1','0.01'],['0.049999','0.1','0.00'],['0.050001','0.1','0.01']])assert.equal(preview(input([row('a',price,qty,'0.00','0.00')],{digits:2})).after.supply,expected);
 const smallest=preview(input([row('a','0.000001','0.000001','0.00','0.00')],{digits:2,supplyMethod:'ceil',taxMethod:'ceil'}));
 assert.deepEqual(smallest.rawSupply,{numerator:'1',denominator:'1000000000000'});assert.deepEqual(smallest.after,{supply:'0.01',tax:'0.01',total:'0.02'});
});
test('last-row negative residual remains visible with no clamp or redistribution',()=>{
 const result=preview(input(['a','b','c','d'].map(id=>row(id,'5','1','5','1'))));
 assert.deepEqual(result.after,{supply:'20',tax:'2',total:'22'});assert.deepEqual(result.delta,{supply:'0',tax:'-2',total:'-2'});
 assert.equal(result.negativeLastRow,true);assert.equal(result.rows[3].after.tax,'-1');assert.equal(result.canApply,false);
 for(const r of result.rows.slice(0,3))assert.deepEqual(r.after,r.before);
});
test('row IDs, repeated items and ordering determine the residual recipient',()=>{
 const data=input(),a=preview(data);data.lines.reverse();const b=preview(data);
 assert.deepEqual(a.after,b.after);assert.equal(a.lastRowId,'c');assert.equal(b.lastRowId,'a');
 assert.deepEqual(a.rows.map(r=>r.id),['a','b','c']);assert.equal(a.rows.filter(r=>r.adjusted).length,1);
});
test('zero rate zeroes target VAT without hiding supplied baseline tax',()=>{
 const result=preview(input([row('a','0.49','1','0','1'),row('b','0.49','1','0','1'),row('c','0.49','1','0','1')],{vatRate:0}));
 assert.deepEqual(result.after,{supply:'1',tax:'0',total:'1'});assert.equal(result.before.tax,'3');assert.equal(result.rows[2].after.tax,'-2');assert.equal(result.negativeLastRow,true);
});
test('unmodeled fields and policies cannot silently enter the candidate',()=>{
 for(const change of [d=>d.currency='USD',d=>d.vatRate=7,d=>d.vatRate='10',d=>d.basis='direct',d=>d.digits=3,d=>d.digits=0.5,d=>d.taxMethod='truncate',d=>d.discount=0,d=>d.lines[0].discount=1,d=>d.lines[0].vatRate=0,d=>d.lines[0].vatAdjustment={},d=>delete d.lines[0].tax,d=>delete d.supplyMethod,d=>d.lines[0].price='0',d=>d.lines[0].qty='0',d=>d.lines[0].id=d.lines[1].id,d=>d.lines[0].item=' ',d=>d.lines[0].id=' ']){const d=input();change(d);assert.throws(()=>preview(d));}
 for(const lines of [[],new Array(3),[row('a'),undefined],[row('a'),null],Array.from({length:501},(_,i)=>row(String(i)))])assert.throws(()=>preview(input(lines)));
});
test('numbers, exponent strings and imprecise baseline amounts are rejected explicitly',()=>{
 for(const field of ['qty','price','supply','tax'])for(const value of [1,NaN,Infinity,null,true,'',' 1','1e-7','1.0000001','-1','01','+1','1.']){const d=input();d.lines[0][field]=value;assert.throws(()=>preview(d));}
 for(const digits of [0,1]){const d=input(undefined,{digits});d.lines[0].supply='1.01';assert.throws(()=>preview(d),/shared precision/);}
});
test('explicit research bounds cover row count, raw input, baseline and target separately',()=>{
 const many=preview(input(Array.from({length:500},(_,i)=>row(String(i),'1','1','1','0'))));assert.equal(many.after.supply,'500');
 const edge=preview(input([row('a','1000000000000','1','1000000000000','0')],{vatRate:0}));assert.equal(edge.after.total,'1000000000000');
 for(const d of [input([row('a','1000000000001')]),input([row('a','1000000000000','2','0','0')]),input([row('a','1','1','1000000000000','1')]),input([row('a','1000000000000','1','0','0')])])assert.throws(()=>preview(d),/bound/);
});
test('generated exact-cent cases conserve target totals, keep earlier rows and ignore row permutation for totals',()=>{
 let seed=73;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let k=0;k<180;k++){
  const digits=k%3,method=['round','floor','ceil'][k%3],taxMethod=['ceil','round','floor'][Math.floor(k/3)%3],rate=k%2?10:0;
  const rows=Array.from({length:2+random(9)},(_,i)=>row(String(i),(1+random(9999))/100+'',String(1+random(20)),'0','0'));
  const data=input(rows,{digits,supplyMethod:method,taxMethod,vatRate:rate}),a=preview(data),b=preview(input([...rows].reverse(),{digits,supplyMethod:method,taxMethod,vatRate:rate}));
  assert.deepEqual(a.after,b.after);assert.equal(a.negativeLastRow,false);
  for(const field of ['supply','tax','total'])assert.equal(a.rows.reduce((sum,r)=>sum+minor(r.after[field]),0n),minor(a.after[field]));
  assert.equal(minor(a.after.supply)+minor(a.after.tax),minor(a.after.total));for(const r of a.rows.slice(0,-1))assert.deepEqual(r.after,r.before);
 }
});
