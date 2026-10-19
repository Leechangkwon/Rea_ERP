'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),C=require('../dist/inventory-core.js'),M=require('../dist/menu-core.js');
const routes=M.indexMenus(require('../dist/menus.json'));
function fixture({mode='credit',multiple=false,replacement=false}={}){
  let db=C.empty();db.masters.items=[{code:'I',name:'가상 부분반품 재료',buyPrice:5,sellPrice:10},{code:'J',name:'가상 두번째 재료',buyPrice:5,sellPrice:10}];db.masters.partners=[{code:'V',name:'가상 공급사'}];db.masters.warehouses=[{code:'W',name:'가상 창고'}];
  const purchase=C.command(db,'document',{type:'purchase',date:'2026-10-01',warehouse:'W',partner:'V',vatRate:10,lines:[{item:'I',qty:3,price:5},...(multiple?[{item:'J',qty:3,price:5}]:[])]});db=purchase.db;
  const returned=C.command(db,'convert',{id:purchase.result.id,type:'purchasereturn',date:'2026-10-02',settlementMode:mode,quantities:{I:replacement?2:1,...(multiple?{J:2}:{})}});db=returned.db;let selected=returned.result;
  if(replacement){const receipt=C.command(db,'convert',{id:returned.result.id,type:'exchangereceipt',date:'2026-10-03',quantities:{I:1}});db=receipt.db;selected=receipt.result;}
  return {db,id:selected.id,purchase:purchase.result.id};
}
function environment(options={}){
  const data=fixture(options),dom=new JSDOM('<!doctype html><body><main id="target"></main></body>',{url:'https://erp.test/',runScripts:'outside-only'}),w=dom.window,d=w.document,toasts=[];w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.print=()=>{};w.AuthUI={state:()=>({user:{id:'owner'}}),can:()=>true,settings:()=>({conveniences:{pageSize:50}})};
  w.localStorage.setItem('ecount-inventory-v2',JSON.stringify(data.db));for(const name of ['form-core.js','item-core.js','inventory-core.js','purchase-room-core.js','purchase-process-data.js','purchase-room-ui.js','form-options.js','reference-picker-ui.js','inventory-ui.js'])w.eval(fs.readFileSync('dist/'+name,'utf8'));w.InventoryCore.today=()=> '2026-10-15';
  const target=d.getElementById('target'),route=routes.find(r=>r.top===2&&C.resolve(r).kind==='list'&&C.resolve(r).docType==='purchase');w.InventoryUI.render(target,route,{rows:routes,open:()=>{},toast:t=>toasts.push(t)});
  const button=(label,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(x=>x.textContent===label);assert(b,'missing button '+label);return b;},click=(label,scope=d)=>button(label,scope).click(),dialog=()=>d.getElementById('inventory-dialog'),stored=()=>JSON.parse(w.localStorage.getItem('ecount-inventory-v2'));
  function field(label){const el=[...dialog().querySelectorAll('[aria-label]')].find(x=>x.getAttribute('aria-label')===label);assert(el,'missing field '+label);return el;}
  function edit(label,value){const el=field(label);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));}
  function open(){click('구매실 업무센터');const center=d.getElementById('purchase-room-dialog');assert(center?.open);click('검수·적재·발주메일',center);click(data.id,center);assert(dialog()?.open);assert.equal(field('품목 1').value,'I');}
  const footer=()=>dialog().querySelector('.inv-totals').textContent,cell=(index,key)=>Number(dialog().querySelectorAll('.inv-entry-grid tbody tr')[index].querySelector('td[data-form-field="'+key+'"]').textContent.replaceAll(',',''));
  return {dom,w,d,id:data.id,open,button,click,dialog,stored,field,edit,footer,cell,toasts,close:()=>dom.window.close()};
}
test('partial return editor displays source VAT allocation and preview/save agree after quantity edit',()=>{const f=environment();try{
  f.open();assert.equal(f.cell(0,'supply'),5);assert.equal(f.cell(0,'tax'),.67);assert.equal(f.cell(0,'total'),5.67);assert.match(f.footer(),/수량 1\s+공급가액 5\s+부가세 0.67\s+합계 5.67/);assert.equal(f.field('단가 1').readOnly,true);assert.equal(f.field('할인율 1').readOnly,true);
  const before=JSON.stringify(f.stored());f.edit('수량 1','2');assert.equal(JSON.stringify(f.stored()),before,'미리보기는 저장 자료를 바꾸면 안 됨');assert.equal(f.cell(0,'supply'),10);assert.equal(f.cell(0,'tax'),1.33);assert.equal(f.cell(0,'total'),11.33);assert.match(f.footer(),/수량 2\s+공급가액 10\s+부가세 1.33\s+합계 11.33/);
  f.click('저장(F8)',f.dialog());assert.equal(f.dialog(),null);const saved=f.stored().documents.find(d=>d.id===f.id);assert.equal(saved.lines[0].qty,2);assert.equal(C.totals(saved).total,11.33);assert.equal(saved.lines[0].returnAmounts.tax,1.33);
}finally{f.close();}});
test('multiple return rows sum numeric quantities and allocated monetary values instead of concatenating strings',()=>{const f=environment({multiple:true});try{
  f.open();assert.equal(f.cell(0,'total'),5.67);assert.equal(f.cell(1,'total'),11.33);assert.match(f.footer(),/수량 3\s+공급가액 15\s+부가세 2\s+합계 17/);assert.doesNotMatch(f.footer(),/수량 12/);
  f.edit('수량 1','2');assert.equal(f.cell(0,'total'),11.33);assert.match(f.footer(),/수량 4\s+공급가액 20\s+부가세 2.66\s+합계 22.66/);f.click('저장(F8)',f.dialog());const saved=f.stored().documents.find(d=>d.id===f.id);assert.equal(C.totals(saved).qty,4);assert.equal(C.totals(saved).total,22.66);
}finally{f.close();}});
test('exchange replacement editor uses returned source amounts for row, footer and saved quantity',()=>{const f=environment({mode:'exchange',replacement:true});try{
  f.open();assert.equal(f.cell(0,'total'),5.67);assert.match(f.footer(),/합계 5.67/);const oldPayable=C.outstanding(f.stored(),'payable','V'),before=JSON.stringify(f.stored());f.edit('수량 1','2');assert.equal(JSON.stringify(f.stored()),before);assert.equal(f.cell(0,'tax'),1.33);assert.equal(f.cell(0,'total'),11.33);assert.match(f.footer(),/수량 2\s+공급가액 10\s+부가세 1.33\s+합계 11.33/);f.click('저장(F8)',f.dialog());const saved=f.stored().documents.find(d=>d.id===f.id);assert.equal(C.totals(saved).total,11.33);assert.equal(C.outstanding(f.stored(),'payable','V'),oldPayable,'교환입고는 채무를 재생성하면 안 됨');
}finally{f.close();}});
