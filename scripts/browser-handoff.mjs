// Protocol v1 admits only a redacted ECOUNT login observation and one public login bundle.
// Original code is parsed by pinned REA in a child process, never imported or executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const maxInputBytes = 32 * 1024;
const maxSourceBytes = 4 * 1024 * 1024;
const observationStatements = new Set([
  'The browser title and login-screen controls were read directly in the Windows in-app browser.',
  'The asset URL was read from a script element in the same page.',
  'Only control metadata was collected; no input contents were read.',
]);
const unknownStatements = new Set([
  'Successful sign-in and authenticated ERP screens.',
  'The meaning or behavior of the menu requested by the original URL fragment.',
  'Server-side implementation and live business behavior.',
]);
const controlShapes = new Set([
  ['input','text','com_code',''], ['input','text','id',''],
  ['input','password','passwd',''], ['input','checkbox','loginck',''],
  ['input','checkbox','logintimeinck',''], ['button','button','save','로그인'],
  ['button','button','','한국 (한국어)'],
].map(parts => JSON.stringify(parts)));

function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))) {
    fail('HANDOFF_SCHEMA: unexpected or missing fields; content omitted');
  }
}
function statements(values, allowed) {
  if (!Array.isArray(values) || values.length !== allowed.size ||
      new Set(values).size !== allowed.size || values.some(value => !allowed.has(value))) {
    fail('HANDOFF_SCHEMA: unapproved free text; content omitted');
  }
}
export function validateAssetURL(value) {
  if (typeof value !== 'string' || value.length > 512) fail('HANDOFF_ASSET_URL');
  let url;
  try { url = new URL(value); } catch { fail('HANDOFF_ASSET_URL'); }
  if (url.href !== value || url.origin !== 'https://resource.ecount.com' ||
      url.username || url.password || url.search || url.hash ||
      !/^\/ec5\/static\/ecountv5\/presentation\/app\.login\/app\.login\.erp_login\/app\.login\.erp_login\.[a-f0-9]+\.\d+\.js$/.test(url.pathname)) {
    fail('HANDOFF_ASSET_URL: only a public login JavaScript URL is allowed');
  }
  return url;
}
export function validateHandoff(input) {
  object(input,['schemaVersion','captureId','capturedAt','source','page','controls','assets','observations','unverified']);
  if (input.schemaVersion !== 1 || typeof input.captureId !== 'string' ||
      !/^ecount-login-\d{8}(?:-[a-z0-9-]{1,24})?$/.test(input.captureId) ||
      typeof input.capturedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(input.capturedAt) ||
      !Number.isFinite(Date.parse(input.capturedAt))) fail('HANDOFF_SCHEMA: invalid identity or timestamp');
  object(input.source,['kind','method']);
  if (input.source.kind !== 'windows-in-app-browser' || input.source.method !== 'accessibility-and-read-only-dom') fail('HANDOFF_SOURCE');
  object(input.page,['url','title','screen']);
  if (input.page.url !== 'https://login.ecount.com/' || input.page.title !== '이카운트 로그인 | ECOUNT' || input.page.screen !== 'login') fail('HANDOFF_PAGE: only the normalized login screen is admitted');
  if (!Array.isArray(input.controls) || !input.controls.length || input.controls.length > 7) fail('HANDOFF_CONTROLS');
  const seen = new Set();
  for (const control of input.controls) {
    object(control,['tag','type','id','label']);
    const shape = JSON.stringify([control.tag,control.type,control.id,control.label]);
    if (!controlShapes.has(shape) || seen.has(shape)) fail('HANDOFF_CONTROLS: unapproved metadata or data value');
    seen.add(shape);
  }
  if (!Array.isArray(input.assets) || input.assets.length !== 1) fail('HANDOFF_ASSETS: exactly one login bundle is required');
  const asset = input.assets[0];
  object(asset,['url','kind','purpose']);
  validateAssetURL(asset.url);
  if (asset.kind !== 'javascript' || asset.purpose !== 'login-screen-static-analysis') fail('HANDOFF_ASSETS');
  statements(input.observations,observationStatements);
  statements(input.unverified,unknownStatements);
  return input;
}

export function readHandoff(filename) {
  if (typeof filename !== 'string' || !filename.endsWith('.json')) fail('HANDOFF_PATH: a JSON file is required');
  const absolute = path.resolve(filename);
  let stat;
  try { stat = fs.lstatSync(absolute); } catch { fail('HANDOFF_PATH: file unavailable'); }
  if (!stat.isFile() || stat.size > maxInputBytes || fs.realpathSync(absolute) !== absolute) fail('HANDOFF_PATH: regular bounded file without symlinks required');
  const bytes = fs.readFileSync(absolute);
  if (bytes.length > maxInputBytes) fail('HANDOFF_PATH: input too large');
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { fail('HANDOFF_JSON: invalid JSON; content omitted'); }
  return {handoff:validateHandoff(parsed),inputSha256:hash(bytes)};
}

