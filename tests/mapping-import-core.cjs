'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),E=require('../dist/entry-core.js'),F=require('../dist/form-core.js'),M=require('../dist/mapping-core.js');
const field=(id,type='text',extra={})=>F.field(id,id,type,{custom:true,...(id==='x_header'?{multiline:true}:{}),...extra});
function form(db,type,context,fields,id=context){db.settings.customization=F.save(db.settings.customization,'doc:'+type,context,{id,name:id,fields});}
const link=(source,target,context='input')=>({source:{context,id:source},target:{context,id:target}});
function config(entries=[link('memo','x_header'),link('x_src','x_target','lines')]){return {rules:[{id:'MAP',from:'order',to:'request',enabled:true,fieldLinks:{version:1,entries}}]};}
function fixture(){const db=C.empty();db.masters=C.clone(C.seed().masters);
 form(db,'order','input',[field('x_note'),field('x_num','number'),field('x_bool','checkbox'),field('x_date','date')]);
 form(db,'order','lines',[field('x_src'),field('x_num','number')]);
 form(db,'request','input',[field('x_header'),field('x_note'),field('x_num','number'),field('x_bool','checkbox'),field('x_date','date')]);
 form(db,'request','lines',[field('x_target'),field('x_num','number')]);
 const saved=C.command(db,'document',{type:'order',date:'2026-10-22',warehouse:'W001',partner:'V001',memo:'상단\n적요',custom:{x_note:'메모',x_num:0,x_bool:false,x_date:'2026-10-23'},vatRate:10,lines:[{item:'M001',qty:10,price:100,custom:{x_src:'LOT-A',legacy:'kept',x_num:0}}]});
 return {db:saved.db,source:saved.result,draft:{type:'request',date:'2026-10-23',warehouse:'W001',vatRate:10,memo:'작성 중',custom:{legacy:'draft'},lines:[]}};
}
function stage(x,extra={},mapping=config()){return E.stageDocuments(x.db,x.draft,{mode:'copy',grouping:'line',selections:[{documentId:x.source.id,item:'M001',qty:2.5}],mappingConfig:mapping,...extra});}
const unchanged=(x,run,pattern)=>{const before=JSON.stringify(x);assert.throws(run,pattern);assert.equal(JSON.stringify(x),before);};
test('absent legacy disabled empty and unrelated mapping configurations preserve the exact existing import',()=>{
 const x=fixture(),baseline=stage(x,{mappingConfig:undefined});
 for(const value of [null,{}, {rules:[]},{rules:[{id:'L',from:'order',to:'request',enabled:true}]},config([]),{rules:config().rules.map(r=>({...r,enabled:false}))},{rules:[{id:'OTHER',from:'purchaseorder',to:'purchase',enabled:true,fieldLinks:{version:99}}]}])assert.deepEqual(stage(x,{},value),baseline);
 assert.equal(Object.hasOwn(baseline,'fieldLinks'),false);
});
test('catalog uses effective visible editable primitive form fields rather than every stored field ID',()=>{
 const x=fixture();form(x.db,'order','input',[field('x_note'),field('x_hidden','text',{visible:false}),field('x_read','text',{readonly:true}),field('x_protected','text',{protected:true}),field('x_select','select',{options:['A']}),field('x_base','number'),field('x_calc','number',{formula:'x_base * 2'})]);
 assert.deepEqual(M.catalog(x.db,'order','input',x.source).fields.map(f=>f.id),['x_note','x_base','memo']);
 assert.equal(M.catalog(x.db,'request','input',x.draft).fields.some(f=>f.id==='memo'),false);
 form(x.db,'request','input',[field('x_mobile')],'mobile');x.db.settings.customization=F.activate(x.db.settings.customization,'doc:request','input','input');
 x.db.settings.customization=F.rules(x.db.settings.customization,'doc:request',[{id:'mobile',enabled:true,context:'input',formId:'mobile',conditionVersion:1,conditions:[{source:'client',field:'mode',operator:'eq',value:'MOBILE'},{source:'session',field:'roleId',operator:'eq',value:'buyer'}]}]);
 assert.deepEqual(M.catalog(x.db,'request','input',x.draft,{mode:'MOBILE',roleId:'buyer',userId:'u'}).fields.map(f=>f.id),['x_mobile']);
 assert.equal(M.catalog(x.db,'request','input',x.draft,{mode:'PC',roleId:'buyer'}).formId,'input');
});
test('explicit zero false date and multiline values transfer without coercion or source mutations',()=>{
 const x=fixture(),before=JSON.stringify(x),entries=[link('memo','x_header'),...['x_note','x_num','x_bool','x_date'].map(id=>link(id,id)),link('x_src','x_target','lines')];
 const out=stage(x,{},config(entries));assert.deepEqual(out.custom,{legacy:'draft',x_header:'상단\n적요',x_note:'메모',x_num:0,x_bool:false,x_date:'2026-10-23'});
 assert.equal(out.lines[0].custom.x_target,'LOT-A');assert.equal(out.lines[0].custom.legacy,'kept');assert.equal(out.lines[0].qty,2.5);assert.equal(out.lines[0].price,100);assert.equal(out.memo,'작성 중');assert.equal(out.sourceId,undefined);assert.equal(JSON.stringify(x),before);
 const numeric=fixture();numeric.db.documents[0].custom.x_num='0.00';assert.equal(stage(numeric,{},config([link('x_num','x_num')])).custom.x_num,'0.00');
});
test('reused source fields and missing null or blank values do not erase the target draft',()=>{
 const x=fixture();x.db.documents[0].memo='한 원본 두 대상';let out=stage(x,{},config([link('memo','x_header'),link('memo','x_note')]));assert.equal(out.custom.x_header,out.custom.x_note);
 for(const value of [undefined,null,'']){x.db.documents[0].custom.x_note=value;x.draft.custom.x_note='기존';out=stage(x,{},config([link('x_note','x_note')]));assert.equal(out.custom.x_note,'기존');}
});
test('line mapping resolves duplicate items by source line ID and preserves existing rows and imported lineage',()=>{
 const x=fixture();x.db.documents[0].lines[0].lineId='SRC1';x.db.documents[0].lines.push({...C.clone(x.db.documents[0].lines[0]),lineId:'SRC2',custom:{x_src:'LOT-B'}});
 x.draft.lines=[{lineId:'L1',item:'M002',qty:1,price:30,custom:{legacy:'existing'}}];const old=C.clone(x.draft.lines[0]);
 const out=stage(x,{selections:[{documentId:x.source.id,item:'M001',lineId:'SRC2',qty:3},{documentId:x.source.id,item:'M001',lineId:'SRC1',qty:2}]});
 assert.deepEqual(out.lines[0],old);assert.deepEqual(out.lines.slice(1).map(l=>[l.custom.x_target,l.qty,l.importedFrom[0].sourceLineId]),[['LOT-B',3,'SRC2'],['LOT-A',2,'SRC1']]);assert.equal(new Set(out.lines.map(l=>l.lineId)).size,3);
 assert.equal(JSON.stringify(out).includes('fieldLinks'),false);assert.equal(JSON.stringify(out).includes('proposals'),false);
 unchanged(x,()=>stage(x),/라인/);
});
test('type read-only unknown field and invalid value failures are atomic even after a valid earlier mapping',()=>{
 const bad=[['text',123,{}],['number','NaN',{}],['date','2026-02-30',{}],['checkbox','false',{}],['text','value',{readonly:true}],['text','value',{visible:false}]];
 for(const [type,value,flags]of bad){const x=fixture();form(x.db,'order','input',[field('x_note',type)]);form(x.db,'request','input',[field('x_header'),field('x_note',type,flags)]);x.db.documents[0].custom.x_note=value;unchanged(x,()=>stage(x,{},config([link('memo','x_header'),link('x_note','x_note')])));}
 const x=fixture();form(x.db,'request','input',[field('x_header'),field('x_note','number')]);unchanged(x,()=>stage(x,{},config([link('memo','x_header'),link('x_note','x_note')])),/같은 항목 형식/);
 for(const id of ['x_missing','constructor','x.path'])unchanged(x,()=>stage(x,{},config([link('memo',id)])));
});
test('existing values and nonblank form defaults reject conflicts without replacing the draft',()=>{
 const x=fixture();x.draft.custom.x_header='보존';unchanged(x,()=>stage(x),/기존 값/);x.draft.custom.x_header=x.source.memo;assert.equal(stage(x).custom.x_header,x.source.memo);
 delete x.draft.custom.x_header;form(x.db,'request','input',[field('x_header','text',{defaultValue:'기본값'})]);unchanged(x,()=>stage(x),/기본값/);
});
test('multiple orders allow body-only maps but never select one header implicitly',()=>{
 const x=fixture(),other=C.clone(x.db.documents[0]);other.id='ORDER-OTHER';other.lines[0].custom.x_src='OTHER';x.db.documents.push(other);
 const selections=[{documentId:x.source.id,item:'M001',qty:1},{documentId:other.id,item:'M001',qty:2}];unchanged(x,()=>stage(x,{selections}),/한 건/);
 const out=stage(x,{selections},config([link('x_src','x_target','lines')]));assert.deepEqual(out.lines.map(l=>l.custom.x_target),['LOT-A','OTHER']);
 other.type='purchaseorder';unchanged(x,()=>stage(x,{selections},config([link('x_src','x_target','lines')])),/주문만/);
});
test('unsupported merge header-adoption and linked paths cannot silently drop configured field mappings',()=>{
 const x=fixture();for(const options of [{grouping:'item'},{adoptHeader:true},{mode:'linked'},{history:true}])unchanged(x,()=>stage(x,options));
 for(const options of [{status:'취소'},{status:'삭제'}]){const y=fixture();Object.assign(y.db.documents[0],options);if(!C.active(y.db.documents[0]))unchanged(y,()=>stage(y));}
});
test('mapping cannot change the target conditional form during header application',()=>{
 const x=fixture();form(x.db,'request','input',[field('x_header')],'changed');x.db.settings.customization=F.activate(x.db.settings.customization,'doc:request','input','input');
 x.db.settings.customization=F.rules(x.db.settings.customization,'doc:request',[{id:'change',enabled:true,context:'input',formId:'changed',field:'x_header',operator:'eq',value:x.source.memo}]);
 unchanged(x,()=>stage(x),/양식이 바뀝니다/);
});
test('unknown mapping versions and ambiguous active rules are rejected while unrelated future metadata stays isolated',()=>{
 const x=fixture(),future=config();future.rules[0].fieldLinks.version=2;unchanged(x,()=>stage(x,{},future));
 const duplicate=config();duplicate.rules.push({...C.clone(duplicate.rules[0]),id:'MAP2'});unchanged(x,()=>stage(x,{},duplicate));
 const valid=config();valid.rules.push({id:'UNRELATED',from:'sale',to:'purchase',enabled:true,fieldLinks:{version:99}});assert.equal(stage(x,{},valid).custom.x_header,x.source.memo);
});
test('text and aggregate byte review limits refuse overflow without truncation or partial results',()=>{
 const x=fixture();x.db.documents[0].memo='가'.repeat(20000);assert.equal(stage(x).custom.x_header.length,20000);x.db.documents[0].memo+='가';unchanged(x,()=>stage(x),/길이/);
 const y=fixture(),entries=[],fields=[];for(let i=0;i<18;i++){fields.push(field('x_long'+i));entries.push(link('memo','x_long'+i));}form(y.db,'request','input',fields);y.db.documents[0].memo='가'.repeat(20000);unchanged(y,()=>stage(y,{},config(entries)),/1MiB/);
});
test('saved request and backup keep mapped customs quantity price tax settings and original order intact',()=>{
 const x=fixture(),source=C.clone(x.db.documents[0]),settings=C.clone(x.db.settings),initialStock=C.stock(x.db,'M001','W001');
 const out=stage(x),saved=C.command(x.db,'document',out),restored=C.validateBackup(C.clone(saved.db)),request=restored.documents.at(-1);
 assert.equal(request.custom.x_header,source.memo);assert.equal(request.lines[0].custom.x_target,'LOT-A');assert.equal(request.lines[0].qty,2.5);assert.equal(request.lines[0].price,100);assert.equal(request.lines[0].supply,250);assert.equal(request.lines[0].tax,25);assert.equal(request.lines[0].total,275);
 assert.deepEqual(restored.documents[0],source);assert.deepEqual(restored.settings,settings);assert.equal(C.stock(restored,'M001','W001'),initialStock);assert.equal(request.lines[0].importedFrom[0].documentId,source.id);
});

