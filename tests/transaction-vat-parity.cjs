const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const {audit,exitCode}=require('../scripts/audit-transaction-vat-parity.cjs');
const fixtures=require('./fixtures/transaction-vat-parity.json'),clone=value=>JSON.parse(JSON.stringify(value));
test('manual example alone is not parity: independent boundary fixtures expose five conflicts',()=>{
 const before=JSON.stringify(fixtures),result=audit();assert.equal(JSON.stringify(fixtures),before);
 assert.equal(result.caseCount,7);assert.equal(result.regressionCount,0);assert.equal(result.agreementCount,2);assert.equal(result.conflictCount,5);
 assert.equal(result.originalParityPassed,false);assert.equal(result.originalSourceExecuted,false);assert.equal(result.productionDataRead,false);
 const sameGross=result.cases.find(x=>x.id==='same-gross-different-tax');assert.equal(sameGross.current.after.total,sameGross.staticRawSupplyInterpretation.total);assert.notEqual(sameGross.current.after.tax,sameGross.staticRawSupplyInterpretation.tax);
 assert.equal(exitCode(result),0);assert.equal(exitCode(result,true),2);
});
test('silently replacing the saved manual contract with the static interpretation fails the diagnostic',()=>{
 const result=audit({preview:doc=>{const expected=fixtures.cases.find(row=>JSON.stringify(row.input)===JSON.stringify(doc));return {before:expected.lineTotals,after:expected.staticRawSupplyInterpretation};}});
 assert.equal(result.regressionCount,5);assert.equal(result.status,'local-regression');assert.equal(exitCode(result),1);assert.equal(exitCode(result,true),1);
});
test('no-conflict and passing local amounts still cannot certify unobserved original behavior',()=>{
 const limited=clone(fixtures);limited.cases=limited.cases.filter(x=>['manual-example','integer-no-difference'].includes(x.id));const result=audit({fixtures:limited});
 assert.equal(result.conflictCount,0);assert.equal(result.regressionCount,0);assert.equal(result.originalParityPassed,false);assert.equal(exitCode(result,true),2);
});
test('invalid, duplicate, sparse and runtime-claiming fixtures are rejected',()=>{
 for(const change of [d=>d.cases[0].originalRuntimeObserved=true,d=>d.cases[1].id=d.cases[0].id,d=>delete d.cases[0],d=>d.cases[0].lineTotals.tax=NaN,d=>d.cases[0].lineTotals.total++,d=>d.unverified=[]]){const next=clone(fixtures);change(next);assert.throws(()=>audit({fixtures:next}));}
});
test('CLI strict parity check is nonzero while diagnostic mode passes without private sources',()=>{
 const cwd=path.resolve(__dirname,'..'),run=(...args)=>spawnSync(process.execPath,['scripts/audit-transaction-vat-parity.cjs',...args],{cwd,encoding:'utf8'});
 const diagnostic=run();assert.equal(diagnostic.status,0);assert.equal(JSON.parse(diagnostic.stdout).originalParityPassed,false);
 const strict=run('--require-parity');assert.equal(strict.status,2);assert.equal(JSON.parse(strict.stdout).conflictCount,5);
 assert.equal(run('--unknown').status,1);assert.equal(run('--output').status,1);assert.equal(run('--output','../outside-audit.json').status,1);
});

test('source-model assumptions cannot silently mix precision or include unmodeled price/rate cases',()=>{
 for(const change of [d=>d.cases[0].input.taxRounding.digits=2,d=>delete d.cases[0].input.supplyRounding,d=>d.cases[0].input.vatRate=7,d=>d.cases[0].input.currency='USD',d=>d.cases[0].input.lines[0].price=0,d=>d.cases[0].input.lines[0].discount=5,d=>delete d.cases[0].input.lines[0]]){const next=clone(fixtures);change(next);assert.throws(()=>audit({fixtures:next}),/Static comparison/);}
});