export async function downloadAsset(value, fetcher = fetch) {
  const url = validateAssetURL(value);
  let response;
  try {
    response = await fetcher(url.href, {redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30000)});
  } catch { fail('HANDOFF_DOWNLOAD: anonymous GET failed or redirected'); }
  if (response.status !== 200 || response.redirected || (response.url && response.url !== url.href)) fail('HANDOFF_DOWNLOAD: expected direct HTTP 200');
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['application/javascript','text/javascript','application/x-javascript','text/plain','application/octet-stream'].includes(type)) fail('HANDOFF_DOWNLOAD: response is not JavaScript');
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxSourceBytes || !response.body) fail('HANDOFF_DOWNLOAD: source missing or too large');
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxSourceBytes) fail('HANDOFF_DOWNLOAD: source too large');
      chunks.push(Buffer.from(chunk));
    }
  } catch { fail('HANDOFF_DOWNLOAD: source incomplete or too large'); }
  const bytes = Buffer.concat(chunks);
  let text;
  try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { fail('HANDOFF_DOWNLOAD: invalid source encoding'); }
  if (!size || /^\s*</.test(text)) fail('HANDOFF_DOWNLOAD: empty source or HTML response');
  return {bytes,manifest:{url:url.href,httpStatus:200,contentType:type,bytes:size,sha256:hash(bytes),filename:path.basename(url.pathname)}};
}

async function analyze(directory, outputDirectory, reaDirectory, controls) {
  const result = path.join(outputDirectory,'rea-result.json');
  const error = path.join(outputDirectory,'rea-stderr.log');
  const args = [path.join(reaDirectory,'scripts/rea.mjs'),'analyze-javascript-application',directory,
    '--artifact-format','directory','--max-heap-mb','4096','--analysis-timeout-ms','45000','--format','json'];
  const out = fs.openSync(result,'wx',0o600), err = fs.openSync(error,'wx',0o600);
  let status;
  try {
    status = await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,args,{cwd:root,stdio:['ignore',out,err],timeout:180000});
      child.once('error',() => reject(new Error('HANDOFF_REA: could not run pinned CLI')));
      child.once('close',(code,signal) => resolve({exitCode:code,signal}));
    });
  } finally { fs.closeSync(out); fs.closeSync(err); }
  if (status.exitCode !== 0) fail('HANDOFF_REA: CLI failed; inspect local REA log');
  const bytes = fs.readFileSync(result);
  let evidence;
  try { evidence = JSON.parse(bytes); } catch { fail('HANDOFF_REA: invalid result JSON'); }
  const {parseApplicationGraphEvidence} = await import(pathToFileURL(path.join(reaDirectory,'dist/application/javascript/JavaScriptApplicationEvidenceGraph.js')).href);
  const parsed = parseApplicationGraphEvidence(evidence);
  if (!parsed.ok) fail('HANDOFF_REA: evidence validation failed');
  const statistics = evidence.normalized_result.statistics;
  if (statistics.parsed_javascript_files !== 1 || statistics.parse_failures !== 0) fail('HANDOFF_REA: incomplete JavaScript parsing');
  const limitations = [...new Set([...(evidence.limitations || []),...(evidence.normalized_result.limitations || [])])];
  const controlReferences = controls.filter(control=>control.id).map(control=>{
    const matches = (parsed.value.semanticGraph?.nodes || []).filter(node=>node.label === control.id);
    return {controlId:control.id,basis:'REA semantic label equals observed ID; candidate only, not a runtime binding',
      matchCount:matches.length,references:matches.slice(0,3).map(node=>({nodeId:node.node_id,kind:node.kind,location:node.evidence.location}))};
  });
  return {version:'6.4.0',command:[process.execPath,...args],exitCode:status.exitCode,evidenceValidated:true,
    evidenceId:evidence.evidence_id,resultSha256:hash(bytes),statistics,
    semanticNodes:parsed.value.semanticGraph?.nodes.length || 0,
    partial:limitations.some(value=>/incomplete|Resource constraint|timeout/i.test(value)),limitations,controlReferences,
    rawResult:'rea-result.json',stderr:'rea-stderr.log'};
}

