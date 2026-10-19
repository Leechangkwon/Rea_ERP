const {test}=require('node:test');
const assert=require('node:assert/strict');
test('REA cache invalidates when source, input set or analysis settings change',async()=>{
  const {cacheKey}=await import('../scripts/rea-analyze.mjs');
  const a=[{file:'dist/menu-core.js',sha256:'a'}],options={heap:4096,timeout:45000};
  assert.equal(cacheKey(a,options),cacheKey(a,options));
  assert.notEqual(cacheKey(a,options),cacheKey([{...a[0],sha256:'b'}],options));
  assert.notEqual(cacheKey(a,options),cacheKey([...a,{file:'dist/app.js',sha256:'a'}],options));
  assert.notEqual(cacheKey(a,options),cacheKey(a,{...options,timeout:1000}));
});
test('REA inputs reject traversal, deployment bundles and external paths',async()=>{
  const {manifestFor}=await import('../scripts/rea-analyze.mjs');
  for(const input of ['../outside.js','dist/server/index.js','/tmp/input.js','analysis/original.js']) assert.throws(()=>manifestFor([input]),/first-party/);
  assert.equal(manifestFor(['dist/menu-core.js'])[0].sha256.length,64);
});
