// Explicit one-time migration; never runs from server startup.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),net=require('node:net'),{execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite'),{readEnvironment,configuration}=require('./runtime-config.cjs'),{createSupabaseDB}=require('../worker/supabase-db.cjs');
const definitions=[{source:'app_state',target:'rea_app_state',id:'main',limit:2500000},{source:'gateway_state',target:'rea_gateway_state',id:'sandbox',limit:1500000}];
const fail=code=>{throw Object.assign(Error('Migration stopped; existing data preserved. See the private backup manifest.'),{code});};
const same=(a,b)=>!!a&&!!b&&a.revision===b.revision&&a.body===b.body;
async function copyRows(rows,{read,insert}){
  // Check every destination before any write. Existing different data is never overwritten.
  const before={};
  for(const d of definitions){before[d.source]=await read(d);if(before[d.source]&&!same(rows[d.source],before[d.source]))fail('destination_conflict');}
  for(const d of definitions){const row=rows[d.source];if(!row||before[d.source])continue;await insert(d,row);if(!same(row,await read(d)))fail('destination_changed');}
  for(const d of definitions)if(rows[d.source]&&!same(rows[d.source],await read(d)))fail('verification_failed');
  return {passed:true,copied:definitions.filter(d=>rows[d.source]&&!before[d.source]).map(d=>d.target),identicalExisting:definitions.filter(d=>before[d.source]).map(d=>d.target)};
}
async function portIsOpen(port){return new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port});const done=value=>{socket.destroy();resolve(value);};socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1500,()=>done(true));});}
async function migrate(input=readEnvironment(),{apply=false,expectedProject}={}){
  const config=configuration(input);
  const remote=createSupabaseDB({url:input.SUPABASE_URL,key:input.SUPABASE_SECRET_KEY});await remote.probe();
  if(new URL(input.SUPABASE_URL).hostname.split('.')[0]!==expectedProject)fail('project_confirmation_required');
  if(!apply)fail('explicit_apply_required');
  if(await portIsOpen(config.port))fail('stop_local_server_first');
  if(!/^sb_secret_[A-Za-z0-9_-]{12,}$/.test(input.SUPABASE_SECRET_KEY))fail('modern_server_key_required');
  process.umask(0o077);
  const directory=path.join(os.homedir(),'.local/share/rea-erp/backups',new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.chmodSync(directory,0o700);
  const db=new DatabaseSync(config.sqliteFile);
  const snapshot={format:'rea-storage-cutover-v1',at:new Date().toISOString(),project:expectedProject,sourceFile:config.sqliteFile,completed:false};
  const manifest=()=>fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
  try{
    db.exec('BEGIN IMMEDIATE');
    const rows={};for(const d of definitions){const row=db.prepare('SELECT id,revision,body,updated_at FROM '+d.source+' WHERE id=?').get(d.id)||null;rows[d.source]=row;if(row){if(!Number.isInteger(row.revision)||row.revision<0||Buffer.byteLength(row.body)>d.limit)fail('invalid_source');JSON.parse(row.body);}}
    const state=rows.app_state&&JSON.parse(rows.app_state.body);if(!state?.users?.some(u=>u.roleId==='admin'&&u.status==='active'&&u.passwordHash))fail('source_administrator_required');
    execFileSync('python3',['-c','import sqlite3,sys; s=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()',config.sqliteFile,path.join(directory,'source.sqlite')],{stdio:'pipe'});
    fs.chmodSync(path.join(directory,'source.sqlite'),0o600);
    const backup=new DatabaseSync(path.join(directory,'source.sqlite'),{readOnly:true});
    try{for(const d of definitions){const row=backup.prepare('SELECT revision,body FROM '+d.source+' WHERE id=?').get(d.id)||null;if(rows[d.source]?!same(rows[d.source],row):row)fail('backup_mismatch');}}finally{backup.close();}
    const runtimeFile=input.REA_ENV_FILE||path.join(os.homedir(),'.config/rea-erp/runtime.env');
    fs.copyFileSync(runtimeFile,path.join(directory,'runtime.before.env'));fs.chmodSync(path.join(directory,'runtime.before.env'),0o600);
    const before={};for(const d of definitions)before[d.source]=await remote.prepare('SELECT revision, body FROM '+d.source+' WHERE id = ?').bind(d.id).first();
    fs.writeFileSync(path.join(directory,'remote-before.json'),JSON.stringify(before),{mode:0o600});
    snapshot.source=Object.fromEntries(definitions.map(d=>[d.source,rows[d.source]?{revision:rows[d.source].revision,bodySha256:crypto.createHash('sha256').update(rows[d.source].body).digest('hex')}:null]));manifest();
    const result=await copyRows(rows,{read:d=>remote.prepare('SELECT revision, body FROM '+d.source+' WHERE id = ?').bind(d.id).first(),insert:async(d,row)=>{
      const url=new URL('/rest/v1/'+d.target,input.SUPABASE_URL);url.searchParams.set('on_conflict','id');
      let response;try{response=await fetch(url,{method:'POST',headers:{apikey:input.SUPABASE_SECRET_KEY,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row),redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)fail('migration_insert_failed');if(response.body)await response.body.cancel();}catch{fail('migration_insert_failed');}
    }});
    snapshot.completed=true;snapshot.result=result;snapshot.accounts=state.users.length;snapshot.passwordHashesPreserved=true;snapshot.localSourcePreserved=true;manifest();
    return {...result,accounts:state.users.length,passwordHashesPreserved:true,sourcePreserved:true,privateBackupDirectory:directory};
  }catch(error){snapshot.errorCode=error.code||'migration_failed';manifest();throw error;}finally{try{db.exec('ROLLBACK');}finally{db.close();}}
}
if(require.main===module)migrate(readEnvironment(),{apply:process.argv.includes('--apply'),expectedProject:process.argv.find(a=>a.startsWith('--project='))?.slice(10)}).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({passed:false,code:error.code||'migration_failed',message:'Migration stopped; do not switch the running backend until verification succeeds.'}));process.exitCode=1;});
module.exports={copyRows,migrate};
