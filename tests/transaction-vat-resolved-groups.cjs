"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {previewResolvedGroups:preview,previewStaticCandidate:single}=require('../scripts/lib/transaction-vat-static-candidate.cjs');
const row=(id,rate=10,price='3.4',supply='3',tax='0')=>({id,item:'same-item',qty:'1',price,supply,tax,vatRate:rate});
const input=lines=>({basis:'domestic-price',currency:'KRW',digits:0,supplyMethod:'round',taxMethod:'round',lines});
const mixed=()=>input([row('a'),row('b',0,'0.49','0'),row('c'),row('d',0,'0.49','0'),row('e'),row('f',0,'0.49','0')]);
test('interleaved rates retain source order and choose each final matching row',()=>{
 const x=preview(mixed());
 assert.deepEqual(x.rows.map(r=>r.id),['a','b','c','d','e','f']);
 assert.deepEqual(x.groups.map(g=>[g.vatRate,g.indexes,g.lastIndex,g.lastRowId]),[[10,[0,2,4],4,'e'],[0,[1,3,5],5,'f']]);
 assert.deepEqual(x.rows.filter(r=>r.adjusted).map(r=>r.id),['e','f']);
 assert.deepEqual(x.before,{supply:'9',tax:'0',total:'9'});assert.deepEqual(x.after,{supply:'11',tax:'1',total:'12'});
 assert.deepEqual(x.rows[4].after,{supply:'4',tax:'1',total:'5'});assert.deepEqual(x.rows[5].after,{supply:'1',tax:'0',total:'1'});
});
test('original manual example is allocated within its rate group despite trailing zero-rate row',()=>{
 const lines=['a','b','c'].map(id=>({...row(id,10,'909.09','4545','455'),qty:'5'}));lines.splice(1,0,row('z',0,'100','100'));lines.push(row('zz',0,'100','100'));
 const x=preview(input(lines));assert.deepEqual(x.groups[0].after,{supply:'13636',tax:'1364',total:'15000'});
 assert.equal(x.groups[0].lastIndex,3);assert.deepEqual(x.rows[3].after,{supply:'4546',tax:'454',total:'5000'});assert.deepEqual(x.rows.filter(r=>r.adjusted).map(r=>r.id),['c']);
});
test('same gross with changed supply/tax still requires confirmation',()=>{
 const x=preview(input(['a','b','c'].map(id=>({...row(id,10,'909.09','4545','455'),qty:'5'}))));
 assert.equal(x.grossChanged,false);assert.equal(x.requiresConfirmation,true);assert.equal(x.delta.supply,'1');assert.equal(x.delta.tax,'-1');
});
test('unchanged group remains untouched and no difference needs no confirmation',()=>{
 const x=preview(input([row('a',10,'100','100','10'),row('z',0,'100','100')]));
 assert.equal(x.requiresConfirmation,false);assert.equal(x.rows.some(r=>r.adjusted),false);assert.deepEqual(x.before,x.after);
});
test('reordering changes only group target identities, not target totals',()=>{
 const a=mixed(),b={...a,lines:[...a.lines].reverse()},x=preview(a),y=preview(b);
 assert.deepEqual(x.after,y.after);assert.deepEqual(y.groups.map(g=>[g.vatRate,g.lastRowId]),[[0,'b'],[10,'a']]);assert.deepEqual(y.rows.map(r=>r.id),b.lines.map(r=>r.id));
});
test('negative last-row diagnosis does not alter another group or hide a deficit',()=>{
 const x=preview(input([row('a',10,'0.01','0','1'),row('z',0,'100','100'),row('b',10,'0.01','0','0')]));
 assert.equal(x.negativeLastRow,true);assert.equal(x.rows[2].after.tax,'-1');assert.equal(x.rows[1].adjusted,false);assert.equal(x.canApply,false);
});
test('reject duplicate global IDs including across rates and preserve frozen input',()=>{
 const value=mixed();value.lines.forEach(Object.freeze);Object.freeze(value.lines);Object.freeze(value);const old=JSON.stringify(value);preview(value);assert.equal(JSON.stringify(value),old);
 assert.throws(()=>preview(input([row('same'),row('same',0)])),/unique/);
});
test('reject sparse input and invalid late group atomically',()=>{
 const value=mixed(),old=JSON.stringify(value);value.lines.push({...row('bad',0),price:'-1'});const invalid=JSON.stringify(value);assert.throws(()=>preview(value));assert.equal(JSON.stringify(value),invalid);
 for(const lines of [new Array(2),[row('a'),,row('b')]])assert.throws(()=>preview(input(lines)));
 assert.equal(JSON.stringify(mixed()),old);
});
test('bound applies across groups, not only per group',()=>{
 assert.throws(()=>preview(input([row('a',0,'600000000000','600000000000'),row('b',10,'600000000000','600000000000','0')])),/aggregate/);
 const x=preview(input([row('a',0,'500000000000','500000000000'),row('b',10,'400000000000','400000000000','40000000000')]));assert.equal(x.after.total,'940000000000');
 assert.equal(preview(input(Array.from({length:500},(_,i)=>row('r'+i,i%2?10:0,'1','1')))).rows.length,500);
 assert.throws(()=>preview(input(Array.from({length:501},(_,i)=>row('r'+i)))),/500/);
});
test('supported decimals and independent per-group previews agree',()=>{
 const value={...mixed(),digits:2,lines:[row('a',10,'0.05','0.05','0.01'),row('z',0,'0.05','0.05','0.00'),row('b',10,'0.05','0.05','0.01'),row('c',10,'0.05','0.05','0.01')]};const x=preview(value);
 for(const g of x.groups){const {lines,...header}=value;const expected=single({...header,vatRate:g.vatRate,lines:lines.filter(r=>r.vatRate===g.vatRate).map(({vatRate,...r})=>r)});assert.deepEqual(g.after,expected.after);assert.deepEqual(g.delta,expected.delta);}
 assert.equal(x.after.total,'0.22');assert.equal(x.rows[3].after.tax,'0.00');
});
test('unknown rate, extra fields, empty input and malformed policy are rejected',()=>{
 for(const v of [input([]),{...mixed(),warehouse:'a'},{...mixed(),digits:3},{...mixed(),supplyMethod:'bankers'},input([{...row('a'),vatRate:'10'}]),input([row('a',7)]),input([{...row('a'),extra:true}])])assert.throws(()=>preview(v));
});
test('research flags never claim rate resolution, persistence or parity',()=>{
 const x=preview(mixed());assert.equal(x.canApply,false);assert.equal(x.persistenceVersion,null);assert.equal(x.originalRuntimeObserved,false);assert.equal(x.originalParityPassed,false);assert.equal(x.rateResolutionVerified,false);assert.equal(x.algorithm,'resolved-rate-groups-static-v0');
});

test('offsetting group changes still require confirmation when every grand amount is unchanged',()=>{
 const x=preview(input([row('a',10,'4','3','0'),row('z',0,'1','2','0')]));assert.deepEqual(x.before,x.after);assert.equal(x.requiresConfirmation,true);assert.deepEqual(x.groups.map(g=>g.delta.supply),['1','-1']);assert.deepEqual(x.rows.filter(r=>r.adjusted).map(r=>r.id),['a','z']);
});
