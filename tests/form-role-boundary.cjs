'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),F=require('../dist/form-core.js');
function fixture(){
 const dom=new JSDOM('<main id="target"></main>',{url:'https://synthetic.test',runScripts:'outside-only'}),w=dom.window,d=w.document,key='doc:request';let db=C.seed(),saves=0;
 for(const id of ['normal','special'])db=C.command(db,'formSave',{key,context:'print',form:{id,name:id,fields:[F.field('memo','적요')],page:{...F.pageDefaults}}}).db;
 db=C.command(db,'formActivate',{key,context:'print',id:'normal'}).db;
 const user={id:'owner',loginId:'same-user',company:{code:'SYNTH'},roleId:'admin'};
 w.AuthUI={state:()=>({user}),can:()=>true};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 for(const file of ['form-core.js','inventory-core.js','form-options.js'])w.eval(fs.readFileSync('dist/'+file,'utf8'));
 const api=w.FormOptions.create({key,store:()=>db.settings.customization,commit:(op,payload)=>{db=w.InventoryCore.command(db,op,payload).db;saves++;return true;},repaint:()=>{}}),host=d.getElementById('target');api.register('print','인쇄 양식',[w.FormCore.field('memo','적요')]);api.mount(host,'print');
 const dialog=()=>d.getElementById('form-options-dialog'),control=name=>{const node=[...d.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===name);assert.ok(node,name);return node;},button=name=>{const node=[...dialog().querySelectorAll('button')].find(n=>n.textContent===name);assert.ok(node,name);return node;};
 return {w,d,api,host,user,dialog,control,button,raw:()=>JSON.stringify(db),saves:()=>saves,close:()=>w.close()};
}
for(const action of ['양식 저장·적용','기본 양식 적용','선택 양식 삭제'])test('ordinary form '+action+' rejects a changed role even when both roles can write',()=>{
 const f=fixture();try{f.api.edit('print');f.control('양식명').value='keep unsaved';const before=f.raw();f.user.roleId='manager';f.button(action).click();assert.equal(f.saves(),0);assert.equal(f.raw(),before);assert.match(f.dialog().querySelector('[role=alert]').textContent,/권한그룹/);assert.equal(f.control('양식명').value,'keep unsaved');assert.equal(f.dialog().open,true);}finally{f.close();}
});
test('mounted form picker does not activate an old choice after a role change',()=>{
 const f=fixture();try{const picker=f.control('적용 양식'),before=f.raw();f.user.roleId='manager';picker.value='special';picker.dispatchEvent(new f.w.Event('change'));assert.equal(f.saves(),0);assert.equal(f.raw(),before);assert.equal(picker.value,'normal');assert.match(f.host.querySelector('[role=alert]').textContent,/권한그룹/);}finally{f.close();}
});
test('opening a form editor requires remount after the authenticated role changes',()=>{
 const f=fixture();try{const before=f.raw();f.user.roleId='manager';assert.throws(()=>f.api.edit('print'),/권한그룹/);assert.equal(f.dialog(),null);assert.equal(f.raw(),before);}finally{f.close();}
});
test('remount permits a fresh role draft while the prior role callback remains invalid',()=>{
 const f=fixture();try{f.api.edit('print');const oldSave=f.button('양식 저장·적용'),before=f.raw();f.user.roleId='manager';f.api.mount(f.host,'print');oldSave.click();assert.equal(f.saves(),0);assert.equal(f.raw(),before);f.api.edit('print');f.control('양식명').value='fresh manager form';f.button('양식 저장·적용').click();assert.equal(f.saves(),1);const saved=JSON.parse(f.raw()),prior=JSON.parse(before);assert.equal(saved.settings.customization.screens['doc:request'].forms.find(x=>x.id==='normal').name,'fresh manager form');assert.deepEqual(saved.documents,prior.documents);assert.deepEqual(saved.masters,prior.masters);}finally{f.close();}
});
