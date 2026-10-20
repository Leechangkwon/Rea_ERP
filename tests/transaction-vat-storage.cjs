const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),V=require('../dist/transaction-vat-core.js'),M=require('../dist/purchase-mail-core.js'),E=require('../dist/entry-core.js'),P=require('../dist/purchase-plan-core.js'),PR=require('../dist/purchase-room-core.js'),F=require('../dist/form-core.js');
const clone=C.clone;
function fixture(){const db=C.empty();db.masters=clone(C.seed().masters);return db;}
function input(type='purchase'){return {type,date:'2026-10-21',warehouse:'W001',partner:'V001',currency:'KRW',vatRate:10,supplyRounding:{method:'round',digits:0},vatCalculation:'transaction',lines:[1,2,3].map(n=>({item:'M001',lineId:'L'+n,qty:5,price:909.09,discount:0,supplier:'V001',dueDate:'2026-10-25'}))};}
function confirmed(doc,mode='transaction'){const value=clone(doc);value.vatCalculation=mode;value.vatConfirmation=V.confirmation(value,mode);return value;}
function saved(type='purchase'){return C.command(fixture(),'document',confirmed(input(type)));}
const total={qty:15,supply:13636,tax:1364,total:15000};
test('explicit confirmation persists adjusted row and omits ephemeral preview from storage and history',()=>{
 const db=fixture(),old=JSON.stringify(db),payload=confirmed(input()),before=JSON.stringify(payload),out=C.command(db,'document',payload);
 assert.equal(JSON.stringify(db),old);assert.equal(JSON.stringify(payload),before);assert.deepEqual(C.totals(out.result),total);
 assert.deepEqual([out.result.lines[2].supply,out.result.lines[2].tax,out.result.lines[2].total],[4546,454,5000]);assert.equal(out.result.vatCalculation,'transaction');assert.ok(out.result.vatAdjustment);
 assert.equal(JSON.stringify(out.db).includes('vatConfirmation'),false);assert.equal(JSON.stringify(out.db).includes('single-rate-krw-preview'),false);
 assert.deepEqual(C.validateBackup(clone(out.db)),out.db);assert.deepEqual(C.totals(out.result),C.totals(C.validateBackup(out.db).documents[0]));
});
test('new unconfirmed or internally consistent forged adjustment is rejected atomically',()=>{
 const db=fixture(),before=JSON.stringify(db),payload=input();assert.throws(()=>C.command(db,'document',payload),/차액.*확인/);
 payload.vatAdjustment=saved().result.vatAdjustment;assert.throws(()=>C.command(db,'document',payload),/차액.*확인/);assert.equal(JSON.stringify(db),before);
});
test('existing same-amount edits preserve the database adjustment even if old clients omit all new fields',()=>{
 const out=saved(),d=clone(out.result);d.memo='적요만 수정';delete d.vatCalculation;delete d.vatAdjustment;
 const next=C.command(out.db,'document',d);assert.deepEqual(next.result.vatAdjustment,out.result.vatAdjustment);assert.deepEqual(C.totals(next.result),total);assert.equal(next.result.memo,'적요만 수정');
});
test('changed prices cannot reuse previous evidence or self-valid replacement evidence',()=>{
 const out=saved(),before=JSON.stringify(out.db),d=clone(out.result);d.lines[0].price=919.09;
 assert.throws(()=>C.command(out.db,'document',d),/차액.*확인/);
 const fresh=clone(d);delete fresh.vatAdjustment;const fake=V.forSave(confirmed(fresh));d.vatAdjustment=fake.vatAdjustment;assert.throws(()=>C.command(out.db,'document',d),/차액.*확인/);
 const next=C.command(out.db,'document',confirmed(d));assert.deepEqual(C.totals(next.result).total,V.confirmation(d).preview.after.total);assert.equal(JSON.stringify(out.db),before);
});
test('stale confirmations detect edits, order, header and transaction-type VAT normalization',()=>{
 for(const change of [d=>d.lines[0].qty++,d=>d.lines.reverse(),d=>d.memo='late edit',d=>d.transactionType='22',d=>d.taxRounding={method:'floor',digits:0}]){
  const db=fixture(),d=confirmed(input()),before=JSON.stringify(db);change(d);assert.throws(()=>C.command(db,'document',d),/다시 확인|근거/);assert.equal(JSON.stringify(db),before);
 }
});
test('switching back to line mode requires a fresh explicit confirmation and restores base split',()=>{
 const out=saved(),d={...clone(out.result),vatCalculation:'line'};assert.throws(()=>C.command(out.db,'document',d),/변경.*확인/);
 const next=C.command(out.db,'document',confirmed(d,'line'));assert.equal(next.result.vatCalculation,'line');assert.equal(next.result.vatAdjustment,undefined);
 assert.deepEqual(C.totals(next.result),{qty:15,supply:13635,tax:1365,total:15000});assert.deepEqual(C.validateBackup(next.db),next.db);
});
test('no-difference transaction documents retain their mode and validated evidence',()=>{
 const d=input();d.lines=d.lines.map(l=>({...l,price:100}));const out=C.command(fixture(),'document',d);assert.ok(out.result.vatAdjustment);assert.equal(out.result.vatCalculation,'transaction');assert.equal(out.result.vatAdjustment.delta.supply,0);
 const changed=clone(out.result);changed.lines=changed.lines.map(l=>({...l,price:909.09}));assert.throws(()=>C.command(out.db,'document',changed),/차액.*확인/);
});
test('backup rejects tampered/missing/inconsistent evidence and ephemeral confirmations',()=>{
 const out=saved(),changes=[d=>delete d.vatAdjustment,d=>d.vatAdjustment.version=2,d=>d.vatAdjustment.after.tax++,d=>d.vatAdjustment.lastIndex=0,d=>d.vatAdjustment.delta.supply++,d=>d.vatAdjustment.extra=true,d=>d.vatCalculation='line',d=>d.vatCalculation='unexpected',d=>d.vatCalculation=null,d=>d.vatConfirmation={},d=>d.lines[1].qty++,d=>d.lines.reverse()];
 for(const change of changes){const db=clone(out.db);change(db.documents[0]);assert.throws(()=>C.validateBackup(db),/부가세|임시/);}
 const cached=clone(out.db);cached.documents[0].lines[2].tax=99999;assert.equal(C.validateBackup(cached).documents[0].lines[2].tax,454);
});
test('cloned row lookup, mail normalization and purchase-room rows use the same adjusted amounts',()=>{
 const out=saved('purchaseorder'),last=out.result.lines[2];assert.equal(C.effectiveLineTotals(out.result,clone(last)).tax,454);
 assert.throws(()=>C.effectiveLineTotals(out.result,{...last,qty:1}),/기준/);
 const packet=M.fromDocuments(out.db,[out.result.id]),mail=packet.documents[0];assert.deepEqual(C.totals(mail),total);assert.equal(mail.lines[2].tax,454);assert.deepEqual(M.normalizeMessage(packet,{recipientRequired:false}),packet);
 const tampered=clone(mail);tampered.vatAdjustment.delta.tax--;assert.throws(()=>M.normalizeDocument(tampered),/근거/);
 const purchase=saved(),rows=PR.purchaseRows(purchase.db,{from:'2026-10-01',to:'2026-10-31'},C);assert.equal(rows[2].tax,454);assert.equal(rows.reduce((s,r)=>s+r.supply,0),13636);
});
test('adjusted user formula fields are computed after the final tax split',()=>{
 let db=fixture();const fields=[F.field('supply','공급가액','number'),F.field('tax','부가세','number'),F.field('x_amount','검증금액','number',{custom:true,formula:'supply + tax'}),F.field('x_tax','검증세액','number',{custom:true,formula:'tax'})];
 db=C.command(db,'formSave',{key:'doc:purchase',context:'lines',form:{id:'vat_check',name:'부가세 합성',fields,page:{...F.pageDefaults}}}).db;
 const out=C.command(db,'document',confirmed(input()));assert.equal(out.result.lines[2].custom.x_tax,454);assert.equal(out.result.lines[2].custom.x_amount,5000);assert.deepEqual(C.validateBackup(out.db),out.db);
});
test('partial and final credit returns exactly exhaust the adjusted purchase amounts',()=>{
 const out=saved();let db=out.db;const source=out.result,returns=[];
 for(const qty of [2,3]){const r=C.command(db,'convert',{id:source.id,type:'purchasereturn',date:'2026-10-22',settlementMode:'credit',quantities:{L1:qty,L2:qty,L3:qty}});db=r.db;returns.push(r.result);assert.equal(r.result.vatAdjustment,undefined);assert.equal(r.result.vatCalculation,undefined);}
 for(const key of ['supply','tax','total'])assert.equal(C.money(returns.reduce((sum,r)=>sum+C.totals(r)[key],0)),total[key]);
 assert.equal(C.outstanding(db,'payable','V001'),0);assert.equal(C.stock(db,'M001','W001'),0);assert.deepEqual(C.validateBackup(db),db);
});
test('exchange return and replacement preserve source adjusted amounts without a second payable',()=>{
 const out=saved(),r=C.command(out.db,'convert',{id:out.result.id,type:'purchasereturn',date:'2026-10-22',settlementMode:'exchange',quantities:{L1:0,L2:0,L3:5}});
 const receipt=C.command(r.db,'convert',{id:r.result.id,type:'exchangereceipt',date:'2026-10-23'});assert.equal(C.totals(receipt.result).tax,454);assert.equal(C.outstanding(receipt.db,'payable','V001'),15000);assert.deepEqual(C.validateBackup(receipt.db),receipt.db);
});
test('a return locks original adjustment amounts even after a fresh confirmation',()=>{
 const out=saved(),r=C.command(out.db,'convert',{id:out.result.id,type:'purchasereturn',settlementMode:'credit',quantities:{L1:0,L2:0,L3:1}}),d=clone(out.result);d.lines[2].price++;
 assert.throws(()=>C.command(r.db,'document',confirmed(d)),/원본|기준/);assert.deepEqual(C.totals(r.db.documents.find(x=>x.id===out.result.id)),total);
});
test('conversions and order imports do not carry source adjustments into a new voucher',()=>{
 const out=saved('purchaseorder'),converted=C.command(out.db,'convert',{id:out.result.id,type:'purchase'});assert.equal(converted.result.vatAdjustment,undefined);assert.equal(converted.result.vatCalculation,undefined);assert.equal(C.totals(converted.result).total,15000);
 const draft={type:'purchase',date:'2026-10-21',warehouse:'W001',partner:'V001',currency:'KRW',vatRate:10,lines:[]};const staged=E.stageDocuments(out.db,draft,{mode:'linked',adoptHeader:true,selections:[{documentId:out.result.id,item:'M001',lineId:'L3',qty:1}]});assert.equal(staged.vatAdjustment,undefined);assert.equal(staged.vatCalculation,undefined);assert.ok(C.command(out.db,'document',staged));
});
test('plan-generated purchase orders start without a stale source tax confirmation',()=>{
 const out=saved('plan'),p=P.preview(out.db,{date:'2026-10-21',selections:out.result.lines.map(l=>({documentId:out.result.id,lineId:l.lineId,item:l.item,qty:1}))});
 assert.equal(p.issues.length,0);for(const d of p.documents){assert.equal(d.vatAdjustment,undefined);assert.equal(d.vatCalculation,undefined);}assert.ok(C.command(out.db,'purchasePlanGenerate',{documents:p.documents}));
});
test('item code rename preserves adjusted amounts and round-trip backup while currency rename is atomic',()=>{
 const out=saved(),renamed=C.command(out.db,'rename',{key:'items',from:'M001',to:'M-NEW'});assert.deepEqual(C.totals(renamed.db.documents[0]),total);assert.deepEqual(C.validateBackup(renamed.db),renamed.db);assert.equal(renamed.db.documents[0].vatAdjustment.basis.lines[0].item,'M-NEW');
 const before=JSON.stringify(out.db);assert.throws(()=>C.command(out.db,'rename',{key:'currencies',from:'KRW',to:'WON'}),/원화 코드/);assert.equal(JSON.stringify(out.db),before);
});
test('bulk price change cannot silently reconfirm adjusted vouchers',()=>{
 const out=saved(),before=JSON.stringify(out.db);assert.throws(()=>C.command(out.db,'bulkprice',{ids:[out.result.id],percent:10}),/차액.*확인/);assert.equal(JSON.stringify(out.db),before);
});
test('legacy records and forms survive loading the module and an unrelated adjusted save',()=>{
 const db=C.seed(),before=JSON.stringify(db),out=C.command(db,'document',confirmed(input('purchaseorder')));assert.deepEqual(out.db.documents.slice(0,db.documents.length),db.documents);assert.deepEqual(out.db.settings,db.settings);assert.equal(JSON.stringify(db),before);
 assert.deepEqual(C.validateBackup(db),db);assert.ok(db.documents.every(d=>!Object.hasOwn(d,'vatCalculation')));
});

