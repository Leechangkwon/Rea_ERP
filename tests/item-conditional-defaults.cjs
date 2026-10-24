'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),F=require('../dist/form-core.js'),I=require('../dist/item-core.js'),M=require('../dist/menu-core.js');
const make=(fields,id='master_test')=>({id,name:'기초등록 검증',fields});
function env({key='items',db=C.seed(),write=true}={}){
 const dom=new JSDOM('<main id="target"></main>',{url:'https://erp.test',runScripts:'outside-only'}),w=dom.window,d=w.document,toasts=[];w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.AuthUI={state:()=>({user:{id:'owner',roleId:'admin'}}),can:()=>write,settings:()=>({conveniences:{pageSize:20}})};
 w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));for(const name of ['form-core.js','item-core.js','price-request-core.js','inventory-core.js','form-options.js','reference-picker-ui.js','item-ui.js','item-list-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+name,'utf8'));
 const rows=M.indexMenus(require('../dist/menus.json')),route=rows.find(r=>r.top===2&&C.resolve(r).master===key&&C.resolve(r).kind==='master'),host=d.getElementById('target');assert.ok(route);
 const render=()=>{host.replaceChildren();w.InventoryUI.render(host,route,{rows,toast:v=>toasts.push(v),open(){}});};render();
 const click=(text,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);b.click();},field=(label,scope=d)=>{const n=[...scope.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===label);assert.ok(n,label);return n;},change=(label,value,scope=d)=>{const n=field(label,scope);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new w.Event('input',{bubbles:true}));n.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,d,host,toasts,render,click,field,change,db:()=>w.InventoryUI.snapshot(),close:()=>w.close()};
}

const key='master:items';
const clone=x=>JSON.parse(JSON.stringify(x));
function setup({company={},record,conditions=[{field:'unit',operator:'eq',value:'COMPANY'}],conditionalDefaults={},readonly=false}={}){
 let db=C.seed(); db.settings.itemRegistration=I.config({fields:Object.entries(company).map(([id,defaultValue])=>({id,defaultValue}))});
 if(record)db.masters.items.push({...record});
 const ordinary=I.formFields(db.settings.itemRegistration),special=ordinary.map(f=>({...f,label:f.id==='unit'?'조건 단위':f.label,defaultValue:Object.hasOwn(conditionalDefaults,f.id)?conditionalDefaults[f.id]:f.defaultValue}));
 special.push(F.field('x_qty','조건 수량','number',{custom:true,defaultValue:2}),F.field('x_total','조건 합계','number',{custom:true,formula:'buyPrice*x_qty'}));
 db=C.command(db,'formSave',{key,context:'input',form:{id:'conditional',name:'품목 조건양식',fields:special}}).db;
 db=C.command(db,'formSave',{key,context:'input',form:{id:'ordinary',name:'일반 품목양식',fields:ordinary}}).db;
 db=C.command(db,'formRules',{key,rules:[{id:'rule',enabled:true,context:'input',formId:'conditional',priority:0,conditionVersion:1,conditions}]}).db;
 const f=env({db,write:!readonly}),before=clone(f.db());f.click(record?record.code:'신규(F2)');return {...f,before};
}
function expectForm(f,id){assert.equal(f.field('적용 양식',f.d.querySelector('#inventory-dialog')).value,id);return f.d.querySelector('#inventory-dialog');}
function preserved(f){assert.deepEqual(clone(f.db()),f.before);}
const cases=[
 ['company unit', {company:{unit:'COMPANY'}}, {unit:'COMPANY'}],
 ['company supplier', {company:{supplier:'V001'},conditions:[{field:'supplier',operator:'eq',value:'V001'}]}, {supplier:'V001'}],
 ['configured zero and false',{company:{buyPrice:0,sellVatIncluded:false},conditions:[{field:'buyPrice',operator:'eq',value:'0'},{field:'sellVatIncluded',operator:'eq',value:'false'}]}, {buyPrice:'0',sellVatIncluded:false}],
 ['standard default EA',{conditions:[{field:'unit',operator:'eq',value:'EA'}]}, {unit:'EA'}],
 ['existing omitted default',{record:{code:'EXIST',name:'보존 품목',supplier:'V001',custom:{retained:'기존 추가값'}},conditions:[{field:'unit',operator:'eq',value:'EA'}]}, {unit:'EA'}]
];
for(const [name,options,expected] of cases)test('item conditional initial values '+name,()=>{const f=setup(options);try{expectForm(f,'conditional');for(const [id,v]of Object.entries(expected)){const x=f.d.querySelector('[data-item-field="'+id+'"]');assert.ok(x,id);assert.equal(x.type==='checkbox'?x.checked:x.value,v);}assert.ok(f.d.querySelector('[aria-label="조건 합계"]'));preserved(f);}finally{f.close();}});
test('selected form defaults apply after condition evaluation once, without recursive re-selection',()=>{const f=setup({company:{unit:'COMPANY',buyPrice:8,supplier:'V001'},conditionalDefaults:{unit:'FORM',buyPrice:9}});try{expectForm(f,'conditional');assert.equal(f.field('조건 단위').value,'FORM');assert.equal(f.field('조건 합계').value,'18');preserved(f);}finally{f.close();}});
test('existing explicit zero false blank and custom values override company defaults',()=>{const f=setup({company:{unit:'COMPANY',buyPrice:99,sellVatIncluded:true},record:{code:'EXIST',name:'보존 품목',unit:'',buyPrice:0,sellVatIncluded:false,supplier:'V001',custom:{x_qty:3,retained:'기존 추가값'}},conditions:[{field:'unit',operator:'eq',value:''},{field:'buyPrice',operator:'eq',value:'0'},{field:'sellVatIncluded',operator:'eq',value:'false'}]});try{expectForm(f,'conditional');assert.equal(f.field('조건 단위').value,'');assert.equal(f.field('조건 합계').value,'0');preserved(f);}finally{f.close();}});
test('current draft drives conditional reevaluation and retains zero false blank supplier and formula inputs',()=>{const f=setup({company:{unit:'COMPANY',buyPrice:8,supplier:'V001'}});try{expectForm(f,'conditional');f.change('품목코드','DRAFT01');f.change('품목명','보존 초안');f.change('조건 단위','DRAFT');f.change('입고단가','0');f.change('규격','');f.change('출고단가 VAT포함',false);f.change('조건 수량','3');f.change('적용 양식','ordinary',f.d.querySelector('#inventory-dialog'));expectForm(f,'ordinary');assert.equal(f.field('단위').value,'DRAFT');assert.equal(f.field('입고단가').value,'0');assert.equal(f.field('규격').value,'');assert.equal(f.field('구매처').value,'V001');assert.equal(f.field('품목명').value,'보존 초안');assert.equal(f.field('출고단가 VAT포함').checked,false);const saved=f.db();assert.deepEqual(clone(saved.masters),f.before.masters);assert.deepEqual(clone(saved.documents),f.before.documents);assert.deepEqual(clone(saved.settings.itemRegistration),f.before.settings.itemRegistration);}finally{f.close();}});
test('nonmatching conditions retain ordinary active selection and original data',()=>{const f=setup({company:{unit:'OTHER'}});try{expectForm(f,'ordinary');assert.equal(f.field('단위').value,'OTHER');preserved(f);}finally{f.close();}});
