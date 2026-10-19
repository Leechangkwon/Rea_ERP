'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const checks = [];
function check(name, ok, detail) { checks.push({name, ok, detail}); }
const major = Number(process.versions.node.split('.')[0]);
check('node', major === 24 && process.versions.node.localeCompare('24.22.0', undefined, {numeric:true}) >= 0, process.version);
for (const [name, command, args] of [['npm','npm',['--version']], ['python3','python3',['--version']], ['git','git',['--version']], ['procps','ps',['--version']]]) {
  const r = spawnSync(command, args, {encoding:'utf8', shell:process.platform==='win32'});
  const detail = (r.stdout || r.stderr || r.error?.message || '').trim().split('\n')[0];
  let ok = r.status === 0;
  if(name==='procps')ok=ok&&/procps/i.test(detail);
  if(name==='npm')ok=ok&&/^11\./.test(detail)&&detail.localeCompare('11.19.1',undefined,{numeric:true})>=0;
  if(name==='python3')ok=ok&&/^Python 3\.14\./.test(detail);
  check(name, ok, detail);
}
for (const [name, version] of Object.entries(require('../package.json').devDependencies)) {
  try { const actual = JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'))).version; check(name, actual === version, actual); }
  catch { check(name, false, 'Run npm ci'); }
}
try { require('node:sqlite'); check('node:sqlite', true, 'available'); }
catch { check('node:sqlite', false, 'unavailable'); }
try {
  const browser = require('@playwright/test').chromium.executablePath();
  check('chromium', fs.existsSync(browser), fs.existsSync(browser) ? 'installed (launch verified by test:browser)' : 'Run npm run browser:install');
} catch { check('chromium', false, 'Playwright unavailable'); }
check('standalone runtime', ['worker/supabase-db.cjs','scripts/standalone-server.cjs','scripts/runtime-config.cjs'].every(file=>fs.existsSync(path.join(root,file))), 'local / Supabase (no Sites manifest required)');
console.log(JSON.stringify({platform:process.platform, checks, passed:checks.every(c=>c.ok)}, null, 2));
process.exitCode = checks.every(c=>c.ok) ? 0 : 1;
