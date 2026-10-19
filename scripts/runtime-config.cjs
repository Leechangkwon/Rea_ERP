'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net'), {parseEnv} = require('node:util');
const defaultFile = () => path.join(os.homedir(), '.config', 'rea-erp', 'runtime.env');
const keys = ['REA_STORAGE','SUPABASE_URL','SUPABASE_SECRET_KEY','REA_PUBLIC_ORIGIN','REA_PORT','REA_SQLITE_FILE','OUTBOUND_ALLOWED_HOSTS','REA_GMAIL_USER','REA_GMAIL_APP_PASSWORD'];

function readEnvironment(input = process.env) {
  const file = input.REA_ENV_FILE || defaultFile();
  let stored = {};
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (!stat.isFile() || process.platform !== 'win32' && (stat.mode & 0o077)) throw Error('REA 설정 파일은 사용자 전용 권한(600)이 필요합니다.');
    stored = parseEnv(fs.readFileSync(file, 'utf8'));
    if (Object.keys(stored).some(k => !keys.includes(k))) throw Error('REA 설정 파일의 변수 이름을 확인하세요.');
  }
  return {...stored, ...input};
}

function configuration(input) {
  const backend = input.REA_STORAGE || 'sqlite', port = Number(input.REA_PORT || 8781);
  if (!['sqlite','supabase'].includes(backend) || !Number.isInteger(port) || port < 1 || port > 65535) throw Error('REA 저장소 종류와 포트를 확인하세요.');
  let publicOrigin = '';
  if (input.REA_PUBLIC_ORIGIN) {
    let u; try { u = new URL(input.REA_PUBLIC_ORIGIN); } catch { throw Error('REA 공개 주소를 확인하세요.'); }
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash || net.isIP(u.hostname) || !u.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)) throw Error('REA 공개 주소는 실제 HTTPS 도메인의 origin이어야 합니다.');
    publicOrigin = u.origin;
  }
  // An explicit backend prevents accidental use of a remote DB in local tests.
  if (backend === 'sqlite' && input.SUPABASE_SECRET_KEY && !input.REA_STORAGE) throw Error('Supabase 설정에는 REA_STORAGE를 명시하세요.');
  return {backend, port, publicOrigin, sqliteFile: path.resolve(input.REA_SQLITE_FILE || '.artifacts/preview.sqlite'), environment: {...Object.fromEntries(keys.filter(k=>!k.startsWith('REA_GMAIL_')&&input[k]!==undefined).map(k=>[k,input[k]])), REA_RUNTIME: 'standalone', REA_STORAGE: backend}};
}

module.exports = {readEnvironment, configuration, defaultFile, keys};