test('review proposals stay separate from the source incoming rows and unsaved draft',()=>{
 const x=fixture(),selection=[{documentId:x.source.id,item:'M001',qty:2.5}],baseline=stage(x,{mappingConfig:undefined}),incoming=C.clone(baseline.lines),before=JSON.stringify({x,incoming});
 const reviewed=M.stage(x.db,x.draft,incoming,selection,config(),{mode:'copy',grouping:'line'});
 assert.deepEqual(reviewed.proposals.map(p=>[p.context,p.source,p.target,p.status]),[['input','memo','x_header','proposed'],['lines','x_src','x_target','proposed']]);
 assert.equal(reviewed.customChanged,true);assert.equal(JSON.stringify({x,incoming}),before);assert.equal(Object.hasOwn(reviewed.lines[0],'proposals'),false);
});
test('browser UMD load order resolves mapping before EntryCore and reads SelfCore only at application time',()=>{
 const fs=require('node:fs'),{JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html>',{runScripts:'outside-only',url:'https://erp.test/'}),w=dom.window;
 try{const html=fs.readFileSync('dist/index.html','utf8');assert.ok(html.indexOf('src="mapping-core.js"')<html.indexOf('src="entry-core.js"'));
  for(const name of ['form-core.js','item-core.js','inventory-core.js','mapping-core.js','entry-core.js'])w.eval(fs.readFileSync('dist/'+name,'utf8'));
  const x=fixture(),options={mode:'copy',grouping:'line',selections:[{documentId:x.source.id,item:'M001',qty:2.5}],mappingConfig:config()};
  assert.ok(w.MappingCore.catalog(x.db,'request','input',x.draft).fields.length);assert.throws(()=>w.EntryCore.stageDocuments(x.db,x.draft,options),/메뉴 매핑 저장 규칙/);
  w.eval(fs.readFileSync('dist/self-core.js','utf8'));const out=w.EntryCore.stageDocuments(x.db,x.draft,options);assert.equal(out.custom.x_header,x.source.memo);assert.equal(out.lines[0].custom.x_target,'LOT-A');assert.equal(out.lines[0].qty,2.5);
 }finally{w.close();}
});

test('mapped multiline text must roundtrip through target controls without CR or single-line newline loss',()=>{
 const x=fixture();form(x.db,'request','input',[field('x_header','text',{multiline:false})]);unchanged(x,()=>stage(x),/줄바꿈/);
 form(x.db,'request','input',[field('x_header','text',{multiline:true})]);assert.equal(stage(x).custom.x_header,x.source.memo);
 // Use actual CRLF, which a native textarea would normalize into LF.
 x.db.documents[0].memo='첫째'+String.fromCharCode(13,10)+'둘째';unchanged(x,()=>stage(x),/줄바꿈/);
});
