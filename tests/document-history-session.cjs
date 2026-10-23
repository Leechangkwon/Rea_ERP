'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{environment}=require('./helpers/request-env.cjs');
function fixture(){const f=environment(false),blobs=[];f.w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:history-session';};f.w.URL.revokeObjectURL=()=>{};f.w.HTMLAnchorElement.prototype.click=function(){};return {...f,blobs};}
const action=(dialog,text)=>[...dialog.querySelectorAll('button')].find(x=>x.textContent===text);
const open=f=>{f.click('이력조회');const d=f.d.getElementById('document-history-dialog');assert.ok(d?.open);return d;};
const identities=[
 ['logout',f=>{f.w.AuthUI.state=()=>({user:null});}],
 ['account',f=>{f.w.AuthUI.state=()=>({user:{id:'different'}});}],
 ['company',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',company:{code:'different'}}});}],
 ['role',f=>{f.w.AuthUI.state=()=>({user:{id:'owner',roleId:'different'}});}],
 ['permission',f=>{f.w.AuthUI.can=()=>false;}]
];
test('history refuses stale principal or read permission before opening without changing stored data',()=>{
 for(const [name,invalidate]of identities.filter(([name])=>name!=='role')){const f=fixture();try{const before=f.w.localStorage.getItem('ecount-inventory-v2');invalidate(f);f.click('이력조회');assert.equal(f.d.getElementById('document-history-dialog'),null,name);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),before,name);assert.equal(f.blobs.length,0,name);}finally{f.w.close();}}
});
test('history CSV and saved callbacks cannot expose a successful result after identity role or read permission changes',()=>{
 for(const [name,invalidate]of identities){const f=fixture();try{const before=f.w.localStorage.getItem('ecount-inventory-v2'),d=open(f),csv=action(d,'Excel (CSV)'),search=action(d,'검색(F8)');invalidate(f);csv.click();assert.equal(f.blobs.length,0,name);assert.equal(d.isConnected,false,name);search.click();csv.click();assert.equal(f.blobs.length,0,name+' saved callback');assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),before,name);}finally{f.w.close();}}
});
test('history search and CSV invalidate old data after another window changes the storage revision',()=>{
 for(const trigger of ['검색(F8)','Excel (CSV)']){const f=fixture();try{const d=open(f),csv=action(d,'Excel (CSV)'),next=f.stored();next.settings.externalMarker='changed elsewhere';const raw=JSON.stringify(next);f.w.localStorage.setItem('ecount-inventory-v2',raw);action(d,trigger).click();assert.equal(d.isConnected,false,trigger);csv.click();assert.equal(f.blobs.length,0,trigger);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),raw,trigger);}finally{f.w.close();}}
});
test('history closes on a relevant cross-window storage event and releases callbacks without a download',()=>{
 const f=fixture();try{const before=f.w.localStorage.getItem('ecount-inventory-v2'),d=open(f),csv=action(d,'Excel (CSV)');f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'unrelated-key',oldValue:null,newValue:'x',storageArea:f.w.localStorage}));assert.equal(d.isConnected,true);f.w.localStorage.removeItem('ecount-inventory-v2');f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'ecount-inventory-v2',oldValue:before,newValue:null,storageArea:f.w.localStorage}));assert.equal(d.isConnected,false);csv.click();assert.equal(f.blobs.length,0);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),null);}finally{f.w.close();}
});
test('history export rejects callbacks from a closed dialog or a detached parent and retains read-only data',()=>{
 for(const detach of [f=>f.w.InventoryUI.beforeNavigate(),f=>f.host.replaceChildren()]){const f=fixture();try{const before=f.w.localStorage.getItem('ecount-inventory-v2'),d=open(f),csv=action(d,'Excel (CSV)');detach(f);csv.click();assert.equal(f.blobs.length,0);assert.equal(d.isConnected,false);assert.equal(f.w.localStorage.getItem('ecount-inventory-v2'),before);}finally{f.w.close();}}
});
