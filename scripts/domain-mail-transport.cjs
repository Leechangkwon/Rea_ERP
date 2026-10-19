// Fixed authenticated Cloudflare SMTP; arbitrary hosts/from domains are forbidden.
'use strict';
const nodemailer=require('nodemailer');
function createDomainMail(input,{createTransport=nodemailer.createTransport}={}){
 const domain=String(input.REA_MAIL_DOMAIN||'').trim().toLowerCase(),token=String(input.REA_CF_MAIL_TOKEN||'');if(!token)return {configured:false,domain};if(!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(domain)||domain.includes('..')||token.length<20||/[\s\x00-\x1f\x7f]/.test(token))throw Error('도메인 메일 서버 설정을 확인하세요.');
 let smtp;const connection=()=>smtp||=createTransport({host:'smtp.mx.cloudflare.net',port:465,secure:true,auth:{user:'api_token',pass:token},tls:{servername:'smtp.mx.cloudflare.net',minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
 return {configured:true,domain,async verify(){try{await connection().verify();return {authenticated:true};}catch{throw Error('도메인 메일 인증을 확인하세요.');}},async sendGeneric(message){
  if(!message.sender.endsWith('@'+domain))throw Object.assign(Error('발신 도메인이 다릅니다.'),{definite:true});
  try{const r=await connection().sendMail({from:{name:message.senderName,address:message.sender},to:message.to.map(address=>({address})),cc:message.cc.map(address=>({address})),bcc:message.bcc.map(address=>({address})),replyTo:{name:message.senderName,address:message.sender},subject:message.subject,text:message.body,messageId:message.messageId,...(message.inReplyTo?{inReplyTo:message.inReplyTo,references:[message.inReplyTo]}:{}),attachments:message.attachments.map(a=>({filename:a.filename,content:Buffer.from(a.content)})),disableFileAccess:true,disableUrlAccess:true});if(r.accepted?.length&&!r.rejected?.length)return {accepted:true};throw Object.assign(Error(),{definite:!r.accepted?.length});}catch(e){throw Object.assign(Error('도메인 메일 발송 결과를 확인하세요.'),{definite:e.definite===true||!e.accepted&&Number(e.responseCode)>=400||['EAUTH','EENVELOPE'].includes(e.code)});}
 }};
}
module.exports={createDomainMail};
