const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js');
function fixture(){
 const db=C.empty();
 db.masters.items=[{code:'A',name:'품목 A',unit:'EA',buyPrice:110,buyVatIncluded:true,sellPrice:200,safety:20,warehouseSafety:[{warehouse:'W2',qty:0}],supplier:'V'}, {code:'B',name:'품목 B',buyPrice:50,sellPrice:100,safety:6}, {code:'OFF',name:'사용중단',disabled:true,safety:100}, {code:'SERVICE',name:'서비스',trackInventory:false,safety:100}];
 db.masters.partners=[{code:'V',name:'구매처'},{code:'C',name:'고객'}];db.masters.warehouses=[{code:'W1',name:'본사'},{code:'W2',name:'지점'},{code:'OFF',name:'중단 창고',disabled:true}];
 db.opening=[{item:'A',warehouse:'W1',date:'2026-01-01',qty:10},{item:'B',warehouse:'W1',date:'2026-01-01',qty:0},{item:'A',warehouse:'W2',date:'2026-01-01',qty:99}];
 const doc=(id,type,qty,extra={})=>({id,type,date:'2026-10-01',warehouse:'W1',partner:type==='order'||type==='sale'?'C':'V',status:'진행',vatRate:10,lines:[{item:'A',qty,price:100,discount:0,memo:'연결 적요',custom:{batch:'QA'}}],...extra});
 db.documents=[doc('PO','purchaseorder',10),doc('P','purchase',3,{sourceId:'PO'}),doc('O','order',8),doc('S','sale',2,{sourceId:'O'}),doc('CANCELLED','purchaseorder',999,{status:'취소'}),doc('FUTURE','purchase',50,{date:'2026-11-01',sourceId:'PO'}),doc('OTHER','purchaseorder',999,{warehouse:'W2'})];return db;
}
function draft(type='purchase'){return {type,date:'2026-10-15',warehouse:'W1',partner:type==='sale'?'C':'V',vatRate:10,memo:'작성 중 머리글',lines:[]};}
test('stock snapshot respects date, warehouse, active records and warehouse zero override',()=>{
 const db=fixture(),before=JSON.stringify(db),a=E.stockCandidates(db,{warehouse:'W1',asOf:'2026-10-15',targetType:'purchase',onlyShortage:true}).find(r=>r.item==='A');
 assert.deepEqual([a.stock,a.pendingSales,a.pendingPurchases,a.expected,a.safety,a.shortage,a.qty,a.price],[11,6,7,12,20,8,8,100]);
 assert.equal(E.stockCandidates(db,{warehouse:'W2',asOf:'2026-10-15',onlyShortage:true}).length,1); // B has global safety and no stock at W2.
 const second=E.stockCandidates(db,{warehouse:'W2',asOf:'2026-10-15'}).find(r=>r.item==='A');assert.equal(second.safety,0);assert.equal(second.safetySource,'warehouse');
 assert.equal(JSON.stringify(db),before);
});
test('stock pending switch, supplier, search and edit exclusion affect real candidates',()=>{
 const db=fixture(),normal=E.stockCandidates(db,{warehouse:'W1',asOf:'2026-10-15',includePending:false,onlyShortage:true});assert.equal(normal.find(r=>r.item==='A').shortage,9);
 assert.deepEqual(E.stockCandidates(db,{warehouse:'W1',asOf:'2026-10-15',supplier:'V',query:'품목 A',includeZero:true}).map(r=>r.item),['A']);
 const edit=E.stockCandidates(db,{warehouse:'W1',asOf:'2026-10-15',excludeId:'P',onlyShortage:true}).find(r=>r.item==='A');assert.equal(edit.stock,8);assert.equal(edit.pendingPurchases,10);assert.equal(edit.expected,12);
 assert.throws(()=>E.stockCandidates(db,{warehouse:''}),/창고/);assert.throws(()=>E.stockCandidates(db,{warehouse:'OFF'}),/창고/);assert.throws(()=>E.stockCandidates(db,{warehouse:'W1',asOf:'2026-02-30'}),/기준일/);
});
test('document candidates filter mode, period, warehouse, partner, query and disabled items',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');
 const rows=E.documentCandidates(db,{targetType:'purchase',mode:'linked',warehouse:'W1',partner:'V',from:'2026-10-01',to:'2026-10-15',query:'PO'});
 assert.equal(rows.length,1);assert.equal(rows[0].id,'PO');assert.equal(rows[0].lines[0].qty,7);assert.equal(rows[0].lines[0].originalQty,10);
 assert.ok(!E.documentCandidates(db).some(d=>d.id==='CANCELLED'));
 db.masters.items[0].disabled=true;assert.deepEqual(E.documentCandidates(db),[]);
 assert.throws(()=>E.documentCandidates(db,{from:'2026-10-15',to:'2026-10-01'}),/기간/);
});
test('linked staging is unsaved, retains source details and prevents overconsumption on final save',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const before=JSON.stringify(db),input=draft(),original=JSON.stringify(input);
 const staged=E.stageDocuments(db,input,{mode:'linked',selections:[{documentId:'PO',item:'A',qty:2.125}]});
 assert.equal(staged.sourceId,'PO');assert.equal(staged.memo,input.memo);assert.equal(staged.date,input.date);assert.equal(staged.lines[0].qty,2.125);assert.equal(staged.lines[0].custom.batch,'QA');assert.equal(staged.lines[0].importedFrom[0].documentId,'PO');
 assert.equal(JSON.stringify(db),before);assert.equal(JSON.stringify(input),original);
 const saved=C.command(db,'document',staged);assert.equal(C.remaining(saved.db,db.documents[0],'purchase')[0].qty,4.875);assert.equal(saved.result.lines[0].importedFrom[0].mode,'linked');
 assert.equal(C.validateBackup(saved.db).documents.at(-1).lines[0].importedFrom[0].documentId,'PO');
 const consumed=C.command(db,'document',{...draft(),sourceId:'PO',lines:[{item:'A',qty:6,price:100}]}).db;
 assert.throws(()=>C.command(consumed,'document',staged),/잔량/);
});
test('linked staging rejects mismatched/multiple sources, conflicting header and unrelated rows',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const select={mode:'linked',selections:[{documentId:'PO',item:'A',qty:2}]};
 assert.equal(E.stageDocuments(db,{...draft(),warehouse:'W2'},select).warehouse,'W2');assert.throws(()=>E.stageDocuments(db,{...draft(),partner:'C'},select),/거래처/);
 assert.throws(()=>E.stageDocuments(db,draft('sale'),select),/종류/);assert.throws(()=>E.stageDocuments(db,{...draft(),sourceId:'OTHER'},select),/다른 원본/);
 assert.throws(()=>E.stageDocuments(db,{...draft(),lines:[{item:'B',qty:1,price:1}]},select),/덮어쓰기/);
 assert.throws(()=>E.stageDocuments(db,draft(),{...select,selections:[...select.selections,{documentId:'OTHER',item:'A',qty:1}]}),/한 개/);
 assert.throws(()=>E.stageDocuments(db,draft(),{...select,selections:[{documentId:'PO',item:'A',qty:8}]}),/잔량/);
 const adopted=E.stageDocuments(db,{...draft(),partner:'C',warehouse:'W2'}, {...select,adoptHeader:true});assert.equal(adopted.partner,'V');assert.equal(adopted.warehouse,'W1');
 assert.throws(()=>E.stageDocuments(db,{...draft(),lines:[{item:'B',qty:1,price:1}]},{...select,adoptHeader:true}),/덮어쓰기/);
});
test('linked edit excludes its own consumption without losing other saved consumption',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const existing=db.documents.find(d=>d.id==='P');
 const result=E.stageDocuments(db,existing,{mode:'linked',replace:true,selections:[{documentId:'PO',item:'A',qty:9.5}]});assert.equal(result.id,'P');assert.equal(result.lines[0].qty,9.5);assert.doesNotThrow(()=>C.command(db,'document',result));
});
test('copy imports multiple source documents with references and never silently drops existing links',()=>{
 const db=fixture();db.documents.push({...structuredClone(db.documents[0]),id:'PO2'});
 const copy=E.stageDocuments(db,draft(),{mode:'copy',selections:[{documentId:'PO',item:'A',qty:1.25},{documentId:'PO2',item:'A',qty:2.5}]});assert.equal(copy.sourceId,undefined);assert.equal(copy.lines[0].qty,3.75);assert.equal(copy.lines[0].importedFrom.length,2);assert.equal(copy.memo,'작성 중 머리글');
 assert.throws(()=>E.stageDocuments(db,{...draft(),sourceId:'PO'},{mode:'copy',replace:true,selections:[{documentId:'PO2',item:'A',qty:1}]}),/연결 처리/);
 db.documents.at(-1).lines[0].price=999;assert.throws(()=>E.stageDocuments(db,draft(),{selections:[{documentId:'PO',item:'A',qty:1},{documentId:'PO2',item:'A',qty:1}]}),/단가/);
});
test('stock/safety staging carries frozen snapshot evidence, adds only chosen quantities and saves later',()=>{
 const db=fixture(),before=JSON.stringify(db),staged=E.stageStock(db,draft(),{kind:'safety',includePending:true,selections:[{item:'A',qty:2.625}]});assert.equal(staged.lines.length,1);assert.equal(staged.lines[0].qty,2.625);assert.equal(staged.lines[0].price,100);assert.equal(staged.lines[0].importedFrom[0].expected,12);assert.equal(JSON.stringify(db),before);
 const auto=E.stageStock(db,draft(),{kind:'safety',includePending:false,selections:[{item:'A'}]});assert.equal(auto.lines[0].qty,9);
 const sale=E.stageStock(db,draft('sale'),{kind:'stock',selections:[{item:'A',qty:1.5}]});assert.equal(sale.lines[0].price,200);
 assert.throws(()=>E.stageStock(db,draft(),{selections:[{item:'A',qty:1,warehouse:'W2'}]}),/창고/);
 assert.throws(()=>E.stageStock(db,{...draft(),sourceId:'PO'},{selections:[{item:'A',qty:1}]}),/연결 처리/);
 assert.throws(()=>E.stageStock(db,draft(),{selections:[{item:'SERVICE',qty:1}]}),/재고 품목/);
 for(const qty of [0,-1,NaN,Infinity,'',null,true,0.00000001])assert.throws(()=>E.stageStock(db,draft(),{selections:[{item:'A',qty}]}),/수량/);
});
test('staging errors leave original draft and database untouched',()=>{
 const db=fixture(),input={...draft(),lines:[{item:'B',qty:1,price:5}]},beforeDb=JSON.stringify(db),beforeDraft=JSON.stringify(input);
 assert.throws(()=>E.stageStock(db,input,{selections:[{item:'A',qty:2},{item:'MISSING',qty:1}]}));assert.equal(JSON.stringify(db),beforeDb);assert.equal(JSON.stringify(input),beforeDraft);
 assert.throws(()=>E.stageStock(db,input,{selections:[null]}),/선택/);assert.throws(()=>E.stageStock(db,input,{selections:[{item:'A',qty:1},{item:'A',qty:1}]}),/중복/);
});
test('safety warnings follow item action scope, warehouse overrides and editing stock exclusion',()=>{
 const db=fixture(),result=E.safetyWarnings(db,{...draft('sale'),lines:[{item:'A',qty:3},{item:'SERVICE',qty:100}]});assert.equal(result.length,1);assert.equal(result[0].after,8);assert.equal(result[0].shortage,12);
 db.masters.items[0].safetyActions=['order'];assert.deepEqual(E.safetyWarnings(db,{...draft('sale'),lines:[{item:'A',qty:3}]}),[]);
 assert.equal(E.safetyWarnings(db,{...draft('order'),partner:'C',lines:[{item:'A',qty:3}]}).length,1);
 assert.deepEqual(E.safetyWarnings(db,{...draft('order'),warehouse:'W2',lines:[{item:'A',qty:3}]}),[]);
});
test('safety item/warehouse basis stays explicit and staging enforces the preview date',()=>{
 const db=fixture();db.opening.find(row=>row.item==='A'&&row.warehouse==='W2').qty=10;db.documents=db.documents.filter(d=>d.warehouse!=='W2');
 const options={warehouse:'W2',asOf:'2026-10-15',onlyShortage:true};
 assert.ok(!E.stockCandidates(db,{...options,safetyScope:'warehouse'}).some(r=>r.item==='A'));
 const item=E.stockCandidates(db,{...options,safetyScope:'item'}).find(r=>r.item==='A');assert.equal(item.stock,10);assert.equal(item.shortage,10);assert.equal(item.safetySource,'item');
 const staged=E.stageStock(db,{...draft(),warehouse:'W2'},{kind:'safety',safetyScope:'item',selections:[{item:'A'}]});assert.equal(staged.lines[0].qty,10);assert.equal(staged.lines[0].importedFrom[0].safetyScope,'item');
 assert.throws(()=>E.stageStock(db,draft(),{asOf:'2026-10-14',selections:[{item:'A',qty:1}]}),/일자/);
 assert.throws(()=>E.stockCandidates(db,{...options,safetyScope:'unknown'}),/기준/);
});
test('source eligibility and selected row validation reject stale and disabled records',()=>{
 const db=fixture(),selection={selections:[{documentId:'PO',item:'A',qty:1}]};
 db.documents[0].status='취소';assert.throws(()=>E.stageDocuments(db,draft(),selection),/불러올/);db.documents[0].status='진행';
 db.masters.items[0].disabled=true;assert.throws(()=>E.stageDocuments(db,draft(),selection),/품목/);db.masters.items[0].disabled=false;
 db.masters.partners[0].disabled=true;assert.throws(()=>E.stageDocuments(db,draft(),selection),/거래처/);
 assert.throws(()=>E.stageDocuments(db,draft(),{selections:[{documentId:'PO',item:'A',qty:1},{documentId:'PO',item:'A',qty:1}]}),/중복/);
 assert.throws(()=>E.stageDocuments(db,draft(),{selections:[]}),/선택/);
});
test('copy source catalog includes all inventory types with positive rows only',()=>{
 const db=fixture();db.documents=[{...db.documents[0],id:'MOVE',type:'transfer',targetWarehouse:'W2'},{...db.documents[0],id:'MAKE',type:'production'},{...db.documents[0],id:'ADJUST',type:'adjust',lines:[{item:'A',qty:-3,price:100},{item:'B',qty:2,price:50}]}];
 assert.deepEqual(new Set(E.sourceTypes),new Set(Object.keys(C.types)));const rows=E.documentCandidates(db,{mode:'copy'});assert.equal(rows.length,3);assert.deepEqual(rows.find(d=>d.id==='ADJUST').lines.map(l=>l.item),['B']);
 const staged=E.stageDocuments(db,draft(),{mode:'copy',selections:[{documentId:'MOVE',item:'A',qty:1}]});assert.equal(staged.lines[0].importedFrom[0].type,'transfer');assert.equal(staged.sourceId,undefined);
});
test('purchase receiving warehouse can be chosen after staging without altering source warehouse',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const before=JSON.stringify(db),staged=E.stageDocuments(db,draft(),{mode:'linked',selections:[{documentId:'PO',item:'A',qty:1}]});staged.warehouse='W2';const saved=C.command(db,'document',staged);assert.equal(saved.result.warehouse,'W2');assert.equal(C.stock(saved.db,'A','W2'),C.stock(db,'A','W2')+1);assert.equal(saved.db.documents.find(d=>d.id==='PO').warehouse,'W1');assert.equal(JSON.stringify(db),before);
});
test('copy rows cannot be silently charged to a newly selected linked source',()=>{
 const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');db.documents.push({...structuredClone(db.documents[0]),id:'PO2'});const before=JSON.stringify(db);
 const copied=E.stageDocuments(db,draft(),{mode:'copy',selections:[{documentId:'PO',item:'A',qty:3}]});
 assert.throws(()=>E.stageDocuments(db,copied,{mode:'linked',selections:[{documentId:'PO2',item:'A',qty:2}]}),/기존 행/);assert.equal(copied.sourceId,undefined);assert.equal(copied.lines[0].qty,3);assert.equal(JSON.stringify(db),before);
 const linked=E.stageDocuments(db,copied,{mode:'linked',replace:true,selections:[{documentId:'PO2',item:'A',qty:2}]});assert.equal(linked.sourceId,'PO2');assert.equal(linked.lines[0].qty,2);assert.equal(linked.lines[0].importedFrom[0].documentId,'PO2');
});
test('adopting source header preserves VAT rounding through staged and saved purchase amounts',()=>{
 const db=fixture();db.documents=[db.documents[0]];const source=db.documents[0];source.taxRounding={method:'floor',digits:0};source.lines[0].qty=1;source.lines[0].price=15;
 const before=JSON.stringify(db),staged=E.stageDocuments(db,draft(),{mode:'linked',adoptHeader:true,selections:[{documentId:source.id,item:'A',qty:1}]});
 assert.deepEqual(staged.taxRounding,{method:'floor',digits:0});assert.notEqual(staged.taxRounding,source.taxRounding);assert.equal(C.totals(source).tax,1);assert.equal(C.totals(staged).tax,1);
 const saved=C.command(db,'document',staged);assert.equal(saved.result.lines[0].tax,1);assert.equal(C.validateBackup(saved.db).documents.at(-1).lines[0].tax,1);assert.equal(JSON.stringify(db),before);
});
test('adopting a source without a rounding policy explicitly restores default instead of reviving an older editor policy',()=>{
 const db=fixture();db.documents=[db.documents[0]];const source=db.documents[0];source.lines[0].qty=1;source.lines[0].price=15;
 const input={...draft(),taxRounding:{method:'floor',digits:0}},selection={mode:'linked',selections:[{documentId:source.id,item:'A',qty:1}]};
 const kept=E.stageDocuments(db,input,selection);assert.deepEqual(kept.taxRounding,input.taxRounding);assert.equal(C.totals(kept).tax,1);
 const staged=E.stageDocuments(db,input,{...selection,adoptHeader:true}),editorMerged={...input,...staged};assert.deepEqual(staged.taxRounding,{method:'round',digits:0});assert.equal(C.totals(editorMerged).tax,2);
 assert.equal(C.command(db,'document',editorMerged).result.lines[0].tax,2);assert.deepEqual(input.taxRounding,{method:'floor',digits:0});assert.equal(source.taxRounding,undefined);
});
test('copying the same business row merges quantity despite local line identity and preserves the stable id',()=>{const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const source=db.documents.find(d=>d.id==='PO'),input=draft('request');input.lines=[{...structuredClone(source.lines[0]),lineId:'L17',_new:true,qty:2,supplier:''}];const beforeDb=JSON.stringify(db),beforeInput=JSON.stringify(input),staged=E.stageDocuments(db,input,{mode:'copy',selections:[{documentId:'PO',item:'A',qty:1.25}]});assert.equal(staged.lines.length,1);assert.equal(staged.lines[0].qty,3.25);assert.equal(staged.lines[0].lineId,'L17');assert.equal(staged.lines[0].importedFrom[0].documentId,'PO');assert.equal(JSON.stringify(input),beforeInput);assert.equal(JSON.stringify(db),beforeDb);assert.doesNotThrow(()=>C.command(db,'document',staged));});
test('structured request and plan rows preserve differing business terms as separate stable rows',()=>{for(const type of ['request','plan'])for(const patch of [{price:999},{discount:5},{memo:'다른 적요'},{custom:{batch:'다름'}},{supplier:'C'}]){const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const input=draft(type),source=db.documents.find(d=>d.id==='PO');input.lines=[{...structuredClone(source.lines[0]),lineId:'L1',qty:2,...patch}];const before=JSON.stringify(input),staged=E.stageDocuments(db,input,{mode:'copy',selections:[{documentId:'PO',item:'A',qty:1}]});assert.equal(staged.lines.length,2);assert.equal(staged.lines[0].lineId,'L1');assert.equal(staged.lines[1].lineId,'L2');assert.equal(staged.lines[0].qty,2);for(const [key,value]of Object.entries(patch))assert.deepEqual(staged.lines[0][key],value);assert.equal(JSON.stringify(input),before);const saved=C.command(db,'document',staged);assert.deepEqual(C.validateBackup(saved.db).documents.at(-1).lines,saved.result.lines);}});
test('matching terms select the correct structured sibling instead of failing against the first same-item row',()=>{const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const source=db.documents.find(d=>d.id==='PO'),input=draft('plan');input.lines=[{...structuredClone(source.lines[0]),lineId:'L1',qty:2,price:999},{...structuredClone(source.lines[0]),lineId:'L2',qty:3}];const staged=E.stageDocuments(db,input,{selections:[{documentId:'PO',item:'A',qty:1}]});assert.deepEqual(staged.lines.map(l=>[l.lineId,l.qty,l.price]),[['L1',2,999],['L2',4,100]]);});
test('allocation-bearing and exact source rows cannot silently mix with ordinary copy rows',()=>{const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const source=db.documents.find(d=>d.id==='PO');for(const patch of [{planAllocations:[{documentId:'PLAN',item:'A',qty:2}]},{sourceLineId:'ORIGINAL'}]){const input=draft('plan');input.lines=[{...structuredClone(source.lines[0]),lineId:'L1',qty:2,...patch}];const before=JSON.stringify(input);assert.throws(()=>E.stageDocuments(db,input,{selections:[{documentId:'PO',item:'A',qty:1}]}),/원본 연결/);assert.equal(JSON.stringify(input),before);}});
test('local row identity never changes exact source allocation or permits consuming another source line',()=>{const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE'&&d.id!=='P');const source=db.documents.find(d=>d.id==='PO');source.lines=[{item:'A',lineId:'S1',qty:5,price:100},{item:'A',lineId:'S2',qty:3,price:200}];const input=draft();input.sourceId=source.id;input.lines=[{item:'A',lineId:'D1',sourceLineId:'S1',qty:1,price:100}];const staged=E.stageDocuments(db,input,{mode:'linked',selections:[{documentId:source.id,item:'A',lineId:'S1',qty:2}]});assert.equal(staged.lines[0].lineId,'D1');assert.equal(staged.lines[0].sourceLineId,'S1');assert.equal(staged.lines[0].qty,3);const saved=C.command(db,'document',staged);assert.deepEqual(C.remaining(saved.db,source,'purchase').map(l=>l.qty),[2,3]);assert.throws(()=>E.stageDocuments(db,input,{mode:'linked',selections:[{documentId:source.id,item:'A',lineId:'S1',qty:5}]}),/잔량/);});
test('stock staging merges matching structured rows without comparing identity and preserves different terms',()=>{const db=fixture(),input=draft('request');input.lines=[{item:'A',lineId:'L9',_new:true,qty:2,price:100,discount:0,memo:'',custom:{},supplier:''}];const before=JSON.stringify(input),merged=E.stageStock(db,input,{warehouse:'W1',selections:[{item:'A',qty:1.5}]});assert.equal(merged.lines.length,1);assert.equal(merged.lines[0].lineId,'L9');assert.equal(merged.lines[0].qty,3.5);input.lines[0].price=999;const split=E.stageStock(db,input,{warehouse:'W1',selections:[{item:'A',qty:1}]});assert.equal(split.lines.length,2);assert.equal(split.lines[0].price,999);assert.equal(split.lines[1].price,100);assert.notEqual(split.lines[0].lineId,split.lines[1].lineId);assert.equal(JSON.parse(before).lines[0].qty,input.lines[0].qty);});

function orderImportFixture(){const db=fixture();db.documents=db.documents.filter(d=>d.id!=='FUTURE');const order=db.documents.find(d=>d.id==='O');db.documents.push({...structuredClone(order),id:'O2',lines:[{...structuredClone(order.lines[0]),qty:3}]});return db;}
test('manual order line import keeps identical item rows while item import sums them and saves both faithfully',()=>{
 const db=orderImportFixture(),before=JSON.stringify(db),input=draft('request'),selections=[{documentId:'O',item:'A',qty:2.25},{documentId:'O2',item:'A',qty:1.5}];
 const lines=E.stageDocuments(db,input,{mode:'copy',grouping:'line',selections}),items=E.stageDocuments(db,input,{mode:'copy',grouping:'item',selections});
 assert.deepEqual(lines.lines.map(l=>l.qty),[2.25,1.5]);assert.equal(new Set(lines.lines.map(l=>l.lineId)).size,2);assert.deepEqual(lines.lines.map(l=>l.importedFrom[0].documentId),['O','O2']);assert.deepEqual(items.lines.map(l=>l.qty),[3.75]);assert.equal(items.lines[0].importedFrom.length,2);
 for(const staged of [lines,items]){const saved=C.command(db,'document',staged),reloaded=C.validateBackup(JSON.parse(JSON.stringify(saved.db)));assert.deepEqual(reloaded.documents.at(-1).lines,saved.result.lines);assert.deepEqual(saved.db.documents.slice(0,-1),db.documents);assert.deepEqual(C.movements(saved.db),C.movements(db));}
 assert.equal(JSON.stringify(db),before);assert.deepEqual(input.lines,[]);
});
test('line copy appends without merging existing rows, preserves ids and upgrades only a staged legacy copy',()=>{
 const db=orderImportFixture(),selections=[{documentId:'O',item:'A',qty:1}];for(const oldId of [undefined,'L1']){const input=draft('request');input.lines=[{...structuredClone(db.documents.find(d=>d.id==='O').lines[0]),qty:4,...(oldId?{lineId:oldId}:{})}];const before=JSON.stringify(input),staged=E.stageDocuments(db,input,{grouping:'line',selections});assert.deepEqual(staged.lines.map(l=>l.qty),[4,1]);assert.equal(staged.lines[0].lineId,'L1');assert.equal(staged.lines[1].lineId,'L2');assert.equal(JSON.stringify(input),before);assert.doesNotThrow(()=>C.command(db,'document',staged));const replaced=E.stageDocuments(db,input,{grouping:'line',replace:true,selections});assert.equal(replaced.lines.length,1);assert.equal(replaced.lines[0].qty,1);}
});
test('line copy retains distinct original row identity, terms and exact provenance',()=>{
 const db=orderImportFixture(),order=db.documents.find(d=>d.id==='O');order.lines=[{item:'A',lineId:'S1',qty:3,price:100,memo:'첫째',supplier:'V'},{item:'A',lineId:'S2',qty:2,price:200,memo:'둘째',custom:{batch:'B'}}];const staged=E.stageDocuments(db,draft('request'),{grouping:'line',selections:order.lines.map(l=>({documentId:'O',item:'A',lineId:l.lineId}))});assert.deepEqual(staged.lines.map(l=>[l.qty,l.price,l.memo]),[[3,100,'첫째'],[2,200,'둘째']]);assert.deepEqual(staged.lines.map(l=>l.importedFrom[0].sourceLineId),['S1','S2']);assert.ok(staged.lines.every(l=>!l.sourceLineId));assert.deepEqual(staged.lines[1].custom,{batch:'B'});
});
test('line copy rejects excessive row count and linked metadata without changing drafts',()=>{
 const db=orderImportFixture(),selections=[{documentId:'O',item:'A'}];for(const input of [{...draft('request'),lines:Array.from({length:500},(_,i)=>({item:'A',qty:1,price:100,lineId:'L'+(i+1)}))},{...draft('request'),lines:[{item:'A',qty:1,price:100,lineId:'L1',sourceLineId:'S1'}]}]){const before=JSON.stringify(input);assert.throws(()=>E.stageDocuments(db,input,{grouping:'line',selections}),/500행|원본 연결/);assert.equal(JSON.stringify(input),before);}
});
