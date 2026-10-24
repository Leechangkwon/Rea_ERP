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


function fixture(key='partners'){
 let db=C.seed();for(const id of ['first','second'])db=C.command(db,'formSave',{key:'master:'+key,context:'input',form:{id,name:id,fields:[F.field('code',C.masterNames[key]+'코드','text',{protected:true,required:true}),F.field('name',C.masterNames[key]+'명','text',{protected:true,required:true}),F.field('x_note','추가문구','text',{custom:true})]}}).db;
 const f=env({key,db});f.click('수정');const dialog=f.d.getElementById('inventory-dialog');f.change(C.masterNames[key]+'명','보존할 미저장 초안',dialog);if(key==='items')f.click('부가정보',dialog);f.change('추가문구','기존 입력 보존',dialog);
 let commands=0;const original=f.w.InventoryCore.command;f.w.InventoryCore.command=(...args)=>{commands++;return original(...args);};
 const raw=()=>f.w.localStorage.getItem('ecount-inventory-v2'),fields=()=>JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].filter(x=>!x.closest('.form-option-bar')).map(x=>[x.getAttribute('aria-label'),x.value,x.checked])),save=()=>f.click('저장(F8)',dialog),picker=()=>f.field('적용 양식',dialog),choose=()=>{const p=picker();p.value='first';p.dispatchEvent(new f.w.Event('change',{bubbles:true}));};return {...f,dialog,raw,fields,save,choose,picker,commands:()=>commands};
}
const mutations=[
 ['logout',f=>{f.w.AuthUI.state=()=>({user:null});}],
 ['account',f=>{f.w.AuthUI.state=()=>({user:{id:'other',roleId:'admin'}});}],
 ['company',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'admin',company:{code:'OTHER'}}});}],
 ['role',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'other'}});}],
 ['login ID',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'admin',loginId:'other'}});}],
 ['read permission',f=>{f.w.AuthUI.can=p=>p!=='inventory.read';}],
 ['write permission',f=>{f.w.AuthUI.can=p=>p!=='inventory.write';}],
 ['external storage',f=>{const d=JSON.parse(f.raw());d.settings.externalMarker='preserve';f.w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(d));}],
 ['detached editor',f=>{f.dialog.remove();}]
];
for(const key of ['partners','warehouses'])for(const [name,mutate]of mutations)test(key+' save refuses '+name+' before command while preserving raw draft',()=>{
 const f=fixture(key);try{const draft=f.fields();mutate(f);const raw=f.raw();f.save();assert.equal(f.commands(),0);assert.equal(f.raw(),raw);assert.equal(f.fields(),draft);assert.match(f.toasts.at(-1),/계정|권한|자료|변경|닫|다른/);}finally{f.close();}
});
for(const [name,mutate]of mutations)test('partner layout refuses '+name+' and restores picker without mutating fields or storage',()=>{
 const f=fixture();try{const draft=f.fields(),selected=f.picker().value;mutate(f);const raw=f.raw();f.choose();assert.equal(f.commands(),0);assert.equal(f.raw(),raw);assert.equal(f.fields(),draft);assert.equal(f.picker().value,selected);assert.match(f.dialog.querySelector('.form-option-bar [role=alert]').textContent,/계정|권한|자료|변경|닫|다른/);}finally{f.close();}
});
for(const key of ['partners','warehouses'])test(key+' unchanged owner can switch layouts then save its preserved draft once',()=>{
 const f=fixture(key);try{const documents=JSON.stringify(f.db().documents);f.choose();assert.equal(f.commands(),1);assert.equal(f.field(C.masterNames[key]+'명',f.dialog).value,'보존할 미저장 초안');assert.equal(f.field('추가문구',f.dialog).value,'기존 입력 보존');f.save();assert.equal(f.commands(),2);assert.equal(f.db().masters[key][0].name,'보존할 미저장 초안');assert.equal(JSON.stringify(f.db().documents),documents);}finally{f.close();}
});
test('same-account role switch blocks item editor save through its dedicated path',()=>{
 const f=fixture('items');try{const raw=f.raw(),draft=f.fields();f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'other'}});f.save();assert.equal(f.commands(),0);assert.equal(f.raw(),raw);assert.equal(f.fields(),draft);}finally{f.close();}
});
test('closed master editor retained save callback is inert',()=>{
 const f=fixture();try{const save=[...f.dialog.querySelectorAll('button')].find(x=>x.textContent==='저장(F8)');f.click('닫기',f.dialog);const raw=f.raw();save.click();assert.equal(f.commands(),0);assert.equal(f.raw(),raw);}finally{f.close();}
});
