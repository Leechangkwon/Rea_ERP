// Gmail credentials remain in this Node process, outside the compiled Worker and browser.
'use strict';
const nodemailer=require('nodemailer'),{renderPdf}=require('./purchase-mail-pdf.cjs');
function settings(input){const sender=String(input.REA_GMAIL_USER||'').trim(),password=String(input.REA_GMAIL_APP_PASSWORD||'').replace(/\s/g,'');if(!sender&&!password)return {configured:false,sender:''};if(!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(sender)||!/^.{16}$/.test(password)||/[\r\n\x00-\x1f\x7f]/.test(password))throw Error('Gmail 발신주소와 16자리 앱 비밀번호를 확인하세요.');return {configured:true,sender,password};}
function createGmail(input,{createTransport=nodemailer.createTransport}={}){
 const config=settings(input);let smtp;
 const transport=()=>smtp||=(createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:config.sender,pass:config.password},tls:{servername:'smtp.gmail.com',minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false}));
 return {configured:config.configured,sender:config.sender,renderPdf,async sendGeneric(message){
 if(!config.configured||message.sender!==config.sender)throw Object.assign(Error('Gmail 발신 주소를 확인하세요.'),{definite:true});
 try{const r=await transport().sendMail({from:{name:message.senderName,address:config.sender},to:message.to.map(address=>({address})),cc:message.cc.map(address=>({address})),bcc:message.bcc.map(address=>({address})),subject:message.subject,text:message.body,messageId:message.messageId,...(message.inReplyTo?{inReplyTo:message.inReplyTo,references:[message.inReplyTo]}:{}),attachments:message.attachments.map(a=>({filename:a.filename,content:Buffer.from(a.content)})),disableFileAccess:true,disableUrlAccess:true});if(r.accepted?.length&&!r.rejected?.length)return {accepted:true};throw Object.assign(Error(),{definite:!r.accepted?.length});}catch(e){throw Object.assign(Error('Gmail 발송 결과를 확인하세요.'),{definite:e.definite===true||Number(e.responseCode)>=400||['EAUTH','EENVELOPE'].includes(e.code)});}
 },async verify(){if(!config.configured)throw Error('gmail_not_configured');try{await transport().verify();return {configured:true,authenticated:true,sender:config.sender};}catch{throw Error('Gmail 인증 실패: 주소·앱 비밀번호와 계정 설정을 확인하세요.');}},async send({message,company,attachments,messageId}){
   if(!config.configured)throw Object.assign(Error('Gmail 설정이 필요합니다.'),{code:'mail_not_configured',definite:true});
   try{const result=await transport().sendMail({from:{name:company.name||'발주 담당',address:config.sender},to:[{address:message.recipient}],subject:message.subject,text:message.body,messageId,attachments:attachments.map(a=>({filename:a.filename,content:a.content,contentType:'application/pdf'})),disableFileAccess:true,disableUrlAccess:true});if(result.rejected?.length||!result.accepted?.length)throw Object.assign(Error('rejected'),{responseCode:550});return {accepted:true};}
   catch(error){throw Object.assign(Error('Gmail 발송 결과를 확인하세요.'),{code:'gmail_send_failed',definite:Number(error.responseCode)>=400||['EAUTH','EENVELOPE'].includes(error.code)});}
 }};
}
module.exports={settings,createGmail};