function implementationReferences(controls) {
  const file = 'dist/auth-ui.js', bytes = fs.readFileSync(path.join(root,file));
  const text = bytes.toString('utf8');
  const needles = {
    com_code:"field(form,'회사코드','companyCode'",
    id:"field(form,'사용자 ID','loginId')",
    passwd:"field(form,'비밀번호','password','password')",
    save:"const submit=N('button',setup?'관리자 등록 후 로그인':'로그인'",
  };
  return controls.filter(control=>control.id).map(control=>{
    const needle = needles[control.id], offset = needle ? text.indexOf(needle) : -1;
    return {controlId:control.id,status:offset < 0?'unmapped':'independent-code-review-target',
      file:offset < 0?null:file,fileSha256:offset < 0?null:hash(bytes),
      line:offset < 0?null:text.slice(0,offset).split('\n').length,
      behaviorEquivalenceVerified:false};
  });
}

export async function runHandoff(filename) {
  // Validate every field before fetching or retaining any handoff content.
  const {handoff,inputSha256} = readHandoff(filename);
  const reaDirectory = path.dirname(require.resolve('rea-agents/package.json'));
  if (JSON.parse(fs.readFileSync(path.join(reaDirectory,'package.json'))).version !== '6.4.0') fail('HANDOFF_REA: rea-agents@6.4.0 is required');
  const downloaded = await downloadAsset(handoff.assets[0].url);
  const base = path.join(root,'.artifacts/browser-handoff');
  fs.mkdirSync(base,{recursive:true});
  if (fs.realpathSync(base) !== base) fail('HANDOFF_OUTPUT: symlink output is not allowed');
  const output = fs.mkdtempSync(path.join(base,handoff.captureId+'-'));
  const input = path.join(output,'input');
  fs.mkdirSync(input);
  const write = (file,data) => fs.writeFileSync(path.join(output,file),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
  write('handoff.json',handoff);
  write('source-manifest.json',downloaded.manifest);
  fs.writeFileSync(path.join(input,downloaded.manifest.filename),downloaded.bytes,{flag:'wx',mode:0o600});
  try {
    const rea = await analyze(input,output,reaDirectory,handoff.controls);
    const development = {
      schemaVersion:1,scope:'browser-to-linux-analysis-integration',canonicalPlan:'docs/plan-purchase-manual.md',
      observedScreen:'login',observedControlIds:handoff.controls.map(control=>control.id).filter(Boolean),
      featureImplementationChanged:false,
      originalStaticReferences:rea.controlReferences,
      independentImplementationReferences:implementationReferences(handoff.controls),
      nextSteps:[
        {task:'Review candidate source references against the independent login targets',files:['docs/plan-login.md','dist/auth-ui.js','worker/app-service.cjs','tests/self-auth.cjs'],status:'static-review-targets-linked; behavior-comparison-not-performed'},
        {task:'Observe the selected purchase-request feature after user sign-in in Windows',files:['docs/request-list.md','evidence/global-rea-20261018/current-release.json'],status:'not-observed'},
      ],
      limits:['A public login bundle is not a backend implementation or a login test.','Static declarations do not prove that a handler ran in the observed browser.','Authenticated ERP behavior and original equivalence remain unverified.'],
    };
    write('development-plan.json',development);
    const summary = {schemaVersion:1,status:rea.partial?'completed-with-analysis-limitations':'completed',generatedAt:new Date().toISOString(),
      captureId:handoff.captureId,inputSha256,
      observation:{provenance:'Windows handoff; not a Linux browser observation',capturedAt:handoff.capturedAt,page:handoff.page,controls:handoff.controls.length},
      source:downloaded.manifest,rea,developmentPlan:'development-plan.json',canonicalPlan:development.canonicalPlan,
      authenticatedErpVerified:false,originalEquivalence:false,originalCodeExecuted:false,unverified:handoff.unverified};
    write('summary.json',summary);
    console.log(JSON.stringify({status:summary.status,captureId:summary.captureId,rea:rea.version,parsedFiles:rea.statistics.parsed_javascript_files,
      partial:rea.partial,sourceSha256:downloaded.manifest.sha256,summary:path.relative(root,path.join(output,'summary.json'))}));
    return {summary,output};
  } catch (error) {
    write('failure.json',{status:'failed',code:/^HANDOFF_/.test(error.message)?error.message:'HANDOFF_INTERNAL',generatedAt:new Date().toISOString()});
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) fail('Usage: npm run rea:handoff -- /absolute/path/to/handoff.json');
    await runHandoff(process.argv[2]);
  } catch (error) {
    console.error(/^(HANDOFF_|Usage:)/.test(error.message)?error.message:'HANDOFF_INTERNAL: inspect installation and local artifacts');
    process.exitCode = 1;
  }
}
