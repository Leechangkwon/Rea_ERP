#!/usr/bin/env node
'use strict';
// Differential evidence audit only. Never loads or executes original ECOUNT JavaScript.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),fixturePath=path.join(root,'tests/fixtures/transaction-vat-parity.json');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const {previewStaticCandidate}=require('./lib/transaction-vat-static-candidate.cjs');
const equalAmounts=(a,b)=>['supply','tax','total'].every(key=>a?.[key]===b?.[key]);
function verifyEvidence(sources){
  const checked={};
  for(const [name,source] of Object.entries(sources)){
    const file=path.resolve(root,source.path),artifactRoot=path.join(root,'.artifacts')+path.sep;
    if(!file.startsWith(artifactRoot))throw Error('Evidence must be inside .artifacts');
    const actual=hash(fs.readFileSync(file));if(actual!==source.sha256)throw Error(name+' evidence hash changed');
    checked[name]={sha256:actual,verified:true};
  }
  const original=sources.original,manifest=JSON.parse(fs.readFileSync(path.join(root,original.sourceManifest),'utf8'));
  if(!manifest.sources.some(source=>source.file===original.path&&source.sha256===original.sha256))throw Error('Original provenance does not match');
  return checked;
}
function validateComparisonInput(input){
  const supply=input?.supplyRounding,tax=input?.taxRounding;
  if(input?.type!=='request'||input.currency!=='KRW'||![0,10].includes(input.vatRate)||!supply||!tax||supply.digits!==tax.digits||![0,1,2].includes(supply.digits)||![supply.method,tax.method].every(method=>['round','floor','ceil'].includes(method)))throw Error('Static comparison requires explicitly matched source precision and supported KRW/rate policies');
  if(!Array.isArray(input.lines)||!input.lines.length||Array.from(input.lines).some(line=>!line||!Number.isFinite(line.qty)||line.qty<=0||!Number.isFinite(line.price)||line.price<=0||line.discount!==undefined&&line.discount!==0||line.vatRate!==undefined&&line.vatRate!==input.vatRate))throw Error('Static comparison excludes direct amounts, nonpositive input, discounts and mixed VAT');
}
function audit({fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8')),preview=require('../dist/transaction-vat-core.js').preview,verifySources=false}={}){
  if(fixtures.version!==1||!Array.isArray(fixtures.cases)||!fixtures.cases.length||!Array.isArray(fixtures.unverified)||!fixtures.unverified.length)throw Error('Parity evidence fixture is incomplete');
  const ids=new Set();
  const cases=Array.from(fixtures.cases,item=>{
    if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||item.originalRuntimeObserved!==false)throw Error('Synthetic evidence must have unique IDs and cannot claim original runtime verification');
    ids.add(item.id);validateComparisonInput(item.input);
    for(const key of ['lineTotals','manualGrossInterpretation','staticRawSupplyInterpretation']){
      const value=item[key];if(!value||!['supply','tax','total'].every(k=>Number.isFinite(value[k])&&value[k]>=0)||Math.round(value.supply*100)+Math.round(value.tax*100)!==Math.round(value.total*100))throw Error('Invalid fixture amounts: '+item.id);
    }
    const result=preview(item.input),localMatches=equalAmounts(result.before,item.lineTotals)&&equalAmounts(result.after,item.manualGrossInterpretation),interpretationsAgree=equalAmounts(item.manualGrossInterpretation,item.staticRawSupplyInterpretation);
    // Synthetic baseline only: these row amounts come from our v1 fixture preview, not original input data.
    const candidate=previewStaticCandidate({basis:'domestic-price',currency:'KRW',vatRate:item.input.vatRate,digits:item.input.supplyRounding.digits,supplyMethod:item.input.supplyRounding.method,taxMethod:item.input.taxRounding.method,lines:item.input.lines.map((line,index)=>({id:'synthetic-'+index,item:line.item,qty:String(line.qty),price:String(line.price),supply:String(result.rows[index].before.supply),tax:String(result.rows[index].before.tax)}))});
    const candidateMatchesStaticInterpretation=equalAmounts(Object.fromEntries(Object.entries(candidate.after).map(([key,value])=>[key,Number(value)])),item.staticRawSupplyInterpretation);
    return {id:item.id,candidateMatchesStaticInterpretation,candidateBaseline:'synthetic-v1-preview-rows-not-original-observation',candidate,localMatchesManualInterpretation:localMatches,interpretationsAgree,current:{before:result.before,after:result.after},manualGrossInterpretation:item.manualGrossInterpretation,staticRawSupplyInterpretation:item.staticRawSupplyInterpretation,reason:item.reason,originalRuntimeObserved:false};
  });
  const candidateRegressions=cases.filter(x=>!x.candidateMatchesStaticInterpretation).length,regressions=cases.filter(x=>!x.localMatchesManualInterpretation||!x.candidateMatchesStaticInterpretation).length,conflicts=cases.filter(x=>!x.interpretationsAgree).length;
  return {schemaVersion:1,status:regressions?'local-regression':'unresolved-evidence-conflict',fixtureSha256:hash(JSON.stringify(fixtures)),sources:fixtures.sources,sourceIntegrity:verifySources?verifyEvidence(fixtures.sources):{verified:false,reason:'Private source files were not requested; fixture-only audit.'},scope:fixtures.scope,caseCount:cases.length,candidateRegressionCount:candidateRegressions,regressionCount:regressions,agreementCount:cases.length-conflicts,conflictCount:conflicts,unverified:fixtures.unverified,cases,originalSourceExecuted:false,originalParityPassed:false,productionDataRead:false};
}
function exitCode(result,requireParity=false){return result.regressionCount?1:requireParity&&!result.originalParityPassed?2:0;}
function cli(args){
  let output,requireParity=false,verifySources=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--output'){output=args[++i];if(!output||output.startsWith('--'))throw Error('--output requires a file');}
    else if(args[i]==='--require-parity')requireParity=true;
    else if(args[i]==='--verify-evidence')verifySources=true;
    else throw Error('Unknown argument: '+args[i]);
  }
  const result=audit({verifySources});
  if(output){const file=path.resolve(output);if(!file.startsWith(path.join(root,'.artifacts')+path.sep))throw Error('Audit output must be inside .artifacts');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify({status:result.status,caseCount:result.caseCount,candidateRegressionCount:result.candidateRegressionCount,regressionCount:result.regressionCount,agreementCount:result.agreementCount,conflictCount:result.conflictCount,sourceIntegrityChecked:verifySources,originalParityPassed:result.originalParityPassed,originalSourceExecuted:false}));
  return exitCode(result,requireParity);
}
module.exports={audit,exitCode,verifyEvidence};
if(require.main===module){try{process.exitCode=cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
