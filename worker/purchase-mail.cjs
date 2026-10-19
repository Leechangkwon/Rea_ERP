// Authenticated purchase-order mail. Durable reservation precedes any external effect.
'use strict';
const App=require('./app-service.cjs'),G=require('./gateway.cjs'),M=require('../dist/purchase-mail-core.js');
const fail=(status,code,message)=>{throw new App.AppError(status,code,message);},now=()=>new Date().toISOString();
const companyOf=s=>Object.fromEntries(['name','businessNumber','representative','phone','email','address'].map(k=>[k,String(s.company[k]||'')]));
const publicRecord=r=>({id:r.id,requestId:r.requestId,sender:r.sender||'',recipient:r.recipient,subject:r.subject,documentIds:r.documentIds,documentHashes:r.documentHashes,status:r.status==='sending'&&Date.now()-Date.parse(r.createdAt)>120000?'unknown':r.status,createdAt:r.createdAt,finishedAt:r.finishedAt||null,messageId:r.messageId,errorCode:r.errorCode||null});
async function readBody(request){if(!/application\/json/i.test(request.headers.get('content-type')||''))fail(415,'json_required','JSON 형식으로 요청하세요.');const reader=request.body?.getReader();if(!reader)fail(400,'body_required','메일 내용을 입력하세요.');let n=0,chunks=[];while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>250000){await reader.cancel();fail(413,'mail_too_large','발주서 내용이 너무 큽니다. 나누어 발송하세요.');}chunks.push(r.value);}const bytes=new Uint8Array(n);let p=0;for(const b of chunks){bytes.set(b,p);p+=b.length;}try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{fail(400,'invalid_json','메일 요청 형식을 확인하세요.');}}
async function handle(request,env){
 const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 try{
  const path=new URL(request.url).pathname,ctx=await App.context(request,env);App.checkPermission(ctx,'inventory.read');if(ctx.user.kind!=='staff')fail(403,'staff_required','직원 계정으로 접속하세요.');
  if(request.method==='GET'&&path==='/api/mail/status')return json({provider:'gmail',configured:env.MAIL?.configured===true,sender:env.MAIL?.configured?env.MAIL.sender:'',company:companyOf(ctx.state)});
  if(request.method==='GET'&&path==='/api/mail/history')return json({records:(ctx.state.mailDeliveries||[]).filter(r=>r.actor===ctx.user.id).slice().reverse().map(publicRecord)});
  if(request.method!=='POST'||!['/api/mail/pdf','/api/mail/send'].includes(path))fail(404,'not_found','메일 경로를 확인하세요.');
  App.checkPermission(ctx,'inventory.write');if(request.headers.get('origin')!==new URL(request.url).origin)fail(403,'origin_rejected','같은 사이트에서 요청하세요.');App.csrf(request,ctx);
  const data=await readBody(request);let message;try{message=M.normalizeMessage(data,{recipientRequired:path.endsWith('/send')});}catch(e){fail(400,'mail_validation',e.message);}
  const company=companyOf(ctx.state),renderer=env.MAIL?.renderPdf;if(typeof renderer!=='function')fail(503,'pdf_unavailable','메일 PDF 생성 기능이 준비되지 않았습니다.');
  if(path.endsWith('/pdf')){if(message.documents.length!==1)fail(400,'pdf_single_document','미리보기할 발주서 한 건을 선택하세요.');let bytes;try{bytes=await renderer({document:message.documents[0],company});}catch{fail(503,'pdf_failed','발주서 PDF를 만들지 못했습니다.');}if(bytes.length>8000000)fail(413,'pdf_too_large','첨부 PDF 용량을 확인하세요.');return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(M.filename(message.documents[0])),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  if(data.confirmed!==true)fail(400,'mail_confirmation','수신자와 첨부 발주서를 확인하세요.');if(!env.MAIL?.configured||typeof env.MAIL.send!=='function')fail(503,'gmail_not_configured','Gmail 발신 계정 연결이 필요합니다.');
  if(typeof data.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.requestId))fail(400,'mail_request_id','발송 창을 다시 열어 주세요.');
  const requestHash=await G.digest(JSON.stringify({message,company,sender:env.MAIL.sender})),documentHashes={};for(const d of message.documents)documentHashes[d.id]=await G.digest(JSON.stringify(d));
  const record={id:crypto.randomUUID(),requestId:data.requestId,requestHash,actor:ctx.user.id,sender:env.MAIL.sender,recipient:message.recipient,subject:message.subject,documentIds:message.documents.map(d=>d.id),documentHashes,status:'sending',createdAt:now(),messageId:'<rea-'+(await G.digest(ctx.user.id+':'+data.requestId)).slice(0,40)+'@'+(new URL(request.url).hostname)+'>'};
  const reserved=await App.change(env.DB,(s,revision)=>{
    const live=App.sessionContext(s,revision,s.sessions.find(x=>x.id===ctx.session.id),request);App.checkPermission(live,'inventory.write');if(live.user.kind!=='staff')fail(403,'staff_required','직원 계정으로 접속하세요.');if(JSON.stringify(companyOf(s))!==JSON.stringify(company))fail(409,'mail_company_changed','회사 정보가 변경됐습니다. 발송 창을 다시 열어 주세요.');
    const history=s.mailDeliveries||=[],old=history.find(r=>r.actor===ctx.user.id&&r.requestId===data.requestId);if(old){if(old.requestHash!==requestHash)fail(409,'mail_request_conflict','같은 발송 요청의 내용이 다릅니다. 이력을 확인하세요.');return {replayed:true,record:old};}
    if(history.length>=500)fail(409,'mail_history_limit','메일 발송 이력의 보관 한도에 도달했습니다.');if(history.filter(r=>r.actor===ctx.user.id&&Date.parse(r.createdAt)>Date.now()-60000).length>=10)fail(429,'mail_rate_limit','잠시 후 다시 발송하세요.');s.mailDeliveries=[...history,record];return {replayed:false,record};
  });
  if(reserved.value.replayed)return json({record:publicRecord(reserved.value.record),replayed:true},reserved.value.record.status==='sending'?202:200);
  let status='unknown',errorCode='',attachments=[],size=0;
  try{
    for(const d of message.documents){let content;try{content=await renderer({document:d,company});}catch{throw Object.assign(Error(),{definite:true,code:'pdf_failed'});}size+=content.length;if(size>8000000)throw Object.assign(Error(),{definite:true,code:'pdf_too_large'});attachments.push({filename:M.filename(d),content});}
    const live=await App.context(request,env);try{App.checkPermission(live,'inventory.write');if(live.user.kind!=='staff')throw Error();}catch{throw Object.assign(Error(),{definite:true,code:'permission_changed'});}
    const result=await env.MAIL.send({message,company,attachments,messageId:record.messageId});if(result?.accepted!==true)throw Error();status='accepted';
  }catch(e){status=e.definite===true?'failed':'unknown';errorCode=['pdf_failed','pdf_too_large','permission_changed'].includes(e.code)?e.code:status==='failed'?'gmail_rejected':'gmail_result_unknown';}
  let finished;
  try{finished=await App.change(env.DB,s=>{const r=s.mailDeliveries?.find(r=>r.id===record.id);if(!r)fail(409,'mail_record_missing','발송 이력을 확인하세요.');if(r.status!=='sending')return r;r.status=status;r.finishedAt=now();r.errorCode=errorCode;return r;});}
  catch{fail(503,'mail_result_unknown','발송 결과를 이력에 확정하지 못했습니다. 다시 발송하지 말고 Gmail 보낸편지함을 확인하세요.');}
  return json({record:publicRecord(finished.value),replayed:false});
 }catch(e){return json({error:{code:e.code||'mail_unavailable',message:e instanceof App.AppError?e.message:'메일 처리를 완료하지 못했습니다.'}},e.status||503);}
}
module.exports={handle,publicRecord};
