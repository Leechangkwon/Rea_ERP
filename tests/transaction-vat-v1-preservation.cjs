const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),V=require('../dist/transaction-vat-core.js'),M=require('../dist/purchase-mail-core.js');
// Frozen at the recorded producer commit. Never regenerate in a test or derive expectations from today's calculator.
const reference=require('./fixtures/transaction-vat-v1-backup.json'),fresh=()=>C.clone(reference.db),find=(db,key)=>db.documents.find(d=>d.id===reference.ids[key]);
test('frozen v1 backups retain all totals, versions and legacy documents without migration',()=>{
 const db=fresh(),before=JSON.stringify(db),restored=C.validateBackup(db);assert.equal(JSON.stringify(db),before);assert.deepEqual(restored,reference.db);
 for(const [key,expected] of Object.entries(reference.expectedTotals))assert.deepEqual(C.totals(find(restored,key)),expected,key);
 for(const key of ['sameGrossDifferentTax','differentGross','manualPurchase']){const d=find(restored,key);assert.equal(d.vatAdjustment.version,1);assert.deepEqual(V.stored(d).after,{supply:reference.expectedTotals[key].supply,tax:reference.expectedTotals[key].tax,total:reference.expectedTotals[key].total});}
 assert.equal(find(restored,'legacyRequest').vatAdjustment,undefined);assert.equal(find(restored,'legacyRequest').vatCalculation,undefined);assert.deepEqual(restored.settings,reference.db.settings);
 assert.equal(C.stock(restored,'M001','W001'),13);assert.equal(C.outstanding(restored,'payable','V001'),13000);
});
test('frozen boundary purchase orders keep exact supply and tax through mail normalization',()=>{
 const db=fresh(),packet=M.fromDocuments(db,[reference.ids.sameGrossDifferentTax,reference.ids.differentGross]);assert.deepEqual(packet,reference.mailPacket);
 assert.deepEqual(M.normalizeMessage(C.clone(reference.mailPacket),{recipientRequired:false}),reference.mailPacket);
 assert.deepEqual(packet.documents.map(d=>[C.totals(d).supply,C.totals(d).tax,C.totals(d).total]),[[998,100,1098],[8,1,9]]);
});
test('older clients can edit a frozen v1 memo without dropping or recomputing its saved contract',()=>{
 const db=fresh(),original=find(db,'sameGrossDifferentTax'),payload=C.clone(original);delete payload.vatCalculation;delete payload.vatAdjustment;payload.memo='Synthetic memo-only update';
 const out=C.command(db,'document',payload);assert.deepEqual(out.result.vatAdjustment,original.vatAdjustment);assert.deepEqual(C.totals(out.result),reference.expectedTotals.sameGrossDifferentTax);
 assert.deepEqual(out.db.documents.filter(d=>d.id!==original.id),db.documents.filter(d=>d.id!==original.id));assert.deepEqual(out.db.settings,db.settings);assert.deepEqual(C.validateBackup(out.db),out.db);assert.deepEqual(db,reference.db);
});
test('unknown or coerced adjustment versions never fall back to line or current defaults',()=>{
 for(const version of [999,null,'1']){const db=fresh();find(db,'sameGrossDifferentTax').vatAdjustment.version=version;const before=JSON.stringify(db);assert.throws(()=>C.validateBackup(db),/부가세/);assert.equal(JSON.stringify(db),before);assert.throws(()=>M.fromDocuments(db,[reference.ids.sameGrossDifferentTax]),/부가세/);}
});
test('final return exhausts a frozen partial-return purchase with the original allocated amounts',()=>{
 const db=fresh(),original=find(db,'manualPurchase'),existing=find(db,'partialReturn'),out=C.command(db,'convert',{id:original.id,type:'purchasereturn',date:'2026-10-23',settlementMode:'credit',quantities:{L1:5,L2:5,L3:3}});
 const returned=C.totals(out.result),old=C.totals(existing);assert.deepEqual(returned,{qty:13,supply:11817.6,tax:1182.4,total:13000});
 for(const key of ['qty','supply','tax','total'])assert.equal(C.money(old[key]+returned[key]),reference.expectedTotals.manualPurchase[key]);
 assert.equal(C.stock(out.db,'M001','W001'),0);assert.equal(C.outstanding(out.db,'payable','V001'),0);assert.deepEqual(find(out.db,'manualPurchase'),original);assert.deepEqual(find(out.db,'partialReturn'),existing);assert.deepEqual(C.validateBackup(out.db),out.db);assert.deepEqual(db,reference.db);
});
test('item rename preserves frozen adjustment and partial-return values across a backup round trip',()=>{
 const db=fresh(),out=C.command(db,'rename',{key:'items',from:'M001',to:'M-V1'});
 for(const [key,expected]of Object.entries(reference.expectedTotals))assert.deepEqual(C.totals(find(out.db,key)),expected,key);
 assert.deepEqual(C.validateBackup(out.db),out.db);assert.equal(C.stock(out.db,'M-V1','W001'),13);assert.equal(C.outstanding(out.db,'payable','V001'),13000);
 for(const d of out.db.documents)for(const line of d.lines)assert.equal(line.item,'M-V1');assert.deepEqual(out.db.settings,db.settings);assert.deepEqual(db,reference.db);
});
