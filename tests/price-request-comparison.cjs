"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const Q=require('../scripts/lib/price-request-comparison.cjs'),C=require('../dist/inventory-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const request=()=>({id:'PR-1',type:'pricerequest',date:'2026-10-21',partner:'V001',warehouse:'W001',currency:'KRW',memo:'legacy voucher',lines:[{lineId:'A',item:'M001',qty:100,price:50000}]});
const apply=(state,doc,input)=>Q.command(state,doc,{expectedRevision:state.revision,...input});
const reply=(state,doc,vendor,price,key='id:A')=>apply(state,doc,{type:'reply',vendorCode:vendor,lineKey:key,price});
const select=(state,doc,vendor,key='id:A')=>apply(state,doc,{type:'select',lineKey:key,source:vendor===null?'request':'vendor',vendorCode:vendor});
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;}

test('official recorded example keeps request 50000, replies 30000/25000 and explicitly confirmed 25000 separate',()=>{
 const doc=request(),original=clone(doc),initial=Q.create(doc,['V001','V002']);let s=reply(initial,doc,'V001',30000);s=reply(s,doc,'V002',25000);
 assert.equal(Q.comparison(s,doc)[0].confirmed,null);s=select(s,doc,'V002');
 assert.deepEqual(Q.comparison(s,doc),[{lineKey:'id:A',item:'M001',qty:'100',requestedPrice:'50000',received:[{vendorCode:'V001',price:'30000',inputClosed:false},{vendorCode:'V002',price:'25000',inputClosed:false}],confirmed:{lineKey:'id:A',source:'vendor',vendorCode:'V002',price:'25000'}}]);
 assert.deepEqual(doc,original);assert.equal(initial.revision,0);assert.deepEqual(initial.vendors.map(v=>v.received[0].price),[null,null]);
});
test('one through five vendors accepted; none, six and duplicate vendors rejected',()=>{
 const doc=request();for(let n=1;n<=5;n++)assert.equal(Q.create(doc,Array.from({length:n},(_,i)=>'V'+i)).vendors.length,n);
 for(const codes of [[],['A','B','C','D','E','F'],['A','A'],[''],[' A'],[null]])assert.throws(()=>Q.create(doc,codes));
});
test('no response and an explicit zero price have different comparison and selection semantics',()=>{
 const doc=request(),s=Q.create(doc,['V1']);assert.throws(()=>select(s,doc,'V1'),/회신/);const zero=reply(s,doc,'V1',0),selected=select(zero,doc,'V1');assert.equal(Q.comparison(selected,doc)[0].confirmed.price,'0');
 const cleared=apply(selected,doc,{type:'clear-selection',lineKey:'id:A'}),missing=reply(cleared,doc,'V1',null);assert.equal(Q.comparison(missing,doc)[0].received[0].price,null);assert.throws(()=>select(missing,doc,'V1'),/회신/);
});
test('request-price radio is explicit and not overridden by a lower reply',()=>{
 const doc=request();let s=select(Q.create(doc,['V1']),doc,null);s=reply(s,doc,'V1','1');assert.equal(Q.comparison(s,doc)[0].confirmed.price,'50000');assert.equal(Q.comparison(s,doc)[0].confirmed.source,'request');
});
test('closing and reopening vendor input preserve all replies and selected prices',()=>{
 const doc=request();let s=select(reply(Q.create(doc,['V1','V2']),doc,'V1','30'),doc,'V1');const before=clone(s);s=apply(s,doc,{type:'close',vendorCode:'V1',closed:true});assert.throws(()=>reply(s,doc,'V1','30'),/마감/);assert.throws(()=>reply(s,doc,'V1',null),/마감/);s=apply(s,doc,{type:'close',vendorCode:'V1',closed:false});assert.deepEqual(s.vendors,before.vendors);assert.deepEqual(s.selections,before.selections);
});
test('a confirmed supplier reply cannot change or clear until its selection is explicitly released',()=>{
 const doc=request();let s=select(reply(Q.create(doc,['V1']),doc,'V1','30'),doc,'V1');const before=clone(s);
 for(const price of ['31',null])assert.throws(()=>reply(s,doc,'V1',price),/선택을 먼저 해제/);assert.deepEqual(s,before);
 s=reply(s,doc,'V1','30.000');assert.equal(s.selections[0].price,'30');s=apply(s,doc,{type:'clear-selection',lineKey:'id:A'});s=reply(s,doc,'V1','31');assert.equal(s.vendors[0].received[0].price,'31');assert.deepEqual(s.selections,[]);
});
test('another supplier reply may change while a confirmed supplier remains unchanged',()=>{
 const doc=request();let s=select(reply(Q.create(doc,['V1','V2']),doc,'V1','30'),doc,'V1');s=reply(s,doc,'V2','10');assert.equal(s.selections[0].vendorCode,'V1');s=select(s,doc,'V2');s=reply(s,doc,'V1','20');assert.equal(s.selections[0].price,'10');
});
test('repeated items with line IDs retain distinct reply and confirmed prices',()=>{
 const doc=request();doc.lines.push({...doc.lines[0],lineId:'B',qty:2});let s=Q.create(doc,['V1']);s=reply(s,doc,'V1','11');s=reply(s,doc,'V1','22','id:B');s=select(s,doc,'V1','id:B');s=select(s,doc,'V1');assert.deepEqual(Q.comparison(s,doc).map(r=>r.confirmed.price),['11','22']);assert.deepEqual(s.selections.map(r=>r.lineKey),['id:A','id:B']);
});
test('legacy rows without IDs use positions without changing old documents, and reordering invalidates them',()=>{
 const doc=request();delete doc.lines[0].lineId;doc.lines.push({item:'M001',qty:2,price:9});const before=clone(doc);let s=Q.create(doc,['V1']);s=reply(s,doc,'V1','3','row:1');assert.deepEqual(s.source.lines.map(r=>r.lineKey),['row:0','row:1']);assert.equal(Q.comparison(s,doc)[1].received[0].price,'3');assert.deepEqual(doc,before);const reordered=clone(doc);reordered.lines.reverse();assert.throws(()=>Q.validate(s,reordered),/原本|원본/);
});
test('source changes to price, quantity, item, header, memo and line order are detected without rewriting state',()=>{
 const doc=request();doc.lines.push({lineId:'B',item:'S001',qty:2,price:5});const s=Q.create(doc,['V1']),before=clone(s);
 const changes=[d=>d.lines[0].price++,d=>d.lines[0].qty++,d=>d.lines[0].item='P001',d=>d.currency='USD',d=>d.memo='changed',d=>d.lines.reverse()];
 for(const change of changes){const d=clone(doc);change(d);assert.throws(()=>Q.comparison(s,d),/원본/);}assert.deepEqual(s,before);
});
test('source fingerprint is invariant under object key order, but not extra source fields',()=>{
 const doc=request(),s=Q.create(doc,['V1']);const reordered=Object.fromEntries(Object.entries(doc).reverse());reordered.lines=doc.lines.map(row=>Object.fromEntries(Object.entries(row).reverse()));assert.equal(Q.validate(s,reordered),true);assert.throws(()=>Q.validate(s,{...doc,extra:'new'}),/원본/);
});
test('stale revisions and unknown operations or fields cannot mutate a saved state',()=>{
 const doc=request(),s=Q.create(doc,['V1']),next=reply(s,doc,'V1',1),before=clone(next);
 for(const expectedRevision of [0,'1',null,-1,1.5])assert.throws(()=>Q.command(next,doc,{type:'close',expectedRevision,vendorCode:'V1',closed:true}),/수정번호/);
 assert.throws(()=>Q.command(next,doc,{type:'reset',expectedRevision:1}));assert.throws(()=>Q.command(next,doc,{type:'close',expectedRevision:1,vendorCode:'V1',closed:true,extra:true}));assert.deepEqual(next,before);
});
test('unknown vendors, row IDs and invalid selection kinds are rejected',()=>{
 const doc=request(),s=Q.create(doc,['V1']);assert.throws(()=>reply(s,doc,'missing',1));assert.throws(()=>reply(s,doc,'V1',1,'missing'));assert.throws(()=>apply(s,doc,{type:'clear-selection',lineKey:'missing'}));assert.throws(()=>apply(s,doc,{type:'select',lineKey:'id:A',source:'minimum',vendorCode:null}));assert.throws(()=>apply(s,doc,{type:'select',lineKey:'id:A',source:'request',vendorCode:'V1'}));assert.throws(()=>apply(s,doc,{type:'close',vendorCode:'V1',closed:'true'}));
});
test('decimal prices are retained exactly with no rounding or conversion of blank to zero',()=>{
 const doc=request(),s=Q.create(doc,['V1']);for(const [value,want] of [['999999999999.1234567891','999999999999.1234567891'],['00030.250000','30.25'],[1e-7,'0.0000001'],['1000000000000','1000000000000']])assert.equal(reply(s,doc,'V1',value).vendors[0].received[0].price,want);
 for(const bad of ['', ' ',false,true,{},[],NaN,Infinity,-1,'-1','1e2','0.00000000001','1000000000000.0000000001','1,000'])assert.throws(()=>reply(s,doc,'V1',bad));
});
test('invalid requests, duplicate IDs, zero quantities and excess precision are refused locally',()=>{
 const doc=request();assert.throws(()=>Q.create({...doc,type:'purchaseorder'},['V1']));assert.throws(()=>Q.create({...doc,id:''},['V1']));
 for(const lines of [[],[{...doc.lines[0],qty:0}],[{...doc.lines[0],qty:'0.0000001'}],[doc.lines[0],clone(doc.lines[0])],[{...doc.lines[0],lineId:''}],[{...doc.lines[0],price:null}]])assert.throws(()=>Q.create({...doc,lines},['V1']));
});
test('500 rows and five vendors remain bounded and 501 rows are refused without altering the input',()=>{
 const doc=request();doc.lines=Array.from({length:500},(_,i)=>({lineId:'L'+i,item:'M001',qty:1,price:i}));const before=JSON.stringify(doc),s=Q.create(doc,['V1','V2','V3','V4','V5']);assert.equal(Q.comparison(s,doc).length,500);assert.equal(s.vendors[4].received.length,500);assert.equal(JSON.stringify(doc),before);assert.throws(()=>Q.create({...doc,lines:doc.lines.concat({lineId:'L500',item:'M001',qty:1,price:0})},['V1']));
});
test('persisted JSON roundtrip preserves version, no-response, closed state and explicit selection',()=>{
 const doc=request();let s=select(reply(Q.create(doc,['V1','V2']),doc,'V1','12.3456789012'),doc,'V1');s=apply(s,doc,{type:'close',vendorCode:'V1',closed:true});const recovered=clone(s);assert.equal(Q.validate(recovered,clone(doc)),true);assert.deepEqual(Q.comparison(recovered,doc),Q.comparison(s,doc));
});
test('corrupted persisted state is rejected rather than silently normalized or reset',()=>{
 const doc=request();const valid=select(reply(Q.create(doc,['V1']),doc,'V1','3'),doc,'V1');
 const edits=[s=>s.version=2,s=>s.revision=-1,s=>s.extra=true,s=>s.source.lines[0].qty='999',s=>s.source.fingerprint='fake',s=>s.vendors.push(clone(s.vendors[0])),s=>s.vendors[0].inputClosed=1,s=>s.vendors[0].received=[],s=>s.vendors[0].received[0].price=3,s=>s.vendors[0].received[0].price='3.00',s=>s.vendors[0].received[0].lineKey='other',s=>s.selections[0].price='1',s=>s.selections.push(clone(s.selections[0])),s=>s.selections[0].vendorCode='other'];
 for(const edit of edits){const s=clone(valid);edit(s);const before=JSON.stringify(s);assert.throws(()=>Q.validate(s,doc));assert.equal(JSON.stringify(s),before);}
});
test('frozen inputs are never modified and returned comparison rows do not alias stored state',()=>{
 const doc=freeze(request()),s=freeze(Q.create(doc,['V1']));const next=reply(s,doc,'V1','2'),rows=Q.comparison(next,doc);rows[0].received[0].price='bad';rows[0].requestedPrice='bad';assert.equal(next.vendors[0].received[0].price,'2');assert.equal(next.source.lines[0].requestedPrice,'50000');assert.equal(s.vendors[0].received[0].price,null);
});
test('revision exhaustion is rejected before producing an unsafe number',()=>{
 const doc=request(),s=Q.create(doc,['V1']);s.revision=Number.MAX_SAFE_INTEGER;assert.throws(()=>apply(s,doc,{type:'close',vendorCode:'V1',closed:true}),/수정번호/);assert.equal(s.revision,Number.MAX_SAFE_INTEGER);
});
test('real InventoryCore synthetic legacy voucher, prices, forms and backup remain byte identical',()=>{
 let db=C.seed();db=C.command(db,'document',{type:'pricerequest',date:C.today(),partner:'V001',warehouse:'W001',lines:[{item:'M001',qty:100,price:50000}],memo:'old price request'}).db;
 const doc=clone(db.documents.findLast(d=>d.type==='pricerequest')),before=JSON.stringify(db);let s=Q.create(doc,['V001','SECOND-SYNTHETIC-VENDOR']);s=reply(s,doc,'SECOND-SYNTHETIC-VENDOR','25000','row:0');s=select(s,doc,'SECOND-SYNTHETIC-VENDOR','row:0');assert.equal(Q.validate(clone(s),doc),true);assert.equal(JSON.stringify(db),before);C.validateBackup(clone(db));assert.equal(JSON.stringify(db),before);
});
test('deterministic independent supplier selection cases never imply an automatic cheapest vendor',()=>{
 const doc=request();let rng=20261021;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%100000;};
 for(let i=0;i<400;i++){const prices=[random(),random(),random()],chosen=i%3;let s=Q.create(doc,['A','B','C']);for(let j=0;j<3;j++)s=reply(s,doc,['A','B','C'][j],prices[j]);assert.equal(Q.comparison(s,doc)[0].confirmed,null);s=select(s,doc,['A','B','C'][chosen]);assert.equal(Q.comparison(s,doc)[0].confirmed.price,String(prices[chosen]));assert.equal(Q.validate(clone(s),doc),true);}
});

