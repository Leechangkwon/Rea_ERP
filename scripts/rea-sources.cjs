// Read-only availability audit of the historical capture manifest; never fetches sources.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sources=JSON.parse(fs.readFileSync(path.join(root,'evidence/self-public-sources.json')));
const records=sources.map(s=>{
  if(path.basename(s.name)!==s.name)throw Error('Unsafe source name');
  const relative='analysis/source-self/'+s.name,file=path.join(root,relative);
  const status=!fs.existsSync(file)?'missing':crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===s.sha256?'verified':'hash-mismatch';
  return {file:relative,expectedSha256:s.sha256,status};
});
const current=JSON.parse(fs.readFileSync(path.join(root,'evidence/global-rea-20261018/current-release.json')));
const result={schema:1,scope:'Historical 11-source capture manifest only; not the entire retained corpus',currentCorpusRecordedBodies:current.current_REA_corpus.unique_bodies,records,
  rawAnalyses:['original','baseline','rebuilt'].map(name=>({name,present:fs.existsSync(path.join(root,'.artifacts/rea-'+name+'.json'))})),
  automaticDownload:false};
fs.mkdirSync(path.join(root,'.artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'.artifacts/rea-source-availability.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(records.some(r=>r.status==='hash-mismatch'))process.exitCode=1;
