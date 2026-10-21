'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/inventory-core.js'),R=require('../dist/purchase-return-core.js'),P=require('../dist/purchasing-report-core.js');
function data(lines=[{item:'M001',qty:3,price:5}]){
 let db=C.empty();db.masters=C.clone(C.seed().masters);
 const out=C.command(db,'document',{type:'purchase',date:'2026-10-21',partner:'V001',warehouse:'W001',vatRate:10,lines,custom:{delivery:'기존 상단'},memo:'보존'});return {db:out.db,id:out.result.id};
}
function quantity(draft,value,index=0){draft.lines[index].qty=value;return draft;}
test('new negative draft and preview never change original, saved forms, sequence, history or balances',()=>{
 const {db,id}=data(),before=JSON.stringify(db),draft=R.create(db,id,'2026-10-22'),preview=R.preview(db,quantity(draft,-1));
 assert.equal(draft.lines[0].qty,-1);assert.deepEqual(preview.totals,{qty:-1,supply:-5,tax:-.67,total:-5.67});assert.equal(preview.sourceId,id);assert.equal(JSON.stringify(db),before);assert.equal(C.outstanding(db,'payable','V001'),17);
});
test('negative copy save, validated backup reload, second return and query conserve exact source VAT and stock without a second purchase document',()=>{
 let {db,id}=data();const source=C.clone(db.documents[0]),forms=C.clone(db.settings.customization);
 const first=R.save(db,quantity(R.create(db,id,'2026-10-22'),-1));db=C.validateBackup(JSON.parse(JSON.stringify(first.db)));
 assert.equal(first.result.type,'purchasereturn');assert.equal(first.result.createdAt,undefined);assert.equal(first.result.createdBy,undefined);assert.equal(first.result.settlementMode,'credit');assert.equal(first.result.lines[0].qty,1);assert.equal(first.result.lines[0].returnAmounts.tax,.67);assert.deepEqual(R.presentation(db.documents.find(d=>d.id===first.result.id)).totals,{qty:-1,supply:-5,tax:-.67,total:-5.67});
 const last=R.save(db,R.create(db,id,'2026-10-22'));db=C.validateBackup(JSON.parse(JSON.stringify(last.db)));assert.equal(last.result.lines[0].returnAmounts.tax,1.33);assert.equal(db.documents.filter(d=>d.type==='purchase').length,1);assert.equal(db.documents.filter(d=>d.type==='purchasereturn').length,2);assert.equal(C.stock(db,'M001','W001'),0);assert.equal(C.outstanding(db,'payable','V001'),0);
 assert.equal(P.search(db,'purchase').summary.quantity,0);assert.equal(P.search(db,'purchase',{purchaseKind:'return'}).summary.tax,-2);assert.deepEqual(db.documents.find(d=>d.id===id),source);assert.deepEqual(db.settings.customization,forms);assert.throws(()=>R.create(db,id),/잔량/);
});
test('same-item source rows with stable IDs retain different prices, custom data and exact return references',()=>{
 const {db,id}=data([{lineId:'A',item:'M001',qty:2,price:100,custom:{lot:'A'}},{lineId:'B',item:'M001',qty:3,price:200,custom:{lot:'B'}}]),draft=R.create(db,id,'2026-10-22');draft.lines[0].qty=0;draft.lines[1].qty=-1;
 const out=R.save(db,draft);assert.equal(out.result.lines.length,1);assert.equal(out.result.lines[0].price,200);assert.equal(out.result.lines[0].sourceLineId,'B');assert.equal(out.result.lines[0].custom.lot,'B');assert.deepEqual(C.remaining(out.db,out.db.documents[0],'purchasereturn').map(l=>l.qty),[2,2]);assert.equal(R.presentation(out.result).totals.total,-220);
});
test('omitted or zero rows are not defaulted back to full remaining quantities',()=>{
 const {db,id}=data([{lineId:'A',item:'M001',qty:2,price:100},{lineId:'B',item:'S001',qty:4,price:100}]),draft=R.create(db,id,'2026-10-22');draft.lines=draft.lines.slice(0,1);draft.lines[0].qty=-1;const out=R.save(db,draft);assert.deepEqual(out.result.lines.map(l=>l.item),['M001']);assert.deepEqual(C.remaining(out.db,out.db.documents[0],'purchasereturn').map(l=>l.qty),[1,4]);
});
test('exchange returns consume the same source remainder while their unpaid replacement stream is unchanged',()=>{
 let {db,id}=data();const exchange=C.command(db,'convert',{id,type:'purchasereturn',settlementMode:'exchange',date:'2026-10-21',quantities:{M001:1}});db=exchange.db;const draft=R.create(db,id,'2026-10-22');assert.equal(draft.lines[0].qty,-2);const out=R.save(db,draft);assert.deepEqual(out.db.documents.find(d=>d.id===exchange.result.id),exchange.result);assert.equal(C.remaining(out.db,out.db.documents.find(d=>d.id===id),'purchasereturn')[0].qty,0);assert.equal(C.outstanding(out.db,'payable','V001'),5.67);assert.throws(()=>R.presentation(exchange.result),/차감/);
});
test('editing saved credit return preserves its ID, rows and custom metadata and rebalances existing legacy amounts',()=>{
 let {db,id}=data();const first=R.save(db,quantity(R.create(db,id,'2026-10-21'),-1));db=first.db;const original=C.clone(db.documents[0]),draft=R.edit(db,first.result.id);draft.lines[0].qty=-2;
 const preview=R.preview(db,draft);assert.equal(preview.totals.tax,-1.33);assert.equal(db.documents.find(d=>d.id===first.result.id).lines[0].qty,1);
 const out=R.save(db,draft);assert.equal(out.result.id,first.result.id);assert.equal(out.result.custom.delivery,'기존 상단');assert.equal(out.result.memo,'보존');assert.equal(out.db.documents.length,2);assert.equal(R.presentation(out.result).totals.qty,-2);assert.deepEqual(out.db.documents[0],original);assert.deepEqual(C.validateBackup(out.db).documents,out.db.documents);
});
test('source edit, new return, source replacement and saved return edit all reject stale drafts without changing current state',()=>{
 const {db,id}=data(),draft=quantity(R.create(db,id,'2026-10-22'),-1),mutations=[state=>{state.documents[0].memo='변경';},state=>{state.documents[0].id='REPLACED';}];
 for(const mutate of mutations){const changed=C.clone(db);mutate(changed);const before=JSON.stringify(changed);assert.throws(()=>R.save(changed,draft),/변경|원구매/);assert.equal(JSON.stringify(changed),before);}
 const one=R.save(db,draft),before=JSON.stringify(one.db);assert.throws(()=>R.save(one.db,draft),/변경/);assert.equal(JSON.stringify(one.db),before);
 const edit=R.edit(one.db,one.result.id),changed=C.clone(one.db);changed.documents.find(d=>d.id===one.result.id).memo='수정';assert.throws(()=>R.save(changed,edit),/변경/);
});
test('positive, empty, boolean, malformed, repeated, foreign and injected amount rows fail atomically',()=>{
 const {db,id}=data(),base=R.create(db,id,'2026-10-22'),before=JSON.stringify(db);
 for(const invalid of [1,'',true,null,NaN,Infinity,-1.1234567]){const draft=C.clone(base);draft.lines[0].qty=invalid;assert.throws(()=>R.save(db,draft),/수량/);}
 for(const modify of [d=>d.lines.push(C.clone(d.lines[0])),d=>d.lines[0].key='foreign',d=>d.lines[0].price=0,d=>d.lines[0].returnAmounts={tax:0},d=>d.lines=[],d=>d.lines[0].qty=0,d=>d.partner='C001']){const draft=C.clone(base);modify(draft);assert.throws(()=>R.save(db,draft));}
 assert.equal(JSON.stringify(db),before);
});
test('over-return, a paid purchase return and stock shortage retain the existing core rejection policy',()=>{
 const {db,id}=data(),before=JSON.stringify(db);assert.throws(()=>R.save(db,quantity(R.create(db,id,'2026-10-22'),-4)),/잔량|수량/);assert.equal(JSON.stringify(db),before);
 const paid=C.command(db,'payment',{side:'payable',partner:'V001',date:'2026-10-21',amount:17}).db,paidBefore=JSON.stringify(paid);assert.throws(()=>R.save(paid,quantity(R.create(paid,id,'2026-10-22'),-1)),/초과|잔액|지급/);assert.equal(JSON.stringify(paid),paidBefore);
 const sold=C.command(db,'document',{type:'sale',date:'2026-10-21',partner:'C001',warehouse:'W001',lines:[{item:'M001',qty:3,price:5}]}).db;assert.throws(()=>R.save(sold,quantity(R.create(sold,id,'2026-10-22'),-1)),/재고/);
});
test('only existing active positive purchases are copy sources and experimental VAT is not enabled by this adapter',()=>{
 const {db,id}=data();assert.throws(()=>R.create(db,'missing'),/원구매/);for(const change of [d=>d.type='purchaseorder',d=>d.status='취소',d=>d.lines[0].qty=-1]){const state=C.clone(db);change(state.documents[0]);assert.throws(()=>R.create(state,id));}
 const research=C.clone(db);research.documents[0].vatCalculation='transaction';assert.throws(()=>R.create(research,id),/연구/);const before=JSON.stringify(research);assert.equal(JSON.stringify(research),before);
});
test('invalid dates and accounted edits are rejected without normalizing incoming drafts or records',()=>{
 const {db,id}=data();for(const date of ['2026-02-30','2026-13-01','invalid']){const draft=R.create(db,id,date);assert.throws(()=>R.save(db,draft),/일자/);}
 const out=R.save(db,quantity(R.create(db,id,'2026-10-22'),-1)),record=out.db.documents.find(d=>d.id===out.result.id);record.accounted=true;assert.throws(()=>R.edit(out.db,record.id),/회계/);
});
