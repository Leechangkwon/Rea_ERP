'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Data=require('../dist/purchase-process-data.js'),Menu=require('../dist/menu-core.js');
const expectedSlides={
  "PUR-01": [
    8,
    9,
    65,
    67
  ],
  "PUR-02": [
    10,
    11,
    12
  ],
  "PUR-03": [
    13,
    14,
    65
  ],
  "PUR-04": [
    15,
    16
  ],
  "REC-01": [
    18,
    19,
    65,
    67
  ],
  "REC-02": [
    20,
    21,
    22,
    23,
    24
  ],
  "REC-03": [
    23,
    24,
    65,
    67,
    68
  ],
  "STK-01": [
    25
  ],
  "STK-02": [
    26,
    27,
    28,
    63
  ],
  "ISS-01": [
    29,
    30,
    31,
    32
  ],
  "ISS-02": [
    33,
    34,
    35,
    36,
    37,
    40,
    41,
    42
  ],
  "ISS-03": [
    26,
    38,
    39
  ],
  "ISS-04": [
    43,
    44,
    45
  ],
  "STK-03": [
    62,
    63,
    66
  ],
  "CLS-01": [
    48,
    49,
    65,
    66,
    68,
    69
  ],
  "CLS-02": [
    50,
    68
  ],
  "CLS-03": [
    47,
    48,
    51
  ],
  "CLS-04": [
    51,
    52,
    66,
    69
  ],
  "CLS-05": [
    53,
    54,
    55,
    56,
    57,
    58,
    66,
    69
  ],
  "CLS-06": [
    53,
    58,
    59,
    60,
    69
  ],
  "CLS-07": [
    61,
    62
  ],
  "CLS-08": [
    63,
    68
  ],
  "CLS-09": [
    47,
    61,
    64,
    66,
    69
  ],
  "AST-01": [
    71,
    72,
    73,
    74
  ],
  "AST-02": [
    75
  ],
  "AST-03": [
    76
  ]
};
const expectedRoutes={
  "PUR-01": "발주요청조회",
  "PUR-02": "발주계획입력",
  "PUR-03": "발주계획조회",
  "PUR-04": "발주서조회",
  "REC-02": "구매입력",
  "REC-03": "발주서조회",
  "ISS-01": "창고이동입력",
  "ISS-02": "판매입력",
  "ISS-03": "창고이동입력",
  "ISS-04": "판매조회",
  "STK-03": "재고실사조회",
  "CLS-02": "구매조회"
};
const byId=id=>Data.processes.find(p=>p.id===id);
let checks=0;
function check(name,run){run();checks++;console.log('ok '+checks+' - '+name);}
function strings(values){return Array.isArray(values)&&values.length>0&&values.every(s=>typeof s==='string'&&s.trim().length>0);}
check('CommonJS exports the independent data contract',()=>{
  assert.deepEqual(Object.keys(Data).sort(),['source','processes','cadence','training','boundaries'].sort());
  assert.equal(typeof Data,'object');
});
check('source identifies the supplied manual without carrying its local file or business data',()=>{
  assert.deepEqual(Data.source,{title:'구매실 신규입사자 매뉴얼',date:'2024-06-12',slideCount:76,sha256:'0a9a8d67fc39fe4b24b39b4f8f59ca00aa96d35eaab8160272ba884cf62181c6'});
});
check('all 26 distinct process stages remain in roadmap order',()=>{
  assert.equal(Data.processes.length,26);
  assert.deepEqual(Data.processes.map(p=>p.id),Object.keys(expectedSlides));
  assert.equal(new Set(Data.processes.map(p=>p.id)).size,26);
});
check('each stage retains its actual source slide references',()=>{
  for(const p of Data.processes){
    assert.deepEqual(p.slides,expectedSlides[p.id],p.id);
    assert(p.slides.every(n=>Number.isInteger(n)&&n>=1&&n<=76),p.id);
  }
});
check('every stage has usable purpose, inputs, outputs, steps and acceptance goals',()=>{
  const fields=['id','title','purpose','slides','frequency','inputs','outputs','steps','acceptance','routeId','area'];
  for(const p of Data.processes){
    for(const key of Object.keys(p))assert(fields.includes(key),p.id+' unexpected field '+key);
    for(const key of ['title','purpose','frequency','area'])assert.equal(typeof p[key],'string',p.id+' '+key);
    for(const key of ['inputs','outputs','steps','acceptance'])assert(strings(p[key]),p.id+' '+key);
  }
});
check('process areas and cadence labels cover operational work and closing',()=>{
  assert.deepEqual([...new Set(Data.processes.map(p=>p.area))].sort(),['요청·발주','입고·검수','재고·불출','월결산','자산관리'].sort());
  const frequencies=new Set(['일간','일간·주간','주간·월간','월간','상시']);
  assert(Data.processes.every(p=>frequencies.has(p.frequency)));
  assert.equal(byId('STK-03').frequency,'주간·월간');
  assert.equal(byId('CLS-07').frequency,'월간');
  assert.equal(byId('AST-01').frequency,'상시');
});
check('all 12 shortcuts resolve to the intended inventory I query or entry leaf',()=>{
  const tree=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/menus.json'),'utf8'));
  const rows=Menu.indexMenus(tree),routed=Data.processes.filter(p=>p.routeId);
  assert.deepEqual(routed.map(p=>p.id).sort(),Object.keys(expectedRoutes).sort());
  for(const p of routed){
    const row=rows.find(r=>r.id===p.routeId);
    assert(row,p.id+' route missing');assert.equal(row.top,2,p.id);
    assert.equal(row.path[0],'재고 I',p.id);assert.equal(row.branch,false,p.id);
    assert.equal(row.name,expectedRoutes[p.id],p.id);
    assert(/조회$|입력$/.test(row.name),p.id);
  }
});
check('physical work, external closing and inventory II assets do not get misleading shortcuts',()=>{
  for(const id of ['REC-01','STK-01','STK-02','CLS-01','CLS-03','CLS-04','CLS-05','CLS-06','CLS-07','CLS-08','CLS-09','AST-01','AST-02','AST-03'])assert(!('routeId' in byId(id)),id);
});
check('daily, weekly and monthly checklists retain their defining duties',()=>{
  assert.deepEqual(Object.keys(Data.cadence).sort(),['daily','weekly','monthly'].sort());
  for(const p of Object.values(Data.cadence))assert(strings(p));
  const all=period=>Data.cadence[period].join(' ');
  for(const term of ['구매요구','반품','미입고','특이사항'])assert(all('daily').includes(term),term);
  for(const term of ['납기','원장','임플란트','실사'])assert(all('weekly').includes(term),term);
  for(const term of ['세금계산서','지출결의','매출 대비 구매비','수불'])assert(all('monthly').includes(term),term);
});
check('six-week training progresses from ERP use to independent practice',()=>{
  assert.deepEqual(Data.training.map(w=>w.week),[1,2,3,4,5,6]);
  assert.deepEqual(Data.training.map(w=>w.title),['ERP 사용법 숙지','구매요청','발주','입고·검수','재고관리·월결산','실무투입']);
  assert(Data.training.every(w=>strings(w.tasks)));
});
check('critical handoffs, stock equation and serial purchase-row fields are explicit',()=>{
  assert(byId('PUR-03').acceptance.join(' ').includes('거래처별'));
  assert(byId('REC-03').acceptance.join(' ').includes('미입고 6'));
  assert(byId('ISS-03').steps.join(' ').includes('발주요청'));
  assert(byId('ISS-02').steps.join(' ').includes('창고이동'));
  assert(byId('CLS-07').acceptance.join(' ').includes('사용량은 10'));
  assert(byId('CLS-04').acceptance.join(' ').includes('요청됨과 발행 확인됨'));
  const serial=byId('AST-01');
  for(const term of ['구매 전표의 품목행','S/N 또는 제조번호','시리얼별 입력수량'])assert(serial.inputs.includes(term));
  assert(serial.outputs.join(' ').includes('반영후수량'));
  assert(byId('AST-03').outputs.join(' ').includes('연결전표'));
});
check('boundaries preserve unresolved source meaning and distinguish acceptance from completion',()=>{
  assert(strings(Data.boundaries));
  const body=Data.boundaries.join(' ');
  for(const term of ['실제 슬라이드','부분입고','바코드 입고','FIFO 원가평가','소비량인지 잔량인지','이중 집계','초안','감가상각','자동 전환'])assert(body.includes(term),term);
  for(const p of Data.processes)for(const key of ['implemented','status','complete','verified','passed'])assert(!(key in p),key);
});
check('deployed content has no contacts, session links, source images or filesystem paths',()=>{
  const body=JSON.stringify(Data);
  assert(!/[^\s<>@"\\]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(body),'email');
  assert(!/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/.test(body),'mobile phone');
  assert(!/\b\d{2,3}-\d{3,4}-\d{4}\b/.test(body),'phone');
  assert(!/https?:\/\/|ec_req_sid|Bearer\s|session[_-]?(?:id|token)|password\s*[:=]/i.test(body),'link or credential');
  assert(!/[A-Za-z]:[\\/]|\bOneDrive\b|\bAppData\b|image\d+\.(?:png|jpe?g)|\.pptx\b/.test(body),'local source material');
});
check('browser UMD export matches Node without requiring other globals',()=>{
  const script=fs.readFileSync(path.join(__dirname,'../dist/purchase-process-data.js'),'utf8'),context={};
  vm.runInNewContext(script,context,{filename:'purchase-process-data.js'});
  assert(context.PurchaseProcessData);
  assert.deepEqual(JSON.parse(JSON.stringify(context.PurchaseProcessData)),Data);
  assert.deepEqual(Object.keys(context),['PurchaseProcessData']);
});
console.log('purchase-process-data: '+checks+' checks passed');

