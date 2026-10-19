const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')),html=fs.readFileSync('dist/index.html','utf8');
assert.ok(html.includes('PREVIEW '+pkg.version),'Preview version must match package.json');
assert.ok(fs.readFileSync('dist/login.html','utf8').includes('v'+pkg.version),'Login version must match package.json');
const root=path.resolve('dist'),pages=fs.readdirSync(root).filter(f=>f.endsWith('.html')),refs=pages.flatMap(page=>[...fs.readFileSync(path.join(root,page),'utf8').matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"#]+)"/g)].map(m=>m[1].replace(/^\//,'')));
for(const ref of refs){assert.ok(!/^(https?:|\/\/)/i.test(ref),'No external runtime assets');const p=path.resolve(root,ref);assert.ok(p.startsWith(root+path.sep)&&fs.statSync(p).isFile(),'Missing asset: '+ref);}
assert.ok(fs.statSync('dist/assets/fonticon.woff').size>0);
const files=fs.readdirSync('dist',{recursive:true}).filter(f=>!f.startsWith('server'+path.sep)&&!f.startsWith('.openai'+path.sep)&&fs.statSync(path.join('dist',f)).isFile());
const hashes={};for(const file of files){const bytes=fs.readFileSync(path.join('dist',file));hashes[file.replaceAll('\\','/')]=crypto.createHash('sha256').update(bytes).digest('hex');if(file.endsWith('.js'))new vm.Script(bytes.toString('utf8'),{filename:file});if(/\.(js|html|css|json)$/.test(file))assert.ok(!/ec_req_sid|document\.cookie|SESSION_ID|BB-ETw/.test(bytes.toString('utf8')),'Private session material in '+file);}
const result={status:'passed',version:pkg.version,static_files:files.length,referenced_assets:refs.length,checks:['Preview version','Local asset completeness','JavaScript parse','No source-session material'],hashes};
fs.writeFileSync('evidence/release-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,version:result.version,static_files:result.static_files,checks:result.checks.length}));
