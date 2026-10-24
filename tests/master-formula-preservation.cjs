'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),F=require('../dist/form-core.js'),C=require('../dist/inventory-core.js');
const fields=(extra={})=>[F.field('x_factor','계산 기준','number',{custom:true,...extra}),F.field('x_total','계산 결과','number',{custom:true,formula:'x_factor*2'})];
function fixture(customFields,custom={x_factor:'legacy-7',x_total:777,x_unknown:'원문 보존'}){
 const dom=new JSDOM('<main id="host"></main>',{url:'https://erp.test',runScripts:'outside-only'}),w=dom.window,d=w.document,saves=[],db=C.seed(),record={...db.masters.items.find(x=>x.code==='M001'),custom:JSON.parse(JSON.stringify(custom))};
 for(const file of ['form-core.js','item-core.js','item-ui.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
 const api=w.ItemUI.render(d.getElementById('host'),{db,record,originalCode:record.code,customFields,onSave:value=>{saves.push(JSON.parse(JSON.stringify(value)));return true;}}),input=id=>d.querySelector('[data-item-field="'+id+'"]'),save=async()=>{[...d.querySelectorAll('button')].find(x=>x.textContent==='저장(F8)').click();await new Promise(r=>setImmediate(r));},change=(id,value)=>{const el=input(id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};return {w,d,api,record,input,saves,save,change,close:()=>w.close()};
}
for(const text of ['legacy-7','1,200','0x10','1e309'])test('numeric type change preserves unrepresentable original '+text+' and rejects silent save',async()=>{
 const f=fixture([fields()[0]],{x_factor:text,x_total:777,x_unknown:'원문 보존'});try{const before=JSON.stringify(f.record);assert.equal(f.input('x_factor').value,text);assert.equal(f.api.read().custom.x_factor,text);await f.save();assert.equal(f.saves.length,0);assert.match(f.d.querySelector('.item-error').textContent,/숫자/);assert.equal(JSON.stringify(f.record),before);assert.equal(f.input('x_factor').value,text);}finally{f.close();}
});
test('hidden invalid numeric original becomes editable and focuses on failed save, then explicit correction saves',async()=>{
 const f=fixture(fields({visible:false}));try{const input=f.input('x_factor');assert.equal(input.closest('label').hidden,false);await f.save();assert.equal(f.saves.length,0);assert.equal(f.d.querySelector('.item-editor').dataset.itemTab,'extra');assert.equal(f.d.activeElement,input);f.change('x_factor','3');assert.equal(f.input('x_total').value,'6');await f.save();assert.equal(f.saves.length,1);assert.equal(f.saves[0].custom.x_factor,3);assert.equal(f.saves[0].custom.x_total,6);assert.equal(f.saves[0].custom.x_unknown,'원문 보존');}finally{f.close();}
});
test('invalid formula dependency snapshot preserves raw source, cached result and unrelated draft',async()=>{
 const f=fixture(fields());try{f.change('name','양식 전환 전 초안');const draft=f.api.read();assert.equal(draft.name,'양식 전환 전 초안');assert.equal(draft.custom.x_factor,'legacy-7');assert.equal(draft.custom.x_total,777);assert.equal(draft.custom.x_unknown,'원문 보존');assert.equal(f.input('x_total').value,'');await f.save();assert.equal(f.saves.length,0);}finally{f.close();}
});
test('zero division snapshot preserves last saved computed value while save stays blocked until corrected',async()=>{
 const f=fixture([fields()[0],{...fields()[1],formula:'10/x_factor'}],{x_factor:0,x_total:777,x_unknown:'원문 보존'});try{assert.equal(f.api.read().custom.x_total,777);assert.equal(f.input('x_total').value,'');await f.save();assert.equal(f.saves.length,0);assert.match(f.d.querySelector('.item-error').textContent,/0으로/);f.change('x_factor','2');assert.equal(f.api.read().custom.x_total,5);await f.save();assert.equal(f.saves[0].custom.x_total,5);}finally{f.close();}
});
test('explicitly clearing an optional invalid numeric original remains allowed',async()=>{
 const f=fixture([fields()[0]]);try{f.change('x_factor','');await f.save();assert.equal(f.saves.length,1);assert.equal(f.saves[0].custom.x_factor,'');assert.equal(f.saves[0].custom.x_total,777);}finally{f.close();}
});
test('text layout preserves zero-prefixed identifiers and numeric layout retains ordinary numeric controls',()=>{
 const text=fixture([{...fields()[0],type:'text'}],{x_factor:'00123',x_total:777}),numeric=fixture(fields(),{x_factor:2.5,x_total:999});try{assert.equal(text.api.read().custom.x_factor,'00123');assert.equal(numeric.input('x_factor').type,'number');assert.equal(numeric.api.read().custom.x_total,5);assert.equal(numeric.input('x_total').disabled,true);}finally{text.close();numeric.close();}
});
test('formula display tampering is ignored in snapshots and saved values',async()=>{
 const f=fixture(fields(),{x_factor:3,x_total:777});try{f.input('x_total').value='999';assert.equal(f.api.read().custom.x_total,6);await f.save();assert.equal(f.saves[0].custom.x_total,6);}finally{f.close();}
});
test('corrected custom values and all inactive form definitions survive validated backup restore',()=>{
 let db=C.seed();const form=(id,type)=>({id,name:id,fields:[F.field('code','코드'),F.field('name','품목명'),{...fields()[0],type},fields()[1]]});
 db=C.command(db,'formSave',{key:'master:items',context:'input',form:form('text_form','text')}).db;db=C.command(db,'formSave',{key:'master:items',context:'input',form:form('number_form','number')}).db;
 const item=db.masters.items.find(x=>x.code==='M001'),out=C.command(db,'master',{key:'items',originalCode:item.code,record:{...item,custom:{x_factor:3,x_total:999,x_unknown:'원문 보존'}}}),before=JSON.stringify(out.db),restored=C.validateBackup(JSON.parse(before));assert.equal(restored.masters.items.find(x=>x.code==='M001').custom.x_total,6);assert.equal(JSON.stringify(out.db),before);assert.deepEqual(restored.settings.customization,out.db.settings.customization);
});
