// Project-local Chromium setup; never requests sudo or changes system packages.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {browserEnvironment}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..');
function run(command,args,options={}){
  const r=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});
  if(r.status!==0)throw Error(command+' failed: '+(r.error?.message||r.status));
}
try{
  run(process.execPath,[path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js'),'install','chromium']);
  const {chromium}=require('@playwright/test');
  const executable=chromium.executablePath();
  if(process.platform==='linux'){
    const r=spawnSync('ldd',[executable],{encoding:'utf8',env:browserEnvironment()});
    if(/not found/.test(r.stdout||'')){
      if(process.arch!=='x64'||!fs.existsSync('/usr/bin/apt-get'))throw Error('Install Playwright OS dependencies for this Linux distribution');
      const missing=[...(r.stdout||'').matchAll(/(\S+) => not found/g)].map(m=>m[1]);
      const packages={'libnspr4.so':'libnspr4','libnss3.so':'libnss3','libnssutil3.so':'libnss3','libsmime3.so':'libnss3','libasound.so.2':'libasound2t64'};
      if(missing.some(name=>!packages[name]))throw Error('Additional OS libraries required: '+missing.join(', '));
      const directory=path.join(root,'.artifacts/browser-libs'),downloads=path.join(directory,'downloads');
      fs.mkdirSync(downloads,{recursive:true});
      run('apt-get',['download',...new Set(missing.map(name=>packages[name]))],{cwd:downloads});
      for(const file of fs.readdirSync(downloads).filter(f=>f.endsWith('.deb')))run('dpkg-deb',['-x',path.join(downloads,file),directory]);
      fs.writeFileSync(path.join(directory,'packages.json'),JSON.stringify({scope:'Local libraries only, Ubuntu x64',packages:fs.readdirSync(downloads).filter(f=>f.endsWith('.deb'))},null,2));
    }
  }
  (async()=>{const browser=await chromium.launch({headless:true,env:browserEnvironment()});await browser.close();console.log('Chromium launch: passed');})().catch(error=>{console.error(error.message);process.exitCode=1;});
}catch(error){console.error(error.message);process.exitCode=1;}
