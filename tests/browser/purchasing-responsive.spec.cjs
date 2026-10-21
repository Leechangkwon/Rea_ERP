const {test,expect}=require('@playwright/test');
const origin=process.env.REA_RESPONSIVE_ORIGIN||'http://127.0.0.1:4179';

// Reuse the real inventory renderers, then add the same shell/CSS cascade as the
// application. The lightweight request preview alone misses sidebar width and
// global shell rules, which was the source of the tablet regression.
async function shell(page,width){
 await page.setViewportSize({width,height:1000});
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/');
 await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(async()=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='/styles.css';
  const loaded=new Promise(resolve=>{link.onload=resolve;});document.head.prepend(link);await loaded;
  document.querySelector('style')?.remove();document.querySelector('body>h1')?.remove();
  document.getElementById('routes').hidden=true;
  document.getElementById('toast').hidden=true;
  const target=document.getElementById('target'),workspace=document.createElement('div');workspace.className='workspace';
  workspace.innerHTML='<button id="mobile-menu-toggle">구매관리 메뉴</button><nav id="local-nav" aria-label="구매관리"><section class="tree-section"><button class="active">발주요청</button><div class="tree-children"><a>발주요청조회</a><a>발주요청입력</a></div></section></nav><main id="main-content"><section id="menu-page" class="inventory-page"><header class="page-heading"><button class="favorite-toggle">☆</button><div><div class="breadcrumb">재고Ⅰ › 구매관리</div><h1 id="synthetic-title">발주요청조회</h1></div></header></section></main>';
  target.before(workspace);workspace.querySelector('#menu-page').append(target);
  const header=document.createElement('header');header.className='global-header';header.innerHTML='<div class="identity-row"><button class="logo"><span>E</span>COUNT</button><div class="utility-tools"><button>검색</button></div><span class="sample-badge">합성자료</span></div><nav id="global-nav"><button>MyPage</button><button>Self-Customizing</button><button>재고Ⅰ</button><button>회계Ⅰ</button></nav><nav id="group-nav"><button>기초등록</button><button>영업관리</button><button class="active">구매관리</button><button>생산/외주</button><button>출력물</button></nav>';
  const tabs=document.createElement('div');tabs.id='work-tabs';tabs.innerHTML='<div class="work-tab-tools"><button>⌂ 메인</button><button class="tabs-manage">열린 작업 탭 (5)</button></div><div class="work-tab-list"><div class="tab active">발주요청조회 <button class="tab-close">×</button></div><div class="tab">발주계획조회 <button class="tab-close">×</button></div><div class="tab">단가요청조회 <button class="tab-close">×</button></div></div>';
  document.body.prepend(header,tabs);
 });
}
async function route(page,label){
 await page.locator('#routes').getByRole('button',{name:label,exact:true,includeHidden:true}).evaluate(button=>button.click());
 await page.locator('#synthetic-title').evaluate((node,text)=>node.textContent=text,label);
}
const metrics=page=>page.locator('#inventory-app').evaluate(host=>{
 const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const status=host.querySelector('.inv-list-status')||host.querySelector('.inv-status-tabs');
 const search=host.querySelector('.inv-list-search');
 const actions=host.querySelector('.inv-list-actions');
 const table=host.querySelector('.inv-table-wrap');
 const content=box(host),css=getComputedStyle(host);content.x+=parseFloat(css.paddingLeft);content.right-=parseFloat(css.paddingRight);content.width=content.right-content.x;
 return {viewport:innerWidth,page:document.documentElement.scrollWidth,host:content,head:host.querySelector('.inv-list-head')?box(host.querySelector('.inv-list-head')):null,status:status?box(status):null,buttons:status?[...status.children].map(box):[],search:search?box(search):null,actions:actions?box(actions):null,table:table?box(table):null,
  actionHeights:actions?[...actions.querySelectorAll(':scope>button,:scope>details>summary')].filter(node=>node.getBoundingClientRect().height).map(node=>box(node).height):[],
  controls:search?[...search.querySelectorAll('input,select,button')].filter(node=>node.getBoundingClientRect().height).map(box):[]};
});

