'use strict';
const fs = require('node:fs'), path = require('node:path');
const {readEnvironment, defaultFile, keys} = require('./runtime-config.cjs'), {createSupabaseDB} = require('../worker/supabase-db.cjs');
function settingsForKey(input,url,key) {
  const values = Object.fromEntries(keys.filter(k => input[k] !== undefined).map(k => [k, input[k]]));
  return {...values, REA_STORAGE:input.REA_STORAGE || 'sqlite', SUPABASE_URL:url, SUPABASE_SECRET_KEY:key};
}
function secretInput() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error('숨김 입력이 가능한 터미널에서 실행하세요.');
  process.stdout.write('Supabase 서버 비밀키 (입력값 숨김): ');
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    function finish(error) { process.stdin.off('data', read); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); error ? reject(error) : resolve(value); }
    function read(chunk) {
      for (const c of chunk) {
        if (c === '\u0003') return finish(Error('구성을 취소했습니다.'));
        if (c === '\r' || c === '\n') return finish();
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ') value += c;
      }
    }
    process.stdin.on('data', read);
  });
}
async function configure(input = readEnvironment()) {
  const key = await secretInput(), url = input.SUPABASE_URL || 'https://bzyvdergqijwswnjvozs.supabase.co';
  await createSupabaseDB({url, key}).probe();
  const file = input.REA_ENV_FILE || defaultFile(), dir = path.dirname(file);
  fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const values = settingsForKey(input,url,key);
  const lines = Object.entries(values).map(([k,v]) => k + '=' + JSON.stringify(v)).join('\n') + '\n';
  fs.writeFileSync(file, lines, {mode:0o600}); fs.chmodSync(file, 0o600);
  console.log('서버 전용 설정 저장 완료: ' + file + '\n읽기 전용 연결 검사 통과. 기존 백엔드·계정·업무자료를 유지했습니다.');
}
if (require.main === module) configure().catch(() => { console.error('구성하지 못했습니다. 서버 비밀키·URL·파일 권한을 확인하고 다시 실행하세요.'); process.exitCode = 1; });
module.exports = {configure,settingsForKey};
