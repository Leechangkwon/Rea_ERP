const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assetURL = 'https://resource.ecount.com/ec5/static/ecountv5/presentation/app.login/app.login.erp_login/app.login.erp_login.827a45ec.20.js';
const fixture = () => ({
  schemaVersion:1,captureId:'ecount-login-20261019',capturedAt:'2026-10-19T02:12:22+09:00',
  source:{kind:'windows-in-app-browser',method:'accessibility-and-read-only-dom'},
  page:{url:'https://login.ecount.com/',title:'이카운트 로그인 | ECOUNT',screen:'login'},
  controls:[{tag:'input',type:'password',id:'passwd',label:''}],
  assets:[{url:assetURL,kind:'javascript',purpose:'login-screen-static-analysis'}],
  observations:['The browser title and login-screen controls were read directly in the Windows in-app browser.','The asset URL was read from a script element in the same page.','Only control metadata was collected; no input contents were read.'],
  unverified:['Successful sign-in and authenticated ERP screens.','The meaning or behavior of the menu requested by the original URL fragment.','Server-side implementation and live business behavior.'],
});

test('handoff accepts password-field structure and rejects values, secrets and business records',async()=>{
  const {validateHandoff} = await import('../scripts/browser-handoff.mjs');
  assert.equal(validateHandoff(fixture()).controls[0].type,'password');
  for (const key of ['value','secret','cookie','headers','businessData']) {
    const data=fixture(); data.controls[0][key]='PRIVATE_SENTINEL';
    assert.throws(()=>validateHandoff(data),error=>/HANDOFF_SCHEMA/.test(error.message)&&!error.message.includes('PRIVATE_SENTINEL'));
  }
  for (const mutate of [
    data=>data.controls[0].label='고객명: PRIVATE_SENTINEL',
    data=>data.observations[0]='secret=PRIVATE_SENTINEL',
    data=>data.page.title='회사 전표 PRIVATE_SENTINEL',
    data=>data.assets[0].headers={Authorization:'Bearer PRIVATE_SENTINEL'},
  ]) { const data=fixture(); mutate(data); assert.throws(()=>validateHandoff(data),/HANDOFF_/); }
});

test('handoff rejects schema changes, unsupported pages and malformed timestamps',async()=>{
  const {validateHandoff} = await import('../scripts/browser-handoff.mjs');
  for (const mutate of [
    data=>data.schemaVersion=2,data=>delete data.unverified,data=>data.source.kind='unverified',
    data=>data.captureId='../escape',data=>data.capturedAt='invalid',
    data=>data.page.url+='?session=PRIVATE_SENTINEL',data=>data.page.url+='#menu=505',
    data=>data.controls.push(data.controls[0]),data=>data.assets=[],
  ]) { const data=fixture(); mutate(data); assert.throws(()=>validateHandoff(data),/HANDOFF_/); }
});

test('handoff file errors and symlinks fail before analysis',async()=>{
  const {readHandoff} = await import('../scripts/browser-handoff.mjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rea-handoff-test-'));
  try {
    const file=path.join(dir,'valid.json'); fs.writeFileSync(file,JSON.stringify(fixture()));
    assert.equal(readHandoff(file).inputSha256.length,64);
    assert.throws(()=>readHandoff(path.join(dir,'absent.json')),/HANDOFF_PATH/);
    assert.throws(()=>readHandoff(dir),/HANDOFF_PATH/);
    const link=path.join(dir,'link.json'); fs.symlinkSync(file,link);
    assert.throws(()=>readHandoff(link),/HANDOFF_PATH/);
    fs.writeFileSync(file,'{"secret":"PRIVATE_SENTINEL",');
    assert.throws(()=>readHandoff(file),error=>/HANDOFF_JSON/.test(error.message)&&!error.message.includes('PRIVATE_SENTINEL'));
    fs.writeFileSync(file,' '.repeat(32769)); assert.throws(()=>readHandoff(file),/HANDOFF_PATH/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('asset URL rejects authenticated, redirected and non-static destinations',async()=>{
  const {downloadAsset} = await import('../scripts/browser-handoff.mjs');
  let fetchCalls=0;
  for (const url of [
    'http://127.0.0.1/source.js',assetURL+'?token=PRIVATE_SENTINEL',assetURL+'#fragment',
    assetURL.replace('resource.ecount.com','resource.ecount.com.evil.example'),
    assetURL.replace('https://','https://user:password@'),
    assetURL.replace('/app.login.erp_login.827a45ec.20.js','/../app.login.erp_login.827a45ec.20.js'),
    'file:///etc/passwd',
  ]) await assert.rejects(downloadAsset(url,async()=>{fetchCalls++;}),/HANDOFF_ASSET_URL/);
  assert.equal(fetchCalls,0);
  await assert.rejects(downloadAsset(assetURL,async()=>new Response('',{status:302,headers:{location:'https://login.ecount.com/'}})),/HANDOFF_DOWNLOAD/);
});

test('anonymous download refuses login HTML, oversize content and unexpected response URLs',async()=>{
  const {downloadAsset} = await import('../scripts/browser-handoff.mjs');
  for (const response of [
    new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),
    new Response('<!doctype html><html>login</html>',{headers:{'content-type':'application/javascript'}}),
    new Response('x',{headers:{'content-type':'application/javascript','content-length':String(5*1024*1024)}}),
    new Response(' '.repeat(4*1024*1024+1),{headers:{'content-type':'application/javascript'}}),
    {status:200,redirected:false,url:'https://login.ecount.com/'},
  ]) await assert.rejects(downloadAsset(assetURL,async()=>response),/HANDOFF_DOWNLOAD/);
  const downloaded=await downloadAsset(assetURL,async(url,options)=>{
    assert.equal(url,assetURL); assert.equal(options.redirect,'error'); assert.equal(options.credentials,'omit'); assert.equal(options.headers,undefined);
    return new Response('function fixtureOnly() { return true; }',{headers:{'content-type':'application/javascript; charset=utf-8'}});
  });
  assert.equal(downloaded.manifest.sha256.length,64);
  assert.equal(downloaded.manifest.bytes,downloaded.bytes.length);
});
