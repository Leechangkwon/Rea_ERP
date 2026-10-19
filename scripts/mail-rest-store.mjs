// Service-only mailbox tables and private files. No credentials reach the browser.
export const BUCKET='rea-mail-files';
export function createMailStore({url,key,fetchImpl=fetch}){
 const base=new URL(url);if(base.protocol!=='https:'||!(/^[a-z0-9]{20}\.supabase\.co$/).test(base.hostname)||base.pathname!=='/'||base.search||base.hash||base.username||base.password||base.port)throw Error('Invalid mail storage configuration');
 const auth={apikey:key,...(!key.startsWith('sb_secret_')?{Authorization:'Bearer '+key}:{})};
 async function call(path,query={},method='GET',body,prefer){const target=new URL(path,base);for(const [k,v]of Object.entries(query))target.searchParams.set(k,String(v));let response;try{response=await fetchImpl(target,{method,headers:{...auth,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('mail_storage_unavailable');}if(!response.ok){if(response.status===409)throw Error('mail_conflict');throw Error('mail_storage_unavailable');}if(response.status===204||prefer==='return=minimal')return null;return response.json();}
 const rows=(table,q={},method='GET',body,prefer)=>call('/rest/v1/'+table,q,method,body,prefer);
 const first=async promise=>(await promise)?.[0]||null;
 const safeKey=key=>{if(typeof key!=='string'||!/^([a-f0-9-]{36}\/){2}[a-f0-9-]{36}$/.test(key))throw Error('Invalid attachment key');return key;};
 return {
  async probe(){await rows('rea_mailboxes',{select:'id',limit:0});await rows('rea_mail_messages',{select:'id',limit:0});},
  boxes:()=>rows('rea_mailboxes',{select:'*',order:'address.asc'}),
  box:id=>first(rows('rea_mailboxes',{id:'eq.'+id,select:'*',limit:1})),
  async saveBox(row,revision){if(revision===null)return first(rows('rea_mailboxes',{select:'*'},'POST',row,'return=representation'));return first(rows('rea_mailboxes',{id:'eq.'+row.id,revision:'eq.'+revision,select:'*'},'PATCH',{...row,revision:revision+1},'return=representation'));},
  list:({box,folder,query='',offset=0})=>rows('rea_mail_messages',{mailbox_id:'eq.'+box,folder:'eq.'+folder,select:'id,mailbox_id,folder,status,sender,to,cc,subject,created_at,updated_at,read_by,attachments,document_ids,revision,thread_id,provider',order:'created_at.desc,id.desc',limit:51,offset,...(query?{search_text:'ilike.*'+query.replace(/[\\%_*]/g,x=>'\\'+x)+'*'}:{})}),
  message:id=>first(rows('rea_mail_messages',{id:'eq.'+id,select:'*',limit:1})),
  source:(box,source)=>first(rows('rea_mail_messages',{mailbox_id:'eq.'+box,source_id:'eq.'+source,select:'*',limit:1})),
  messageByHeader:(box,messageId)=>first(rows('rea_mail_messages',{mailbox_id:'eq.'+box,message_id:'eq.'+messageId,select:'*',limit:1})),
  create:row=>first(rows('rea_mail_messages',{select:'*'},'POST',row,'return=representation')),
  update:(id,revision,patch)=>first(rows('rea_mail_messages',{id:'eq.'+id,revision:'eq.'+revision,select:'*'},'PATCH',{...patch,revision:revision+1},'return=representation')),
  async token(hash){return !!(await first(rows('rea_mail_ingress_keys',{token_hash:'eq.'+hash,enabled:'eq.true',select:'id',limit:1})));},
  async upload(key,bytes){const response=await fetchImpl(new URL('/storage/v1/object/'+BUCKET+'/'+safeKey(key),base),{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream','x-upsert':'false'},body:bytes,redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('mail_attachment_unavailable');},
  async download(key){const response=await fetchImpl(new URL('/storage/v1/object/authenticated/'+BUCKET+'/'+safeKey(key),base),{headers:auth,redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('mail_attachment_unavailable');return new Uint8Array(await response.arrayBuffer());},
  async removeFiles(keys){if(keys.length)await call('/storage/v1/object/'+BUCKET,{},'DELETE',{prefixes:keys.map(safeKey)});}
 };
}
