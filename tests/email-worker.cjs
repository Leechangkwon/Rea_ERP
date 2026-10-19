const test=require('node:test'),assert=require('node:assert/strict');
const env={REA_INGRESS_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/rea-mail-ingress',REA_INGRESS_TOKEN:'a'.repeat(64)};
function message(){return {rawSize:12,from:'sender@example.test',to:'purchase@example.test',raw:new Response('synthetic MIME').body,rejected:null,setReject(reason){this.rejected=reason;}};}
test('email Worker streams MIME using the Workers-supported redirect policy',async()=>{
 const worker=(await import('../cloudflare/email/worker.mjs')).default,original=globalThis.fetch,m=message();let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(String(url),env.REA_INGRESS_URL);assert.equal(init.redirect,'manual');assert.equal(init.headers.Authorization,'Bearer '+env.REA_INGRESS_TOKEN);assert.equal(init.headers['X-REA-Recipient'],m.to);assert.equal(await new Response(init.body).text(),'synthetic MIME');return new Response('{}',{status:200});};
 try{await worker.email(m,env);assert.equal(calls,1);assert.equal(m.rejected,null);}finally{globalThis.fetch=original;}
});
test('email Worker never follows a redirect or acknowledges transient storage failure',async()=>{
 const worker=(await import('../cloudflare/email/worker.mjs')).default,original=globalThis.fetch;
 try{for(const status of [301,302,307,401,503]){let calls=0;globalThis.fetch=async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response('',{status,headers:{Location:'https://untrusted.example'}});};await assert.rejects(worker.email(message(),env),/temporarily unavailable/);assert.equal(calls,1);}}finally{globalThis.fetch=original;}
});
test('email Worker rejects oversize or unknown recipients and blocks invalid configuration before network',async()=>{
 const worker=(await import('../cloudflare/email/worker.mjs')).default,original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('',{status:404});};
 try{const large=message();large.rawSize=8*1024*1024+1;await worker.email(large,env);assert.match(large.rejected,/size/);assert.equal(calls,0);await assert.rejects(worker.email(message(),{...env,REA_INGRESS_URL:'https://untrusted.example/functions/v1/rea-mail-ingress'}),/configuration/);assert.equal(calls,0);const unknown=message();await worker.email(unknown,env);assert.equal(unknown.rejected,'Unknown mailbox');assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