test('linked duplicate items use source line identity for cloned amount lookup and stored row order',()=>{
 const source=saved('purchaseorder'),d=input();d.sourceId=source.result.id;d.lines=d.lines.map(({lineId,...l})=>({...l,sourceLineId:lineId}));
 const out=C.command(source.db,'document',confirmed(d));assert.deepEqual(C.totals(out.result),total);assert.deepEqual(C.validateBackup(out.db),out.db);
 assert.deepEqual(out.result.lines.map(l=>C.effectiveLineTotals(out.result,clone(l)).tax),[455,455,454]);
 const bad=clone(out.db);bad.documents.at(-1).lines.reverse();assert.throws(()=>C.validateBackup(bad),/근거/);
 const reversed=clone(out.result);reversed.lines.reverse();assert.throws(()=>C.command(out.db,'document',reversed),/차액.*확인/);
 assert.throws(()=>C.effectiveLineTotals(out.result,{...out.result.lines[2],sourceLineId:'missing'}),/구분/);
});
test('linked adjusted purchase order retains source identity in mail normalization',()=>{
 const source=saved('pricerequest'),d=input('purchaseorder');d.sourceId=source.result.id;d.lines=d.lines.map(({lineId,...l})=>({...l,sourceLineId:lineId}));
 const out=C.command(source.db,'document',confirmed(d)),mail=M.fromDocuments(out.db,[out.result.id]);
 assert.equal(mail.documents[0].sourceId,source.result.id);assert.deepEqual(C.totals(mail.documents[0]),total);
 assert.deepEqual(M.normalizeMessage(mail,{recipientRequired:false}),mail);
 assert.deepEqual(mail.documents[0].lines.map(l=>C.effectiveLineTotals(mail.documents[0],clone(l)).tax),[455,455,454]);
});

test('mail preserves opaque line and source identifiers including valid surrounding spaces',()=>{
 const d=input('pricerequest');d.lines=d.lines.map(l=>({...l,lineId:' '+l.lineId+' '}));const source=C.command(fixture(),'document',confirmed(d));
 const target=input('purchaseorder');target.sourceId=source.result.id;target.lines=target.lines.map((l,i)=>({...l,lineId:' '+l.lineId+' ',sourceLineId:source.result.lines[i].lineId}));
 const out=C.command(source.db,'document',confirmed(target)),packet=M.fromDocuments(out.db,[out.result.id]);
 assert.deepEqual(C.validateBackup(out.db),out.db);assert.deepEqual(C.totals(packet.documents[0]),total);
 assert.deepEqual(packet.documents[0].lines.map(l=>[l.lineId,l.sourceLineId]),out.result.lines.map(l=>[l.lineId,l.sourceLineId]));assert.deepEqual(M.normalizeMessage(packet,{recipientRequired:false}),packet);
});
