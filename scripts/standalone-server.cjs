'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), net = require('node:net'), {pathToFileURL} = require('node:url');
const {readEnvironment, configuration} = require('./runtime-config.cjs'), {sqliteD1} = require('./sqlite-d1.cjs'), {createSupabaseDB} = require('../worker/supabase-db.cjs');
const forwarded = ['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','cf-connecting-ip','cf-ray'];

async function startServer({input = readEnvironment(), worker, DB, port, mailInput, webmailStore} = {}) {
  const config = configuration(input);
  if (!worker) worker = (await import(pathToFileURL(path.resolve(__dirname, '../dist/server/index.js')).href)).default;
  let ownDB = false;
  if (config.backend === 'supabase') {
    // Read-only: missing keys/tables/permissions fail before opening a listener.
    const remote = createSupabaseDB({url: input.SUPABASE_URL, key: input.SUPABASE_SECRET_KEY});
    await remote.probe();
  } else if (!DB) {
    fs.mkdirSync(path.dirname(config.sqliteFile), {recursive: true, mode: 0o700});
    DB = sqliteD1(config.sqliteFile); ownDB = true;
    fs.chmodSync(config.sqliteFile, 0o600);
  }
  if(!webmailStore){if(config.backend==='supabase'){const {createMailStore}=await import('./mail-rest-store.mjs');webmailStore=createMailStore({url:input.SUPABASE_URL,key:input.SUPABASE_SECRET_KEY});}else if(DB?.raw){webmailStore=require('./mail-sqlite-store.cjs').createSqliteMailStore(DB.raw,{directory:path.resolve(config.sqliteFile+'.mail-files')});}}
  let localOrigin;
  const routingCache=new Map();
  const server = http.createServer(async (req, res) => {
    try {
      const direct = req.headers.host === new URL(localOrigin).host && !forwarded.some(k => req.headers[k] !== undefined);
      const viaTunnel = !!config.publicOrigin && req.headers.host === new URL(config.publicOrigin).host && req.headers['x-forwarded-proto'] === 'https' && !!net.isIP(req.headers['cf-connecting-ip'] || '');
      if (!direct && !viaTunnel) { res.writeHead(403).end('Host rejected'); return; }
      if (!req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(400).end(); return; }
      if (req.url === '/__rea/health') {
        if (!direct || req.method !== 'GET') { res.writeHead(404).end(); return; }
        res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({runtime:'standalone',backend:config.backend,publicOrigin:config.publicOrigin,supabaseProjectRef:config.backend==='supabase'?new URL(input.SUPABASE_URL).hostname.split('.')[0]:null}));
        return;
      }
      const origin = direct ? localOrigin : config.publicOrigin, chunks = [];
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > (req.url==='/api/webmail/attachments'?4300000:300000)) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (value !== undefined && !['host','connection','content-length','transfer-encoding'].includes(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      for (const key of [...headers.keys()]) if (key.startsWith('oai-')) headers.delete(key);
      headers.set('CF-Connecting-IP', direct ? req.socket.remoteAddress : req.headers['cf-connecting-ip']);
      // Snapshot only Gmail settings per mail request; setup needs no ERP restart.
      const isMail=req.url.startsWith('/api/mail/')||req.url.startsWith('/api/webmail/'),mailSettings=isMail&&mailInput?mailInput():input;
      const mail=isMail?require('./gmail-transport.cjs').createGmail(mailSettings):undefined;
      let routing;if(req.url.startsWith('/api/webmail/')){const signature=JSON.stringify([mailSettings.REA_MAIL_DOMAIN,mailSettings.REA_CF_ROUTING_ZONE_ID,mailSettings.REA_CF_ROUTING_WORKER,mailSettings.REA_CF_ROUTING_AUTH,mailSettings.REA_CF_ROUTING_TOKEN]);if(!routingCache.has(signature)){routingCache.clear();routingCache.set(signature,require('./cloudflare-mail-routing.cjs').createRouting(mailSettings));}routing=routingCache.get(signature);}
      const webmail=req.url.startsWith('/api/webmail/')?{routing,providers:{gmail:mail,cloudflare:require('./domain-mail-transport.cjs').createDomainMail(mailSettings)}}:undefined;
      const env = {...config.environment, ...(mail ? {MAIL:mail} : {}), ...(webmail ? {WEBMAIL:webmail,WEBMAIL_STORE:webmailStore}:{}), ...(DB ? {DB} : {}), REA_BOOTSTRAP_LOCAL: direct};
      const response = await worker.fetch(new Request(origin + req.url, {method: req.method, headers, ...(!['GET','HEAD'].includes(req.method) ? {body: Buffer.concat(chunks)} : {})}), env);
      const responseHeaders = Object.fromEntries(response.headers);
      if (response.headers.getSetCookie) {
        const cookies = response.headers.getSetCookie();
        if (cookies.length) responseHeaders['set-cookie'] = cookies;
      }
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(503, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('서버 연결 상태를 확인하세요.'); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port ?? config.port, '127.0.0.1', resolve); }); }
  catch (error) { if (ownDB) DB.close(); throw error; }
  localOrigin = 'http://127.0.0.1:' + server.address().port;
  return {server, localOrigin, config, close: () => new Promise((resolve, reject) => server.close(error => { if (ownDB) DB.close(); error ? reject(error) : resolve(); }))};
}

function runCLI() {
  startServer({mailInput:()=>readEnvironment()}).then(runtime => {
    console.log('REA ERP: ' + runtime.localOrigin + ' (storage=' + runtime.config.backend + ', manual start)');
    if (runtime.config.publicOrigin) console.log('Configured public origin: ' + runtime.config.publicOrigin);
    let closing = false;
    for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { if (closing) return; closing = true; await runtime.close(); process.exit(0); });
  }).catch(() => { console.error('REA 시작 실패: 포트·설정 파일·저장소 연결을 확인하세요. npm run connection:check'); process.exitCode = 1; });
}
if (require.main === module) runCLI();
module.exports = {startServer, runCLI};
