// This Worker receives no Supabase server key. A dedicated ingress token is its only secret.
export default {
 async fetch(){return new Response('Not found',{status:404});},
 async email(message,env){
  if(message.rawSize>8*1024*1024){message.setReject('Message exceeds mailbox size limit');return;}
  const url=new URL(env.REA_INGRESS_URL);if(url.protocol!=='https:'||!(/^[a-z0-9]{20}\.supabase\.co$/).test(url.hostname)||url.pathname!=='/functions/v1/rea-mail-ingress'||url.search||url.hash)throw Error('Mail ingress configuration unavailable');
  if(!/^[a-f0-9]{64}$/.test(env.REA_INGRESS_TOKEN||''))throw Error('Mail ingress credential unavailable');
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+env.REA_INGRESS_TOKEN,'Content-Type':'message/rfc822','X-REA-Recipient':message.to,'X-REA-Envelope-From':message.from},body:message.raw,redirect:'error'});
  if(response.status===404){message.setReject('Unknown mailbox');return;}if(response.status===413){message.setReject('Message exceeds mailbox size limit');return;}if(!response.ok)throw Error('Mail delivery storage temporarily unavailable');
 }
};
