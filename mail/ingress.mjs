// Shared by the independent cloud ingress and isolated synthetic tests.
const utf8=new TextEncoder(),MAX_RAW=8*1024*1024;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const address=value=>{const s=String(value||'').trim().toLowerCase();if(s.length>254||!(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/).test(s)||/[\r\n\x00-\x20]/.test(s))throw Error('invalid_address');return s;};
const cleanHeader=(value,max)=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
export function plainHtml(value){return String(value||'').replace(/<(script|style|template|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<(br|\/p|\/div|\/tr|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,key)=>{const x=key.toLowerCase();if(x[0]==='#'){const n=parseInt(x.slice(x[1]==='x'?2:1),x[1]==='x'?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[x];}).trim();}
export function createIngress({store,parseMime}){return async function(request){const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});try{
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token||!await store.token(await digest(utf8.encode(token))))return json({error:'unauthorized'},401);
 const recipient=address(request.headers.get('x-rea-recipient')),boxes=await store.boxes(),box=boxes.find(b=>b.enabled&&b.address===recipient);if(!box)return json({error:'unknown_mailbox'},404);
 const reader=request.body?.getReader();if(!reader)return json({error:'empty_email'},400);let size=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RAW){await reader.cancel();return json({error:'message_too_large'},413);}parts.push(value);}if(!size)return json({error:'empty_email'},400);
 const raw=new Uint8Array(size);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}const source=await digest(raw),existing=await store.source(box.id,source);if(existing)return json({received:true,duplicate:true});
 let mime;try{mime=await parseMime(raw);}catch{return json({error:'invalid_mime'},400);}
 const safeAddress=value=>{try{return address(value);}catch{return '';}},sender=safeAddress(mime.from?.address)||safeAddress(request.headers.get('x-rea-envelope-from')),extract=value=>[...new Set((value||[]).map(x=>safeAddress(x.address)).filter(Boolean))].slice(0,20);
 const text=String(mime.text||plainHtml(mime.html)||'').replace(/\x00/g,'');if(text.length>64000||(mime.attachments||[]).length>10)return json({error:'message_too_large'},413);
 const id=crypto.randomUUID(),at=new Date().toISOString(),attachments=[],uploaded=[];let total=0;
 for(const a of mime.attachments||[]){const content=new Uint8Array(a.content);total+=content.length;if(total>6*1024*1024)return json({error:'attachments_too_large'},413);}
 let parent=null;const inReplyTo=cleanHeader(mime.inReplyTo,998);if(inReplyTo)parent=await store.messageByHeader(box.id,inReplyTo);if(parent&&!((parent.to||[]).includes(sender)||(parent.cc||[]).includes(sender)||parent.sender===sender))parent=null;
 const row={id,mailbox_id:box.id,folder:'inbox',restore_folder:null,status:'received',sender,to:extract(mime.to),cc:extract(mime.cc),bcc:[],subject:cleanHeader(mime.subject,200),body:text,attachments,documents:[],document_ids:parent?.document_ids||[],thread_id:parent?.thread_id||id,in_reply_to:inReplyTo||null,message_id:cleanHeader(mime.messageId,998)||null,revision:0,created_by:'ingress',created_at:at,updated_at:at,read_by:[],provider:'cloudflare',source_id:source,request_id:null,request_hash:null,finished_at:null};if(!row.to.length)row.to=[recipient];row.search_text=[row.subject,sender,...row.to,...row.cc,text].join('\n').slice(0,70000);
 try{for(const a of mime.attachments||[]){const aid=crypto.randomUUID(),name=cleanHeader(a.filename||'attachment',180).replace(/[\\/<>:"|?*]/g,'_')||'attachment',key=box.id+'/'+id+'/'+aid;await store.upload(key,new Uint8Array(a.content));uploaded.push(key);attachments.push({id:aid,name,size:a.content.byteLength,storage_key:key});}
  const current=(await store.box(box.id));if(!current?.enabled||current.address!==recipient)throw Error('mailbox_changed');await store.create(row);
 }catch{
  // A timeout may follow a committed insert. Never remove attachments belonging to it.
  let found;try{found=await store.source(box.id,source);}catch{return json({error:'receive_result_unknown'},503);}
  if(found?.id===row.id)return json({received:true,duplicate:false});
  await store.removeFiles(uploaded).catch(()=>{});if(found)return json({received:true,duplicate:true});return json({error:'receive_failed'},503);
 }
 return json({received:true,duplicate:false});
 }catch{return json({error:'receive_unavailable'},503);}};}
