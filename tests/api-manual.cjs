const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{JSDOM}=require('jsdom');
const M=require('../dist/api-manual-data.js'),A=require('../dist/api-core.js'),C=require('../dist/inventory-core.js'),{createGateway}=require('../worker/gateway.cjs'),{sqliteD1}=require('../scripts/sqlite-d1.cjs');
function fixture(){const DB=sqliteD1(),handler=createGateway();return {DB,async call(route,body,headers={}){const res=await handler(new Request('https://erp.test'+route,{method:body===undefined?'GET':'POST',headers:{'oai-authenticated-user-id':'manual-fixture',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),{DB},{user:{id:'owner'},permissions:['*']});return {status:res.status,value:await res.json()};}};}
function dom(hash='intro'){const d=new JSDOM(fs.readFileSync('dist/api-manual.html','utf8'),{url:'https://erp.test/api-manual#'+hash,runScripts:'outside-only'});d.window.scrollTo=()=>{};d.window.fetch=()=>{throw Error('Manual must not call an API');};for(const file of ['item-core.js','api-manual-data.js','api-manual.js'])d.window.eval(fs.readFileSync('dist/'+file,'utf8'));return d;}
const visit=(d,id)=>{d.window.history.replaceState(null,'','#'+id);d.window.dispatchEvent(new d.window.HashChangeEvent('hashchange'));};
test('manual covers every gateway method and route, including owner administration',()=>{
  const src=fs.readFileSync('worker/gateway.cjs','utf8'),getBlock=src.slice(src.indexOf("if(request.method==='GET')"),src.indexOf("if(request.method!=='POST')"));
  const routes=s=>[...s.matchAll(/['"](\/api\/(?:v1|admin)\/[^'"\s]+)['"]/g)].map(x=>x[1]).filter(x=>!x.endsWith('/'));
  const expected=new Set(routes(getBlock).map(p=>'GET '+p));for(const p of routes(src.slice(src.indexOf("const body=await readBody"))))expected.add('POST '+p);
  for(const p of ['/api/admin/outbox/{id}/deliver','/api/admin/keys/{id}/revoke','/api/v1/events/{id}/process'])expected.add('POST '+p);
  const actual=new Set(M.endpoints.map(e=>e.method+' '+e.path));assert.deepEqual(new Set(M.endpoints.filter(e=>/^\/api\/(v1|admin)\//.test(e.path)).map(e=>e.method+' '+e.path)),expected);assert.equal(actual.size,39);assert.equal(M.endpoints.filter(e=>e.scope==='owner').length,11);
  const spec=A.openapi('https://erp.test'),ops=Object.entries(spec.paths).flatMap(([p,ms])=>Object.keys(ms).map(m=>m.toUpperCase()+' '+p));assert.deepEqual(new Set(ops),actual);assert.equal(spec.info.version,require('../package.json').version);
  for(const e of M.endpoints){assert.ok(e.summary&&e.response.length&&e.result);assert.ok(e.request.every(f=>f.name&&f.type&&f.required&&f.description));assert.ok(spec.paths[e.path][e.method.toLowerCase()]['x-owner-session-required']===(e.scope==='owner'));}
});
test('28 provider entries and all reverse references are complete without implying unsupported APIs',()=>{
  assert.equal(M.providers.length,28);assert.equal(new Set(M.providers.map(x=>x.id)).size,28);assert.equal(M.providers.filter(x=>!x.ours.length).length,7);
  for(const p of M.providers){assert.ok(p.path.startsWith('/')&&!p.path.includes('?'));for(const id of p.ours)assert.ok(M.endpoints.find(e=>e.id===id).peers.includes(p.id));}
  for(const e of M.endpoints)for(const id of e.peers)assert.ok(M.providers.find(p=>p.id===id).ours.includes(e.id));
  assert.equal(new URL(M.officialManual).searchParams.size,1);assert.ok(M.providers.find(x=>x.id==='ecount-invoice').status.includes('미제공'));
});
test('document fields match actual whitelist and all 22 documented types accept common inputs',()=>{
  assert.equal(M.documentTypes.length,Object.keys(C.types).length);assert.deepEqual(new Set(M.documentTypes.map(x=>x[0])),new Set(Object.keys(C.types)));
  const input=M.documentFields.filter(x=>!x.name.includes('[]')).map(x=>x.name),sample=Object.fromEntries(input.map(x=>[x,x==='lines'?[{item:'P001',qty:1}]:x]));
  assert.deepEqual(new Set(Object.keys(A.documentInput(sample)).filter(x=>x!=='status')),new Set(input));
  for(const [type]of M.documentTypes){let db=C.seed();const payload={...M.sampleDocument,type};if(type==='transfer')payload.targetWarehouse='W002';if(['purchasereturn','exchangereceipt'].includes(type)){let source=C.command(db,'document',{...M.sampleDocument,type:'purchase'});db=source.db;if(type==='exchangereceipt'){source=C.command(db,'convert',{id:source.result.id,type:'purchasereturn',settlementMode:'exchange',date:M.sampleDocument.date});db=source.db;}payload.sourceId=source.result.id;payload.settlementMode='exchange';}assert.ok(C.command(db,'document',A.documentInput(payload)).result.id);}
  assert.throws(()=>A.documentInput({...M.sampleDocument,lines:Array.from({length:101},()=>M.sampleDocument.lines[0])}));
});
test('purchasing OAPI manual lists every implemented action and preserves financial source descriptions',()=>{
  const source=fs.readFileSync('dist/purchase-room-core.js','utf8'),actual=new Set([...source.matchAll(/'((?:inspection|rack|mail|reconciliation|tax|payment|analysis|draft|count|asset|check|closing)\.[a-z]+)'/g)].map(m=>m[1]));assert.deepEqual(new Set(M.purchasingActions.map(a=>a[0])),actual);assert.equal(M.purchasingActions.length,23);for(const row of M.purchasingActions){assert.equal(row.length,4);assert.equal(row[1],'write');assert.ok(row[2].includes('필수'));assert.ok(row[3].startsWith('Result='));}
  const endpoint=M.endpoints.find(e=>e.id==='purchasing-command');assert.equal(endpoint.actions,M.purchasingActions);assert.ok(endpoint.notes.some(n=>n.includes('외부')&&n.includes('송신하지')));assert.ok(endpoint.notes.some(n=>n.includes('별도')));assert.ok(M.documentResult.find(f=>f.name.endsWith('sourceAmounts')));assert.ok(M.documentResult.find(f=>f.name.endsWith('returnAmounts')));const spec=M.openapi('https://erp.test');assert.deepEqual(new Set(spec.paths['/api/v1/purchasing'].post.requestBody.content['application/json'].schema.properties.action.enum),actual);assert.equal(spec.paths['/api/v1/documents/convert'].post.requestBody.content['application/json'].schema.properties.quantities.type,'object');
});
test('every documented API is callable against isolated fixtures and documented status envelopes match',async()=>{
  const f=fixture(),seen=new Set();async function call(id,body,pathOverride){const e=M.endpoints.find(x=>x.id===id),r=await f.call(pathOverride||e.path,body===undefined?e.method==='POST'?e.example:undefined:body,e.idempotent?{'Idempotency-Key':'manual-'+id}:{});assert.equal(r.status,200,id+': '+JSON.stringify(r.value));seen.add(id);for(const key of Object.keys(e.result))assert.ok(Object.hasOwn(r.value,key),id+' missing '+key);return r.value;}
  try{
    await call('seed');await call('status');await call('capabilities');await call('openapi');await call('items-list');await call('items-create');await call('partners-list');await call('partners-create');await call('warehouses-list');const documents=await call('documents-list');const quote=documents.data.find(d=>d.type==='quote');await call('documents-convert',{id:quote.id,type:'order',quantities:{P001:1}});await call('purchasing-command');await call('purchasing-read');
    const doc=await call('documents-create');assert.equal(doc.data.lines[0].total,44000);assert.equal(doc.data.total,undefined);await call('stock-list');
    const profile=await call('profiles-create'),preview=await call('mapping-preview',{profileId:profile.id,data:M.sampleDocument});assert.equal(preview.valid,true);
    const ev=await call('events-create');await call('events-list');const processed=await call('events-process',{},'/api/v1/events/'+ev.eventId+'/process');assert.equal(processed.status,'done');
    const key=await call('keys-create');await call('keys-revoke',{},'/api/admin/keys/'+key.info.id+'/revoke');
    const snap=await call('snapshot');assert.ok(!snap.backup.keys&&!snap.backup.outbox);await call('reconcile');await call('bridge-preview',{backup:snap.backup});
    const overview=await call('admin-overview'),out=await call('outbox-deliver',{profileId:profile.id},'/api/admin/outbox/'+overview.outbox[0].id+'/deliver');assert.equal(out.internalTest,true);assert.equal(out.result.status,'sent');await call('logs-list');
    const g=fixture();try{const b=C.seed(),p=await g.call('/api/admin/bridge/preview',{backup:b}),r=await g.call('/api/admin/bridge/import',{backup:b,revision:p.value.revision});assert.equal(r.status,200);assert.equal(r.value.imported,true);seen.add('bridge-import');}finally{g.DB.close();}
    assert.equal(seen.size,29);
  }finally{f.DB.close();}
});
test('manual highlights HTTP 200 event failure and sender state separately from success',async()=>{
  const f=fixture();try{await f.call('/api/admin/seed',{});const ev=await f.call('/api/v1/events',{eventId:'bad-inventory',eventType:'document.create',data:{...M.sampleDocument,lines:[{item:'P001',qty:100000,price:20000}]}},{'Idempotency-Key':'bad'}),r=await f.call('/api/v1/events/'+ev.value.eventId+'/process',{});assert.equal(r.status,200);assert.equal(r.value.status,'failed');assert.ok(M.endpoints.find(e=>e.id==='events-process').response.some(x=>x.description.includes('HTTP 200')));assert.ok(M.endpoints.find(e=>e.id==='outbox-deliver').notes.some(x=>x.includes('unknown')));}finally{f.DB.close();}
});
test('all manual pages render, deep-link, and stay read-only',()=>{
  const d=dom('documents-create');try{assert.equal(d.window.document.querySelector('h1').textContent,'공통 전표 입력');for(const id of ['intro','auth','types','cross-reference','faq',...M.endpoints.map(x=>x.id),...M.providers.map(x=>x.id)]){visit(d,id);assert.ok(d.window.document.querySelector('#content h1'));assert.equal(d.window.document.querySelector('#nav [aria-current=page]').getAttribute('href'),'#'+id);assert.ok(!d.window.document.querySelector('#content form'));assert.ok(!d.window.document.querySelector('#content input[type=password]'));}assert.equal(d.window.localStorage.length,0);assert.equal(d.window.sessionStorage.length,0);}finally{d.window.close();}
});
test('search, missing API filter, and bidirectional links work in the manual DOM',()=>{
  const d=dom();try{const w=d.window,q=w.document.getElementById('search');q.value='targetWarehouse';q.dispatchEvent(new w.Event('input'));assert.ok(w.document.querySelector('#nav a[href="#documents-create"]'));q.value='不存在的功能';q.dispatchEvent(new w.Event('input'));assert.ok(w.document.querySelector('#nav').textContent.includes('검색 결과가 없습니다'));q.value='';q.dispatchEvent(new w.Event('input'));
    visit(d,'cross-reference');const select=w.document.querySelector('[aria-label="대조 범위"]');select.value='missing';select.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelector('.card tbody').rows.length,7);
    visit(d,'documents-create');assert.ok(w.document.querySelector('#content a[href="#ecount-sale"]'));visit(d,'ecount-sale');assert.ok(w.document.querySelector('#content a[href="#documents-create"]'));assert.ok(w.document.querySelector('#content').textContent.includes('YYYYMMDD → YYYY-MM-DD'));assert.ok(w.document.querySelector('#content').textContent.includes('전처리 어댑터'));
  }finally{d.window.close();}
});
test('built Worker serves manual aliases and preserves API access checks',async()=>{
  const {default:worker}=await import(pathToFileURL(path.resolve('dist/server/index.js')).href+'?manual-test='+Date.now());for(const route of ['/api-manual','/api-manual/','/api-manual.html']){const r=await worker.fetch(new Request('https://erp.test'+route),{});assert.equal(r.status,200);assert.ok(r.headers.get('Content-Type').startsWith('text/html'));assert.ok((await r.text()).includes('id="content"'));}const r=await worker.fetch(new Request('https://erp.test/api/v1/items'),{});assert.equal(r.status,503);
});
