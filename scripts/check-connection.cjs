'use strict';
const {readEnvironment, configuration} = require('./runtime-config.cjs'), {createSupabaseDB} = require('../worker/supabase-db.cjs');
async function check(input = readEnvironment()) {
  const config = configuration(input);
  if (config.backend === 'sqlite') return {passed: true, backend: 'sqlite', remoteAccessed: false, publicOriginConfigured: !!config.publicOrigin};
  const result = await createSupabaseDB({url: input.SUPABASE_URL, key: input.SUPABASE_SECRET_KEY}).probe();
  return {passed: true, ...result, publicOriginConfigured: !!config.publicOrigin};
}
if (require.main === module) check().then(r => console.log(JSON.stringify(r, null, 2))).catch(() => { console.error(JSON.stringify({passed:false, error:'서버 전용 Supabase URL·비밀키·테이블 권한과 로컬 설정 파일을 확인하세요.'})); process.exitCode = 1; });
module.exports = {check};