for(const width of [390,768,1024,1280])test(`purchasing lists share a bounded responsive layout at ${width}px`,async({page})=>{
 await shell(page,width);const before=await page.evaluate(()=>InventoryUI.snapshot());
 for(const title of ['발주요청조회','발주계획조회','단가요청조회','발주서조회','구매조회']){
  await route(page,title);await expect(page.locator('.inv-list-head')).toBeVisible();
  const m=await metrics(page);expect(m.page,title+' shell overflow').toBeLessThanOrEqual(width+1);
  expect(m.status.x,title+' status left').toBeCloseTo(m.host.x,0);
  expect(m.status.width,title+' status full row').toBeGreaterThan(m.host.width-2);
  const rows=new Map();for(const b of m.buttons){const y=Math.round(b.y);rows.set(y,(rows.get(y)||0)+1);expect(b.height,title+' status height').toBeGreaterThanOrEqual(width<=1100?44:36);}
  expect(Math.max(...rows.values()),title+' statuses must not collapse into one vertical column').toBeGreaterThanOrEqual(Math.min(3,m.buttons.length));
  expect(m.search.y,title+' search after statuses').toBeGreaterThanOrEqual(m.status.bottom+7);
  expect(m.search.y,title+' consistent header spacing').toBeLessThanOrEqual(m.status.bottom+12);
  expect(m.actions.y,title+' common actions below data').toBeGreaterThanOrEqual(m.table.bottom);
  expect(m.actionHeights.length,title+' existing actions retained').toBeGreaterThan(1);
  for(const h of m.actionHeights)expect(h,title+' consistent action targets').toBeGreaterThanOrEqual(width<=1100?44:36);
  for(const c of m.controls){expect(c.right,title+' search controls within content').toBeLessThanOrEqual(m.host.right+1);expect(c.height,title+' search target height').toBeGreaterThanOrEqual(width<=1100?44:36);}
  if(await page.locator('.form-option-bar').count())await expect(page.locator('.inv-list-search>.form-option-bar')).toHaveCount(1);
  const searchToggle=page.locator('.inv-list-search button[aria-expanded]').first();await searchToggle.click();await expect(page.locator('.inv-list-filters')).toBeVisible();await searchToggle.click();await expect(page.locator('.inv-list-filters')).toBeHidden();
  expect(await page.evaluate(()=>InventoryUI.snapshot()),title+' read-only navigation preserves data/forms').toEqual(before);
 }
 if(width===768||width===390){await route(page,'발주요청조회');await page.screenshot({path:`.artifacts/purchasing-responsive-20261022/request-list-${width}.png`,fullPage:true});}
});

for(const width of [390,768,1024])test(`request and plan entry helpers use even touch targets at ${width}px`,async({page})=>{
 await shell(page,width);const before=await page.evaluate(()=>InventoryUI.snapshot());
 for(const title of ['발주요청입력','발주계획입력']){
  await route(page,title);const primary=page.locator('.entry-primary-actions');await expect(primary).toBeVisible();
  const m=await primary.evaluate(node=>({display:getComputedStyle(node).display,width:node.getBoundingClientRect().width,buttons:[...node.children].map(child=>{const target=child.tagName==='DETAILS'?child.querySelector('summary'):child;const r=target.getBoundingClientRect();return {width:r.width,height:r.height,right:r.right};}),page:document.documentElement.scrollWidth}));
  expect(m.display).toBe('grid');expect(m.page,title+' entry shell overflow').toBeLessThanOrEqual(width+1);
  expect(Math.max(...m.buttons.map(x=>x.width))-Math.min(...m.buttons.map(x=>x.width))).toBeLessThan(2);
  for(const b of m.buttons)expect(b.height).toBeGreaterThanOrEqual(44);
  const details=page.locator('.entry-action-bar>details.entry-secondary-actions');await expect(details).not.toHaveAttribute('open','');
  const saveLayout=await page.locator('.entry-save-actions').evaluate(node=>({position:getComputedStyle(node).position,top:node.getBoundingClientRect().top,tableBottom:node.closest('form').querySelector('.inv-table-wrap').getBoundingClientRect().bottom}));
  expect(saveLayout.position,title+' save controls must not cover input fields').toBe('static');expect(saveLayout.top).toBeGreaterThanOrEqual(saveLayout.tableBottom);
  expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(before);
 }
 if(width===390){await page.screenshot({path:'.artifacts/purchasing-responsive-20261022/plan-entry-390.png',fullPage:true});}
});
