'use strict';
const {readEnvironment,configuration}=require('./runtime-config.cjs'),{createSupabaseDB}=require('../worker/supabase-db.cjs');
const fail=code=>{throw Object.assign(Error('Cloudflare 연결 전 로컬 서버·Supabase·관리자 등록을 확인하세요.'),{code});};
async function check(input=readEnvironment(),{DB,fetchImpl=fetch}={}){
  const config=configuration(input);
  if(config.backend!=='supabase')fail('supabase_backend_required');
  if(config.publicOrigin!=='https://rea.qaredi.com')fail('confirmed_public_origin_required');
  DB||=createSupabaseDB({url:input.SUPABASE_URL,key:input.SUPABASE_SECRET_KEY,fetchImpl});
  await DB.probe();
  const row=await DB.prepare('SELECT revision, body FROM app_state WHERE id = ?').bind('main').first();
  if(!row||!JSON.parse(row.body).users?.some(user=>user.roleId==='admin'&&user.status==='active'))fail('supabase_administrator_required');
  async function local(route){
    const response=await fetchImpl('http://127.0.0.1:'+config.port+route,{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)fail('local_runtime_unavailable');
    return response.json();
  }
  const health=await local('/__rea/health');
  if(health.runtime!=='standalone'||health.backend!=='supabase'||health.publicOrigin!==config.publicOrigin||health.supabaseProjectRef!==new URL(input.SUPABASE_URL).hostname.split('.')[0])fail('running_runtime_mismatch');
  if(!(await local('/api/auth/status')).initialized)fail('running_administrator_required');
  return {passed:true,publicOrigin:config.publicOrigin,backend:'supabase',administratorReady:true,readOnly:true,dnsChanged:false};
}
if(require.main===module)check().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({passed:false,code:error.code||'connection_failed',message:'로컬 서버를 올바른 Supabase 설정으로 시작하고 최초 관리자를 등록한 뒤 다시 검사하세요.'}));process.exitCode=1;});
module.exports={check};
