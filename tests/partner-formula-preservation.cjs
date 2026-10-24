'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),F=require('../dist/form-core.js'),M=require('../dist/menu-core.js');
function env({key='items',db=C.seed(),write=true}={}){
 const dom=new JSDOM('<main id="target"></main>',{url:'https://erp.test',runScripts:'outside-only'}),w=dom.window,d=w.document,toasts=[];w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.AuthUI={state:()=>({user:{id:'owner',roleId:'admin'}}),can:()=>write,settings:()=>({conveniences:{pageSize:20}})};
 w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));for(const name of ['form-core.js','item-core.js','price-request-core.js','inventory-core.js','form-options.js','reference-picker-ui.js','item-ui.js','item-list-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+name,'utf8'));
 const rows=M.indexMenus(require('../dist/menus.json')),route=rows.find(r=>r.top===2&&C.resolve(r).master===key&&C.resolve(r).kind==='master'),host=d.getElementById('target');assert.ok(route);
 const render=()=>{host.replaceChildren();w.InventoryUI.render(host,route,{rows,toast:v=>toasts.push(v),open(){}});};render();
 const click=(text,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);b.click();},field=(label,scope=d)=>{const n=[...scope.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===label);assert.ok(n,label);return n;},change=(label,value,scope=d)=>{const n=field(label,scope);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new w.Event('input',{bubbles:true}));n.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,d,host,toasts,render,click,field,change,db:()=>w.InventoryUI.snapshot(),close:()=>w.close()};
}

function fixture({text='legacy-7',formula='',hidden=false,key='partners'}={}){
 let db=C.seed();const fields=numeric=>[F.field('code',C.masterNames[key]+'코드','text',{protected:true,required:true}),F.field('name',C.masterNames[key]+'명','text',{protected:true,required:true}),F.field('x_factor',numeric?'계산 기준':'기준 원문',numeric?'number':'text',{custom:true,visible:!hidden||!numeric}),F.field('x_total','보존 계산값','number',{custom:true,...(numeric&&formula?{formula}:{})})];
 for(const [id,numeric]of [['text_form',false],['number_form',true]])db=C.command(db,'formSave',{key:'master:'+key,context:'input',form:{id,name:id,fields:fields(numeric)}}).db;
 const record=db.masters[key][0];record.custom={x_factor:text,x_total:777,x_unknown:'원문 보존'};
 const f=env({key,db}),before=JSON.stringify(f.db().masters);f.click('수정');const dialog=f.d.getElementById('inventory-dialog'),choose=id=>{const picker=f.field('적용 양식',dialog);picker.value=id;picker.dispatchEvent(new f.w.Event('change',{bubbles:true}));};return {...f,dialog,choose,before,record,save:()=>f.click('저장(F8)',dialog)};
}
for(const text of ['legacy-7','1,200','0x10','1e309'])test('partner numeric form retains unrepresentable original '+text+' and blocks silent save',()=>{
 const f=fixture({text});try{assert.equal(f.field('계산 기준',f.dialog).value,text);f.save();assert.equal(JSON.stringify(f.db().masters),f.before);assert.match(f.toasts.at(-1),/숫자/);assert.equal(f.field('계산 기준',f.dialog).value,text);f.change('계산 기준','3',f.dialog);f.save();assert.equal(f.db().masters.partners[0].custom.x_factor,3);assert.equal(f.db().masters.partners[0].custom.x_unknown,'원문 보존');}finally{f.close();}
});
test('partner invalid hidden field is revealed and receives focus after blocked save',()=>{
 const f=fixture({hidden:true});try{const x=f.field('계산 기준',f.dialog);assert.equal(x.closest('label').hidden,false);f.save();assert.equal(f.d.activeElement,x);assert.equal(JSON.stringify(f.db().masters),f.before);}finally{f.close();}
});
test('partner formula failure preserves cached result raw text and unsaved base fields through form switching',()=>{
 const f=fixture({formula:'x_factor*2'});try{f.change(C.masterNames.partners+'명','전환 전 초안',f.dialog);assert.equal(f.field('보존 계산값',f.dialog).value,'');f.save();assert.equal(JSON.stringify(f.db().masters),f.before);f.choose('text_form');assert.equal(f.field('기준 원문',f.dialog).value,'legacy-7');assert.equal(f.field('보존 계산값',f.dialog).value,'777');assert.equal(f.field(C.masterNames.partners+'명',f.dialog).value,'전환 전 초안');f.choose('number_form');f.change('계산 기준','3',f.dialog);assert.equal(f.field('보존 계산값',f.dialog).value,'6');f.save();const saved=f.db(),p=saved.masters.partners[0];assert.equal(p.name,'전환 전 초안');assert.deepEqual(JSON.parse(JSON.stringify(p.custom)),{x_factor:3,x_total:6,x_unknown:'원문 보존'});assert.deepEqual(C.validateBackup(JSON.parse(JSON.stringify(saved))).masters,JSON.parse(JSON.stringify(saved.masters)));}finally{f.close();}
});
test('partner division error clears displayed result but preserves last stored cache on text form return',()=>{
 const f=fixture({text:0,formula:'10/x_factor'});try{assert.equal(f.field('보존 계산값',f.dialog).value,'');f.choose('text_form');assert.equal(f.field('보존 계산값',f.dialog).value,'777');assert.equal(f.field('기준 원문',f.dialog).value,'0');assert.equal(JSON.stringify(f.db().masters),f.before);}finally{f.close();}
});
test('partner calculation display is never treated as editable source data',()=>{
 const f=fixture({text:2,formula:'x_factor*2'});try{f.field('보존 계산값',f.dialog).value='9999';f.choose('text_form');assert.equal(f.field('보존 계산값',f.dialog).value,'4');f.choose('number_form');f.save();assert.equal(f.db().masters.partners[0].custom.x_total,4);}finally{f.close();}
});
test('partner explicit optional clearing remains allowed without deleting unknown custom data',()=>{
 const f=fixture();try{f.change('계산 기준','',f.dialog);f.save();const p=f.db().masters.partners[0];assert.equal(p.custom.x_factor,'');assert.equal(p.custom.x_total,777);assert.equal(p.custom.x_unknown,'원문 보존');}finally{f.close();}
});
test('general warehouse registration shares the same numeric preservation boundary',()=>{
 const f=fixture({key:'warehouses'});try{assert.equal(f.field('계산 기준',f.dialog).value,'legacy-7');f.save();assert.equal(JSON.stringify(f.db().masters),f.before);f.choose('text_form');assert.equal(f.field('기준 원문',f.dialog).value,'legacy-7');}finally{f.close();}
});
