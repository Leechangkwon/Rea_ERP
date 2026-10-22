'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../dist/self-core.js');
const App=require('../worker/app-service.cjs');
const {sqliteD1}=require('../scripts/sqlite-d1.cjs');
const password='synthetic-mapping-storage-fixture-2026!';
const clone=value=>JSON.parse(JSON.stringify(value));
const link=(source,target,context='input')=>({source:{context,id:source},target:{context,id:target}});
const links=()=>({version:1,entries:[link('memo','x_request_input_text1'),link('memo','x_request_input_long1'),link('memo','x_request_lines_memo1','lines')]});
const legacy=()=>({id:'MAP-LEGACY',from:'2-1-1-1',to:'2-2-0-1',enabled:true});
const rule=()=>({...legacy(),fieldLinks:links()});
async function fixture(companyCode='MAPTEST'){
  const DB=sqliteD1();let service=App.createService(),cookie='',csrf='';
  const call=async(path,data,headers={})=>{
    const response=await service.handle(new Request('https://erp.test'+path,{
      method:data===undefined?'GET':'POST',
      headers:{Origin:'https://erp.test',...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf}),...headers},
      ...(data===undefined?{}:{body:JSON.stringify(data)})
    }),{DB});
    if(response.headers.get('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
    return {status:response.status,value:await response.json()};
  };
  assert.equal((await call('/api/auth/setup',{companyCode,companyName:'합성 매핑회사',loginId:'admin',name:'합성 관리자',password},{'oai-authenticated-user-id':'fixture-owner'})).status,200);
  const login=async(loginId='admin')=>{const response=await call('/api/auth/login',{companyCode,loginId,password});csrf=(await call('/api/auth/status')).value.user?.csrfToken||'';return response;};
  assert.equal((await login()).status,200);
  const state=async()=>(await call('/api/self/state')).value;
  const action=async(action,payload,revision)=>(await call('/api/self/action',{action,payload,revision:revision??(await state()).revision}));
  const save=(value,revision)=>action('config.save',{key:'menuMappings',value},revision);
  return {DB,call,login,state,action,save,restart:()=>{service=App.createService();}};
}
test('legacy mappings and absent field links remain byte-equivalent without injected metadata',()=>{
  const value={rules:[legacy()]},before=JSON.stringify(value),out=S.validateConfig('menuMappings',value);
  assert.equal(JSON.stringify(out),before);assert.equal(JSON.stringify(value),before);
  assert.equal(Object.hasOwn(out.rules[0],'fieldLinks'),false);
  assert.deepEqual(S.validateConfig('menuMappings',{}),{rules:[]});
});
test('versioned same-context field links preserve explicit empty lists and do not alias caller data',()=>{
  const value={rules:[rule(),{id:'EMPTY',from:'from-menu',to:'to-menu',enabled:false,fieldLinks:{version:1,entries:[]}}]};
  const before=clone(value);Object.freeze(value.rules[0].fieldLinks.entries[0].source);
  const out=S.validateConfig('menuMappings',value);assert.deepEqual(out,before);
  out.rules[0].fieldLinks.entries[0].source.id='changed';assert.deepEqual(value,before);
  assert.deepEqual(out.rules[1].fieldLinks,{version:1,entries:[]});
});
test('field link structure rejects ambiguous targets, crossed models, unsafe IDs and unknown metadata atomically',()=>{
  const invalid=[null,[],{}, {version:2,entries:[]},{version:'1',entries:[]},{version:1,entries:null},{version:1,entries:[],extra:1},
    {version:1,entries:[{}]}, {version:1,entries:[{...link('memo','target'),extra:1}]},
    {version:1,entries:[{source:{context:'input',id:'memo',extra:1},target:{context:'input',id:'target'}}]},
    {version:1,entries:[{source:{context:'input',id:'memo'},target:{context:'lines',id:'target'}}]},
    {version:1,entries:[link('memo','target'),link('reference','target')]},
    {version:1,entries:new Array(1)},
    ...['',' memo','memo ','a.b','custom[x]','__proto__','prototype','constructor','한글','1field','a'.repeat(81)].map(id=>({version:1,entries:[link('memo',id)]})),
    ...[null,0,false,{},['memo']].map(id=>({version:1,entries:[link(id,'target')]})),
    {version:1,entries:[link('memo','target','print')]}
  ];
  for(const fieldLinks of invalid){const value={rules:[legacy(),{...rule(),id:'BAD',from:'a',to:'b',fieldLinks}]},before=JSON.stringify(value);assert.throws(()=>S.validateConfig('menuMappings',value));assert.equal(JSON.stringify(value),before);}
  const hundred=Array.from({length:100},(_,i)=>link('memo','target_'+i));
  assert.equal(S.validateConfig('menuMappings',{rules:[{...rule(),fieldLinks:{version:1,entries:hundred}}]}).rules[0].fieldLinks.entries.length,100);
  assert.throws(()=>S.validateConfig('menuMappings',{rules:[{...rule(),fieldLinks:{version:1,entries:[...hundred,link('memo','target_100')]}}]}));
  assert.equal({}.polluted,undefined);
});
test('authenticated config save reloads field links through fresh service, public context and backup without business changes',async()=>{
  const f=await fixture();try{
    const beforeBackup=(await f.call('/api/self/backup')).value,original=await f.state(),value={rules:[rule()]};
    assert.equal((await f.save(value,original.revision)).status,200);
    f.restart();assert.deepEqual((await f.state()).config.menuMappings,value);
    const auth=(await f.call('/api/auth/status')).value.user;assert.deepEqual(auth.settings.menuMappings,value);
    assert.ok(Number.isInteger(auth.settingsRevision));assert.equal(JSON.stringify(auth).includes('passwordHash'),false);
    const rawBefore=f.DB.raw.prepare('SELECT body,revision FROM app_state WHERE id = ?').get('main');
    await App.load(f.DB);await App.load(f.DB);
    assert.deepEqual(f.DB.raw.prepare('SELECT body,revision FROM app_state WHERE id = ?').get('main'),rawBefore);
    const afterBackup=(await f.call('/api/self/backup')).value;
    assert.deepEqual(afterBackup.config.menuMappings,value);assert.deepEqual(afterBackup.backup,beforeBackup.backup);
    for(const key of Object.keys(original.config).filter(key=>key!=='menuMappings'))assert.deepEqual((await f.state()).config[key],original.config[key]);
    assert.equal((await f.state()).users.length,original.users.length);
  }finally{f.DB.close();}
});
test('stale revision and malformed field link saves preserve all committed rules and reject partial updates',async()=>{
  const f=await fixture('MAPCAS');try{
    const initial=await f.state();assert.equal((await f.save({rules:[rule()]},initial.revision)).status,200);
    const stored=await f.state(),disabled={rules:stored.config.menuMappings.rules.map(r=>({...r,enabled:false}))};
    assert.equal((await f.save(disabled,initial.revision)).status,409);assert.deepEqual((await f.state()).config.menuMappings,stored.config.menuMappings);
    const invalid={rules:[legacy(),{...rule(),id:'BAD',from:'a',to:'b',fieldLinks:{version:1,entries:[link('memo','target'),link('date','target')]}}]};
    assert.equal((await f.save(invalid,stored.revision)).status,400);
    const after=await f.state();assert.equal(after.revision,stored.revision);assert.deepEqual(after.config.menuMappings,stored.config.menuMappings);
    assert.equal((await f.save(disabled,after.revision)).status,200);
    const toggled=await f.state();assert.equal(toggled.config.menuMappings.rules[0].enabled,false);assert.deepEqual(toggled.config.menuMappings.rules[0].fieldLinks,links());
    assert.equal((await f.save({rules:toggled.config.menuMappings.rules.map(r=>({...r,enabled:true}))},toggled.revision)).status,200);
    assert.deepEqual((await f.state()).config.menuMappings.rules[0].fieldLinks,links());
  }finally{f.DB.close();}
});
test('CSRF, config.write and company storage boundaries remain enforced for field-link mutations',async()=>{
  const left=await fixture('MAPLEFT'),right=await fixture('MAPRIGHT');try{
    const before=await left.state(),payload={action:'config.save',payload:{key:'menuMappings',value:{rules:[rule()]}},revision:before.revision};
    assert.equal((await left.call('/api/self/action',payload,{'X-CSRF-Token':''})).status,403);
    assert.deepEqual((await left.state()).config.menuMappings,before.config.menuMappings);
    assert.equal((await left.save({rules:[rule()]})).status,200);assert.deepEqual((await right.state()).config.menuMappings,{rules:[]});
    assert.equal((await left.action('user.save',{loginId:'viewer1',name:'합성 조회자',password,roleId:'viewer',status:'active'})).status,200);
    assert.equal((await left.login('viewer1')).status,200);const viewer=await left.state();
    assert.equal((await left.save({rules:[]},viewer.revision)).status,403);
    assert.deepEqual((await left.state()).config.menuMappings,{rules:[rule()]});
  }finally{left.DB.close();right.DB.close();}
});
test('unknown stored field link formats survive reads and unrelated setting saves without conversion',async()=>{
  const f=await fixture('MAPFUTURE');try{
    const loaded=await App.load(f.DB),future={rules:[{...legacy(),fieldLinks:{version:2,expression:{preserved:'unknown future format'}}}]};
    loaded.state.config.menuMappings=clone(future);
    f.DB.raw.prepare('UPDATE app_state SET body = ? WHERE id = ?').run(JSON.stringify(loaded.state),'main');
    const before=f.DB.raw.prepare('SELECT body,revision FROM app_state WHERE id = ?').get('main');
    assert.deepEqual((await App.load(f.DB)).state.config.menuMappings,future);
    assert.deepEqual(f.DB.raw.prepare('SELECT body,revision FROM app_state WHERE id = ?').get('main'),before);
    assert.deepEqual((await f.state()).config.menuMappings,future);
    assert.equal((await f.action('config.save',{key:'features',value:{allowNegative:true}})).status,200);
    assert.deepEqual((await f.state()).config.menuMappings,future);
    const latest=await f.state();assert.equal((await f.save(future,latest.revision)).status,400);
    assert.deepEqual((await f.state()).config.menuMappings,future);assert.equal((await f.state()).revision,latest.revision);
    assert.deepEqual((await f.call('/api/self/backup')).value.config.menuMappings,future);
  }finally{f.DB.close();}
});
