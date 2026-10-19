// Local first-party analysis only. Original ERP code is never downloaded or executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
export const groups = {
  menu: ['dist/menu-core.js'],
  request: ['dist/menu-core.js','dist/form-core.js','dist/form-options.js','dist/inventory-core.js','dist/inventory-ui.js','dist/entry-core.js','dist/entry-ui.js','dist/entry-tools.js','dist/entry-extra-core.js','dist/entry-extra-ui.js'],
  reports: ['dist/purchasing-report-core.js','dist/purchasing-report-ui.js','dist/report-sort-ui.js'],
  api: ['worker/gateway.cjs','worker/app-service.cjs','worker/index.js'],
};
export function cacheKey(manifest, options) {
  return hash(JSON.stringify({schema:2, rea:'6.4.0', manifest, options}));
}
export function manifestFor(files) {
  return files.slice().sort().map(file => {
    if (!/^(dist|worker)\/[a-zA-Z0-9_.-]+\.(js|cjs)$/.test(file)) throw Error('Only first-party dist/worker JS/CJS files are allowed');
    const absolute = path.resolve(root, file);
    if (fs.realpathSync(absolute) !== absolute) throw Error('Symbolic link inputs are not allowed');
    const data = fs.readFileSync(absolute);
    return {file, bytes:data.length, sha256:hash(data)};
  });
}
export async function analyze(group) {
  const files = group === 'all' ? ['dist','worker'].flatMap(folder => fs.readdirSync(path.join(root,folder)).filter(n=>/\.(js|cjs)$/.test(n)).map(n=>folder+'/'+n)) : groups[group];
  if (!files) throw Error('Choose menu, request, reports, api, or all');
  const rea = path.dirname(require.resolve('rea-agents/package.json'));
  if (JSON.parse(fs.readFileSync(path.join(rea,'package.json'))).version !== '6.4.0') throw Error('REA 6.4.0 is required');
  const {parseApplicationGraphEvidence} = await import(pathToFileURL(path.join(rea,'dist/application/javascript/JavaScriptApplicationEvidenceGraph.js')).href);
  const manifest = manifestFor(files);
  const options = {format:'directory', heap:4096, timeout:45000};
  const key = cacheKey(manifest, options);
  const cacheRoot = path.join(root,'.artifacts/rea-cache');
  fs.mkdirSync(cacheRoot,{recursive:true});
  const cache = path.join(cacheRoot,key);
  async function inspect(folder) {
    const bytes = fs.readFileSync(path.join(folder,'result.json'));
    const meta = JSON.parse(fs.readFileSync(path.join(folder,'meta.json')));
    if (meta.key !== key || meta.resultSha256 !== hash(bytes)) throw Error('Cache hash mismatch');
    const evidence = JSON.parse(bytes);
    const parsed = parseApplicationGraphEvidence(evidence);
    if (!parsed.ok) throw Error('REA evidence validation failed');
    const s = evidence.normalized_result.statistics;
    if (s.parsed_javascript_files !== manifest.length || s.parse_failures !== 0) throw Error('Incomplete JavaScript parsing');
    return {evidence, parsed};
  }
  let reused = false, checked;
  if (fs.existsSync(cache)) {
    try { checked = await inspect(cache); reused = true; }
    catch { fs.rmSync(cache,{recursive:true,force:true}); }
  }
  if (!reused) {
    const run = fs.mkdtempSync(path.join(cacheRoot,'run-'));
    try {
      // Stable input paths remain valid after the output directory is committed to cache.
      const input = path.join(root,'.artifacts/rea-inputs',key);
      for (const record of manifest) {
        const dest = path.join(input,record.file);
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        if (!fs.existsSync(dest)) {
          const data = fs.readFileSync(path.join(root,record.file));
          if (hash(data) !== record.sha256) throw Error('Source changed during snapshot; retry');
          try { fs.writeFileSync(dest,data,{flag:'wx'}); }
          catch(error) { if(error.code!=='EEXIST')throw error; }
        }
        if (hash(fs.readFileSync(dest)) !== record.sha256) throw Error('Source changed during snapshot; retry');
      }
      const out = fs.openSync(path.join(run,'result.json'),'w');
      const err = fs.openSync(path.join(run,'stderr.log'),'w');
      let r;
      try { r = spawnSync(process.execPath,[path.join(rea,'scripts/rea.mjs'),'analyze-javascript-application',input,'--artifact-format','directory','--max-heap-mb',String(options.heap),'--analysis-timeout-ms',String(options.timeout),'--format','json'],{cwd:root,stdio:['ignore',out,err],timeout:900000}); }
      finally { fs.closeSync(out); fs.closeSync(err); }
      if (r.status !== 0) throw Error('REA analysis failed; cache was not accepted: '+(r.error?.message || r.status));
      fs.writeFileSync(path.join(run,'meta.json'),JSON.stringify({key, manifest, options, resultSha256:hash(fs.readFileSync(path.join(run,'result.json')))},null,2));
      checked = await inspect(run);
      // A concurrent identical analysis may already have populated this key.
      if (fs.existsSync(cache)) { await inspect(cache); fs.rmSync(run,{recursive:true}); }
      else fs.renameSync(run,cache);
    } catch (error) { fs.rmSync(run,{recursive:true,force:true}); throw error; }
  }
  const {evidence, parsed} = checked;
  const limitations = evidence.normalized_result.limitations || [];
  const summary = {schema:1, group, key, reused, rea:'6.4.0', files:manifest, evidenceValidated:true,
    statistics:evidence.normalized_result.statistics, semanticNodes:parsed.value.semanticGraph?.nodes.length || 0,
    partial:limitations.some(s=>/incomplete|Resource constraint|timeout/i.test(s)), limitations,
    equivalenceEstablished:false, result:path.relative(root,path.join(cache,'result.json'))};
  fs.writeFileSync(path.join(cacheRoot,group+'-latest.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({group,reused,key,files:manifest.length,partial:summary.partial,summary:'.artifacts/rea-cache/'+group+'-latest.json'}));
  return summary;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await analyze(process.argv[2] || 'menu'); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
