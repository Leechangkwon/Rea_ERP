/**
 * REA 6.4.0 evidence reconciliation. Original sources remain inert text.
 * Run after scripts/rea_rebuild.py capture/baseline/original/rebuilt.
 * Optional: --focus regenerates the three omitted first-party semantic graphs.
 * --rea-package <directory> can select an installed pinned REA package.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact=path.join(root,'.artifacts');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(p,data)=>fs.writeFileSync(path.join(root,p),JSON.stringify(data,null,2)+'\n');
const arg=process.argv.indexOf('--rea-package');
let rea=arg>=0?process.argv[arg+1]:process.env.REA_PACKAGE;
if(!rea){
 try{rea=path.dirname(createRequire(import.meta.url).resolve('rea-agents/package.json'));}catch{}
}
if(!rea){
 const cache=path.join(process.env.LOCALAPPDATA||'', 'npm-cache','_npx');
 if(fs.existsSync(cache))rea=fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules','rea-agents')).find(d=>fs.existsSync(path.join(d,'package.json'))&&read(path.join(d,'package.json')).version==='6.4.0');
}
if(!rea||read(path.join(rea,'package.json')).version!=='6.4.0')throw Error('Install rea-agents@6.4.0 or provide --rea-package.');
const importREA=p=>import(pathToFileURL(path.join(rea,'dist',p)).href);
const {parseApplicationGraphEvidence}=await importREA('application/javascript/JavaScriptApplicationEvidenceGraph.js');
const {traceApplicationFeature}=await importREA('domain/javascript/javascriptFeatureTrace.js');
const {queryJavaScriptSemanticGraph}=await importREA('domain/javascript/javascriptSemanticQuery.js');
const {compareApplicationVersionsEvidenceValidated}=await importREA('application/javascript/JavaScriptApplicationWorkflowService.js');

const focuses=[
 ['inventory','dist/inventory-ui.js'],
 ['app-service','worker/app-service.cjs'],
 ['gateway','worker/gateway.cjs'],
];
if(process.argv.includes('--focus')){
 for(const [id,relative]of focuses){
  const folder=path.join(artifact,'rea-focused-'+id,'input');fs.mkdirSync(folder,{recursive:true});
  fs.copyFileSync(path.join(root,relative),path.join(folder,path.basename(relative)));
  const output=fs.openSync(path.join(artifact,'rea-focused-'+id+'.json'),'w');
  const error=fs.openSync(path.join(artifact,'rea-focused-'+id+'.stderr.log'),'w');
  const run=spawnSync(process.execPath,[path.join(rea,'scripts','rea.mjs'),'analyze-javascript-application',folder,'--artifact-format','directory','--max-heap-mb','4096','--analysis-timeout-ms','45000','--format','json'],{cwd:root,stdio:['ignore',output,error],timeout:180000});
  fs.closeSync(output);fs.closeSync(error);
  if(run.status!==0)throw Error('REA focused analysis failed: '+id+' '+run.status);
  console.log('REA focused analysis completed:',id);
 }
}

const sources=new Map();
for(const label of ['original','baseline','rebuilt',...focuses.map(([id])=>'focused-'+id)]){
 const p=path.join(artifact,'rea-'+label+'.json');
 if(!fs.existsSync(p)){if(label.startsWith('focused-'))continue;throw Error('Missing REA analysis: '+label);}
 const evidence=read(p),parsed=parseApplicationGraphEvidence(evidence,['application']);
 if(!parsed.ok)throw Error('REA evidence authentication failed: '+label);
 sources.set(label,{evidence,parsed:parsed.value,bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))});
}

const traces=[];
function feature(label,key,value){
 const source=sources.get(label);if(!source)return;
 const r=traceApplicationFeature({sourceEvidenceId:source.evidence.evidence_id,graph:source.parsed.graph,nativeEvidence:[],seed:{kind:'string',value,match:'contains',case_sensitive:false},direction:'both'});
 traces.push({key,label,operation:'trace_application_feature',trace_id:r.trace_id,source_evidence_id:r.source_evidence_id,source_graph_id:r.source_graph_id,seed:r.seed,summary:r.summary,coverage:r.coverage,limitations:r.limitations,matched_nodes:(r.graph?.nodes||[]).filter(n=>r.seed_matches.some(s=>s.node_id===n.node_id)).map(n=>({node_id:n.node_id,kind:n.kind,labels:n.observations.map(o=>o.label),locations:n.observations.map(o=>o.evidence.location).filter(Boolean)})),path_samples:r.paths.slice(0,4)});
}
function semantic(label,key,{module,kind,label:nodeLabel}){
 const source=sources.get(label);if(!source)return;
 const graph=source.parsed.semanticGraph;
 const node=graph?.nodes.find(n=>(!module||n.identity.module_path.includes(module))&&n.kind===kind&&n.label===nodeLabel);
 if(!node){traces.push({key,label,operation:'trace_javascript_semantics',status:'no-seed-in-partial-graph',seed_selection:{module,kind,label:nodeLabel},limitations:['No matching semantic node in the available graph; this does not prove the behavior is absent.']});return;}
 const query={seed:{kind:'semantic-node',node_id:node.node_id},direction:'backward-provenance',include_ambiguous_dynamic_edges:false,expected:null};
 const r=queryJavaScriptSemanticGraph(graph,query);
 traces.push({key,label,operation:'trace_javascript_semantics',query_id:r.query_id,query,source_evidence_id:source.evidence.evidence_id,source_graph_id:r.source_graph_id,seed:r.seed,seed_location:node.evidence.location,seed_label:node.label,status:r.status,summary:r.summary,coverage:r.coverage,limitations:r.limitations,unknown_count:r.unknowns.length,unknown_samples:r.unknowns.slice(0,12).map(u=>({unknown_id:u.unknown_id,reason:u.reason,family:u.family,detail:u.detail,evidence:u.evidence})),node_samples:r.nodes.slice(0,12).map(n=>({node_id:n.node_id,kind:n.kind,label:n.label,location:n.evidence.location})),relation_samples:r.relations.slice(0,12)});
}

for(const [key,value]of [
 ['login-source','app.login.erp_login'],['company-source','xinfo001m'],['user-source','xemm001m'],['role-source','xemm009m'],['defaults-source','xesc006m'],['sessions-source','xemm005m'],['form-source','ecount.formset'],['inventory-source','inventory.order_management'],['inventory-vat-source','inventory_shared'],
])feature('original',key,value);
for(const [key,value]of [
 ['navigation','dist/app.js'],['menu-policy','dist/menu-core.js'],['inventory-kernel','dist/inventory-core.js'],['inventory-ui','dist/inventory-ui.js'],['forms-kernel','dist/form-core.js'],['form-options','dist/form-options.js'],['api-hub','dist/api-ui.js'],['api-contracts','dist/api-manual-data.js'],['api-manual','dist/api-manual.js'],['api-gateway','worker/gateway.cjs'],['app-login','dist/auth-ui.js'],
])for(const version of ['baseline','rebuilt'])feature(version,key,value);
for(const [key,value]of [['self-screens','dist/self-ui.js'],['self-contracts','dist/self-core.js'],['own-auth-service','worker/app-service.cjs'],['portal','dist/portal.js']])feature('rebuilt',key,value);
for(const [key,module,kind,label]of [
 ['company-login-input','app.login.erp_login','property-slot','com_code'],
 ['password-login-input','app.login.erp_login','property-slot','spasswd'],
 ['user-permission-input','xemm001m','property-slot','SLIP_AUTH_TYPE'],
 ['role-code-input','xemm009m','property-slot','CODE_NO'],
 ['form-type-selection','ecount.formset','property-slot','formType'],
 ['inventory-vat-calculation','inventory_shared','function','calculateInventoryVatAmount'],
])semantic('original',key,{module,kind,label});
for(const [key,module,kind,label]of [
 ['navigation-handler','dist/app.js','function','openMenu'],
 ['menu-access-policy','dist/menu-core.js','function','canOpen'],
 ['inventory-commands','dist/inventory-core.js','function','command'],
 ['form-validation','dist/form-core.js','function','validateForm'],
 ['api-request-policy','dist/api-ui.js','function','request'],
 ['manual-openapi-generation','dist/api-manual-data.js','function','openapi'],
 ['own-login-request','dist/auth-ui.js','function','request'],
 ['self-route-render','dist/self-ui.js','function','render'],
 ['config-validation','dist/self-core.js','function','validateConfig'],
])semantic('rebuilt',key,{module,kind,label});
for(const [label,key,module,nodeLabel]of [
 ['focused-inventory','inventory-policy-application','inventory-ui','commit'],
 ['focused-app-service','session-authorization','app-service','context'],
 ['focused-app-service','settings-mutations','app-service','handle'],
 ['focused-gateway','api-authorization','gateway','authorize'],
])semantic(label,key,{module,kind:'function',label:nodeLabel});

const comparison=compareApplicationVersionsEvidenceValidated({left:sources.get('baseline').evidence,right:sources.get('rebuilt').evidence,left_native_observations:[],right_native_observations:[]});
if(!comparison.ok)throw Error('REA version comparison failed');
const comparisonPath=path.join(artifact,'rea-version-comparison.json');fs.writeFileSync(comparisonPath,JSON.stringify(comparison.value));
const analyzed=sources.get('rebuilt').evidence.normalized_result;
const compactCoverage=c=>c?{...c,families:c.families?.map(({unknown_ids,...f})=>({...f,unknown_count:unknown_ids?.length??0,unknown_id_samples:unknown_ids?.slice(0,3)||[]}))}:null;
const sourceInventory=[...sources].map(([label,{evidence,bytes,sha256}])=>({label,evidence_id:evidence.evidence_id,raw_artifact:'.artifacts/rea-'+label+'.json',raw_sha256:sha256,raw_bytes:bytes,root_artifact_sha256:evidence.normalized_result.root_artifact_sha256,statistics:evidence.normalized_result.statistics,graph_coverage:evidence.normalized_result.graph.coverage,semantic_coverage:compactCoverage(evidence.normalized_result.semantic_graph?.coverage),semantic_unknown_count:evidence.normalized_result.semantic_graph?.unknowns?.length??null,limitations:evidence.limitations}));
const baseline=read(path.join(root,'evidence/rea-rebuild-baseline.json'));
const changes=baseline.files.map(old=>{
 const p=path.join(root,old.file),now=fs.existsSync(p)?sha(fs.readFileSync(p)):null;
 return {file:old.file,baseline_sha256:old.sha256,current_sha256:now,status:now===old.sha256?'retained-verified-kernel-or-contract':now?'changed':'removed'};
});
for(const folder of ['dist','worker'])for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
 const relative=folder+'/'+entry.name;
 if(entry.isFile()&&/\.(c?js)$/.test(entry.name)&&!changes.some(c=>c.file===relative))changes.push({file:relative,baseline_sha256:null,current_sha256:sha(fs.readFileSync(path.join(root,relative))),status:'added'});
}
const refreshedAfterAnalysis=changes.filter(c=>c.current_sha256&&!analyzed.graph.nodes.some(n=>n.observations.some(o=>o.properties?.path===c.file&&n.identity.sha256===c.current_sha256))).map(c=>c.file);
const compare=comparison.value.normalized_result;
write('evidence/rea-reconstruction-traces.json',{schema:1,rea_version:'6.4.0',method:'REA authenticated application graph + traceApplicationFeature + queryJavaScriptSemanticGraph; inert static analysis only',generated_at:new Date().toISOString(),baseline_commit:baseline.commit,sources:sourceInventory,traces,comparison:{evidence_id:comparison.value.evidence_id,artifact:'.artifacts/rea-version-comparison.json',sha256:sha(fs.readFileSync(comparisonPath)),comparison_id:compare.comparison_id,summary:compare.summary,matching:compare.matching,coverage:compare.coverage,limitations:compare.limitations,item_count:compare.items.length,item_samples:compare.items.slice(0,5)},source_changes:changes,files_changed_after_rebuilt_analysis:refreshedAfterAnalysis,limitations:['All trace relationships are static evidence, not proof of runtime invocation.','Semantic graphs have explicit partial coverage and dynamic unknowns.','Public provider sources do not reveal private server authorization, password storage, transactional rules, or full API behavior.','First-party independent tests do not prove ECOUNT equivalence or live ECOUNT API interoperability.','Retained kernels are reanalyzed and verified; this record does not claim every line was rewritten.']});

const require=createRequire(import.meta.url),C=require('../dist/inventory-core.js'),M=require('../dist/api-manual-data.js'),S=require('../dist/self-core.js'),Menu=require('../dist/menu-core.js');
const menu=read(path.join(root,'dist/menus.json')),rows=Menu.indexMenus(menu),inventoryRoutes=read(path.join(root,'evidence/inventory-route-coverage.json'));
const groups=[
 {id:'navigation',scope:'전체 메뉴·홈·검색·즐겨찾기·최근 메뉴',original:['evidence/ui-observations.json','evidence/public-sources.json','evidence/rea-application.json'],traces:['navigation','menu-policy','navigation-handler','menu-access-policy'],changes:'759개 메뉴 계층을 재분석하고 사용자별 상태 및 권한에 따른 진입 정책을 연결했습니다. 메뉴 존재가 모든 업무 기능 완성을 뜻하지 않습니다.',tests:['tests/menu-core.cjs','tests/auth.cjs','tests/self-dom.cjs'],unknowns:['원본의 개인별 권한·위젯 서버 저장 규칙','재고 I·Self-Customizing 외 안내 화면의 업무 기능']},
 {id:'inventory',scope:'재고 I 230개 경로·20종 전표·기초자료·조회',original:['inventory-source','inventory-vat-source','evidence/inventory-route-coverage.json'],traces:['inventory-kernel','inventory-ui','inventory-vat-calculation','inventory-commands','inventory-policy-application'],changes:'기존 검증된 계산 커널을 유지하고 명시적 명령 경계, 설정 정책 적용, 사용자별 브라우저 자료, 조회/입력 권한, 기본값 및 표시 설정의 적용 흐름을 개편했습니다.',tests:['tests/inventory-core.cjs','tests/inventory-dom.cjs','tests/self-dom.cjs','tests/self-auth.cjs'],unknowns:['원본의 모든 전표별 서버 처리·회계/재고 트랜잭션 내부 규칙','브라우저 재고 자료와 서버 API 자료는 별도 저장소이며 자동 동기화되지 않음']},
 {id:'forms',scope:'양식·Option·검색 조건·검증 규칙',original:['form-source','evidence/options-browser-verification.json'],traces:['forms-kernel','form-options','form-type-selection','form-validation'],changes:'양식 검증 커널을 재분석하고 편집할 입력·검색·조회 양식을 명시적으로 선택하도록 정리했습니다. 저장·활성화·삭제·규칙 명령에 사용자 권한과 현재 정책을 적용합니다.',tests:['tests/form-core.cjs','tests/form-dom.cjs','tests/inventory-dom.cjs','tests/self-dom.cjs'],unknowns:['원본의 모든 전표별 조건양식 및 금액조정 기능과의 완전한 동등성']},
 {id:'integrations',scope:'API 연결·키·매핑·수신·송신·대사',original:['기존 원본 API 매뉴얼 관찰: dist/api-manual-data.js providers','evidence/public-sources.json'],traces:['api-hub','api-gateway','api-request-policy','api-authorization'],changes:'서버 앱 계정·권한 및 세션 요청 위조 방지를 API 실행 경계로 연결하고 원본 28개 항목을 한 카탈로그로 통합했습니다. API 키 권한은 별도 유지하며 설정에 따른 업무 API 중지를 적용합니다.',tests:['tests/api-gateway.cjs','tests/api-dom.cjs','tests/self-auth.cjs'],unknowns:['실제 이카운트 계정의 OAPI 호출·저장 성공','외부 ERP 어댑터·실제 외부 전송·정기 실행기 미연결']},
 {id:'manual',scope:'사람이 읽는 전체 앱 API 매뉴얼·쌍방 기능 참조',original:['기존 원본 OAPI 매뉴얼의 공개 항목 관찰'],traces:['api-contracts','api-manual','manual-openapi-generation'],changes:'앱 인증·전체 API·설정 작업 계약을 문서화하고 원본 OAPI 제공 범위와 우리 기능의 대응·미제공·개념 참조를 구분합니다. 실제 응답 항목과 API 시험 화면을 연결합니다.',tests:['tests/api-manual.cjs','tests/api-dom.cjs','tests/self-auth.cjs'],unknowns:['기능 참조는 프로토콜 호환 또는 실제 전송 성공을 보증하지 않음']},
 {id:'login',scope:'회사코드·앱 ID·비밀번호·로그아웃·개인 세션',original:['login-source','company-login-input','password-login-input'],traces:['app-login','own-login-request','own-auth-service','session-authorization'],changes:'ChatGPT 식별자 로그인에서 자체 사용자·비밀번호 해시·보안 쿠키 세션·CSRF·잠금·세션 폐기·현재 권한 검사로 교체했습니다. 최초 관리자만 사용자가 앱 화면에서 직접 등록합니다.',tests:['tests/auth.cjs','tests/self-auth.cjs','tests/self-dom.cjs'],unknowns:['원본의 비밀번호 저장 알고리즘·세션·잠금 내부 정책','호스팅 외부 비공개 접근 제한은 유지되며 앱 계정과 별도','최초 관리자 등록 전 운영 계정 로그인 검증은 미완료']},
 {id:'self',scope:'Self-Customizing 31개 화면 + 기존 API 화면 2개',original:['company-source','user-source','role-source','defaults-source','sessions-source','user-permission-input','role-code-input'],traces:['self-screens','self-contracts','self-route-render','config-validation','settings-mutations'],changes:'안내 화면을 회사·사용자·권한·승인·기본값·기능·보안·세션·허용 IP·로그·백업·초기화·가져오기·편의 설정의 실제 저장 및 관리 화면으로 교체했습니다. 고객 그룹과 고객 계정별 읽기 포털을 연결합니다.',tests:['tests/self-auth.cjs','tests/self-dom.cjs'],unknowns:['Webmail·UserPay·경영요약 정기 전송은 설정 저장만 제공하며 외부 서비스는 미연결','원본의 모든 고급 설정·기능 세부 옵션을 동일하게 구현했다는 주장이 아님']},
];
const testReferences=[...new Set(groups.flatMap(g=>g.tests))].map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file))),execution_status:'See the release validation log; this ledger records assertions and does not run tests.'}));
write('evidence/rea-reconstruction-ledger.json',{schema:1,version:M.version,generated_at:new Date().toISOString(),baseline_commit:baseline.commit,coverage_method:'모든 기존 기능군을 분류하고 원본 정적 근거·실제 변경·독립 검증·미확인 영역을 연결. 모든 줄의 재작성 또는 원본 전체 동등성을 뜻하지 않음.',counts:{menu_areas:menu.length,menu_groups:menu.reduce((n,t)=>n+t.groups.length,0),menu_routes:rows.length,inventory_routes:inventoryRoutes.length,document_types:Object.keys(C.types).length,inventory_commands:C.commandNames.length,self_routes:Object.keys(S.routes).length,existing_api_routes:2,documented_api_operations:M.endpoints.length,documented_setting_actions:M.appActions.length,provider_manual_entries:M.providers.length},groups,inventory_documents:Object.entries(C.types).map(([id,title])=>({id,title,validation:'tests/inventory-core.cjs'})),inventory_route_coverage:inventoryRoutes,self_routes:Object.entries(S.routes).map(([id,view])=>({id,view,validation:['tests/self-dom.cjs','tests/self-auth.cjs']})),api_routes:['1-0-2','1-2-2'],api_operations:M.endpoints.map(e=>({id:e.id,method:e.method,path:e.path,scope:e.scope,provider_refs:e.peers})),setting_actions:M.appActions.map(([id,permission,fields,title])=>({id,permission,fields,title})),provider_references:M.providers.map(p=>({id:p.id,title:p.title,method:p.method,path:p.path,ours:p.ours,status:p.status,note:p.note})),tests:testReferences,trace_record:'evidence/rea-reconstruction-traces.json',boundaries:['원본 공개 JavaScript는 실행하지 않았고 인증정보 없이 받은 CDN 파일만 정적 분석했습니다.','원본 업무 레코드·인증키·비밀번호·쿠키·세션 URL은 이 증거에 포함하지 않습니다.','운영 데이터나 비밀번호를 생성하지 않고 독립 합성 자료로 검사합니다.','실제 ECOUNT API 호출·외부 이메일 발송·급여 전송은 수행하지 않았습니다.']});
console.log('REA reconstruction traces written:',traces.length,'traces;',sourceInventory.length,'authenticated source graphs.');
if(refreshedAfterAnalysis.length)console.log('Rerun rebuilt analysis before final release:',refreshedAfterAnalysis.join(', '));
