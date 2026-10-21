'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),P=require('../dist/purchasing-report-core.js');
function fixture({qty=10,price=100,returned=3}={}){
 let db=C.empty();db.masters=C.clone(C.seed().masters);
 const purchase=C.command(db,'document',{type:'purchase',date:'2026-10-01',warehouse:'W001',partner:'V001',vatRate:10,lines:[{item:'M001',qty,price}]});db=purchase.db;
 const credit=C.command(db,'convert',{id:purchase.result.id,type:'purchasereturn',date:'2026-10-02',settlementMode:'credit',quantities:{M001:returned}});db=credit.db;
 return {db,purchase:db.documents.find(d=>d.id===purchase.result.id),credit:db.documents.find(d=>d.id===credit.result.id)};
}
const amounts=r=>[r.summary.quantity,r.summary.supply,r.summary.tax];
test('saved purchase and legacy credit return project signed all/normal/return without changing documents, stock, payable or backup',()=>{
 const {db,purchase,credit}=fixture(),before=JSON.stringify(db),report=P.search(db,'purchase');
 assert.deepEqual(amounts(report),[7,700,70]);assert.deepEqual(amounts(P.search(db,'purchase',{purchaseKind:'normal'})),[10,1000,100]);assert.deepEqual(amounts(P.search(db,'purchase',{purchaseKind:'return'})),[-3,-300,-30]);
 assert.equal(report.purchaseKindLabel,'구매구분 전체');assert.equal(report.rowRecords[0].document,purchase);assert.equal(report.rowRecords[1].document,credit);assert.equal(report.rowRecords[1].line,credit.lines[0]);assert.equal(report.rows[1][8],110);assert.equal(report.rows[1][14],-330);
 assert.equal(C.stock(db,'M001','W001'),7);assert.equal(C.outstanding(db,'payable','V001'),770);assert.equal(JSON.stringify(db),before);assert.deepEqual(C.validateBackup(C.clone(db)).documents,db.documents);
});
test('frozen fractional return tax is negated exactly rather than recomputed using negative rounding',()=>{
 const {db,credit}=fixture({qty:3,price:5,returned:1}),r=P.search(db,'purchase',{purchaseKind:'return'}),frozen=C.effectiveLineTotals(credit,credit.lines[0]);
 assert.equal(frozen.tax,.67);assert.deepEqual(r.groups[0].lines[0].amount,{...frozen,qty:-1,supply:-5,tax:-.67,total:-5.67});
});
test('legacy exchange and replacement have zero financial effect and cancelled returns remain excluded',()=>{
 let {db,purchase}=fixture();const exchange=C.command(db,'convert',{id:purchase.id,type:'purchasereturn',date:'2026-10-03',settlementMode:'exchange',quantities:{M001:2}});db=exchange.db;db=C.command(db,'convert',{id:exchange.result.id,type:'exchangereceipt',date:'2026-10-04',quantities:{M001:1}}).db;
 const cancelled=C.clone(db.documents.find(d=>d.type==='purchasereturn'&&d.settlementMode==='credit'));cancelled.id='CANCELLED-RETURN';cancelled.status='취소';db.documents.push(cancelled);
 const r=P.search(db,'purchase');assert.equal(r.rows.length,2);assert.deepEqual(amounts(r),[7,700,70]);assert.equal(r.groups.some(g=>g.document.id===cancelled.id),false);
});
test('all existing date, warehouse, supplier, item and currency predicates apply equally to credit returns',()=>{
 const {db}=fixture();assert.deepEqual(amounts(P.search(db,'purchase',{from:'2026-10-02',to:'2026-10-02',warehouse:'W001',partner:'V001',item:'M001',currency:'domestic'})),[-3,-300,-30]);
 for(const filter of [{partner:'V002'},{warehouse:'W002'},{item:'F001'},{currency:'foreign'},{from:'2026-10-03'}])assert.equal(P.search(db,'purchase',{...filter,purchaseKind:'return'}).rows.length,0);
 for(const value of ['bogus','__proto__',false,0,[]])assert.throws(()=>P.search(db,'purchase',{purchaseKind:value}),/구매구분/);assert.throws(()=>P.search(db,'request',{purchaseKind:'all'}),/구매구분/);
});
test('summary, subtotals, graph and drilldown use the same signed return rows and applied filter',()=>{
 const {db}=fixture(),filter={purchaseKind:'return',mode:'summary',axes:['거래처별','품목별'],axisSubtotals:[true,true]},r=P.search(db,'purchase',filter);
 assert.deepEqual([r.summary.quantity,r.summary.supply,r.summary.tax,r.summary.total],[-3,-300,-30,-330]);assert.equal(r.purchaseKindLabel,'구매구분 반품');assert.ok(r.rows.some(row=>row.includes(-330)));
 const graph=P.graphData(r,'quantity');assert.equal(graph.points[0].value,-3);const detail=P.drilldown(db,filter,JSON.stringify(r.records[0].axis));assert.equal(detail.purchaseKindLabel,'구매구분 반품');assert.equal(detail.rows.length,1);assert.equal(detail.rows[0][9],-3);assert.equal(detail.summary.total,-330);
});
test('line signs classify a mixed-sign report fixture without double-negation; does not enable saving negative purchase',()=>{
 const {db,purchase}=fixture();purchase.lines.push({...purchase.lines[0],lineId:'synthetic-negative',qty:-2});
 assert.deepEqual(amounts(P.search(db,'purchase',{purchaseKind:'normal'})),[10,1000,100]);assert.equal(P.search(db,'purchase',{purchaseKind:'return'}).summary.quantity,-5);assert.throws(()=>C.validateBackup(db));
});
test('UI pending filter, failed search, rewrite, snapshot, CSV and print preserve the last successful signed result',()=>{
 const dom=new JSDOM('<main></main>',{url:'https://erp.test/',runScripts:'outside-only'}),w=dom.window;
 try{
  for(const name of ['form-core.js','inventory-core.js','purchasing-report-core.js','purchasing-report-ui.js'])w.eval(fs.readFileSync('dist/'+name,'utf8'));
  const {db}=fixture(),before=JSON.stringify(db),host=w.document.querySelector('main'),exports=[],prints=[],ui=w.PurchasingReportUI.render(host,{config:{docType:'purchase'},db,onExport:r=>exports.push(r),onPrint:r=>prints.push(r)}),click=label=>[...host.querySelectorAll('button')].find(b=>b.textContent===label).click();
  ui.controls.from.value='2026-10-01';ui.controls.to.value='2026-10-31';assert.equal(ui.controls.purchaseKind.value,'all');ui.controls.purchaseKind.value='return';assert.equal(ui.run(),true);const result=ui.getResult();assert.match(host.querySelector('caption').textContent,/구매구분 반품/);
  ui.controls.purchaseKind.value='normal';click('Excel(화면)');click('인쇄');assert.equal(exports[0],result);assert.equal(prints[0],result);assert.equal(exports[0].rows[0][14],-330);
  const state=ui.snapshot();assert.equal(state.values.purchaseKind,'normal');assert.equal(state.currentFilter.purchaseKind,'return');ui.restore(state);assert.equal(ui.controls.purchaseKind.value,'normal');assert.equal(ui.getResult().purchaseKind,'return');
  ui.controls.from.value='2027-01-01';assert.equal(ui.run(),false);assert.equal(ui.getResult().purchaseKind,'return');click('다시작성');assert.equal(ui.controls.purchaseKind.value,'return');assert.equal(ui.controls.from.value,'2026-10-01');assert.equal(JSON.stringify(db),before);
 }finally{w.close();}
});