test('sparse and explicitly undefined arrays never pass source or persisted state validation',()=>{
 const doc=request();for(const lines of [new Array(1),[undefined]])assert.throws(()=>Q.create({...doc,lines},['V1']));
 const valid=Q.create(doc,['V1']);for(const edit of [s=>delete s.vendors[0],s=>delete s.vendors[0].received[0],s=>s.vendors[0].received[0]=undefined,s=>s.selections=new Array(1),s=>delete s.source.lines[0]]){const s=clone(valid);edit(s);assert.throws(()=>Q.validate(s,doc));}
 const vendors=new Array(1);assert.throws(()=>Q.create(doc,vendors));const nested={...doc,custom:[undefined]};assert.throws(()=>Q.create(nested,['V1']));
});
test('existing opaque row IDs including spaces stay exact through stored InventoryCore backup and comparison',()=>{
 let db=C.seed();db=C.command(db,'document',{type:'pricerequest',date:C.today(),partner:'V001',warehouse:'W001',lines:[{lineId:' A ',item:'M001',qty:1,price:4},{lineId:'A',item:'M001',qty:2,price:5}]}).db;C.validateBackup(clone(db));const doc=clone(db.documents.findLast(d=>d.type==='pricerequest')),before=JSON.stringify(db);let s=Q.create(doc,['V001']);assert.deepEqual(s.source.lines.map(r=>r.lineKey),['id: A ','id:A']);s=reply(s,doc,'V001','12','id: A ');s=select(s,doc,'V001','id: A ');assert.equal(Q.comparison(clone(s),doc)[0].confirmed.price,'12');assert.equal(Q.comparison(s,doc)[1].confirmed,null);assert.equal(JSON.stringify(db),before);
});
