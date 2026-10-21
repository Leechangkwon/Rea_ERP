'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs'),C=require('../../dist/inventory-core.js');
const origin='http://127.0.0.1:4179',artifacts='.artifacts/uiux-tablet-repair-20261022';
const entries=[['2-2-0-1','발주요청입력'],['2-2-1-1','발주계획입력'],['2-2-2-1','단가요청입력'],['2-2-3-1','발주서입력'],['2-2-4-1','구매입력']];
const reports=[['2-2-0-2','발주요청현황'],['2-2-1-2','발주계획현황'],['2-2-3-2','발주서현황'],['2-2-4-2','구매현황']];
async function shell(page,width,height){
 const auth='<script>window.AuthUI={state:()=>({user:{id:"owner",loginId:"owner",roleId:"admin",company:{code:"SYNTH"},permissions:["*"]}}),can:()=>true,settings:()=>SelfCore.empty().config,accountContent:()=>document.createTextNode("합성 검증 계정"),request:async()=>{throw Error("Synthetic endpoint unavailable");}};</script>',html=fs.readFileSync('dist/index.html','utf8').replace('<script src="auth-ui.js" defer></script>',auth);
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin!==origin?route.abort():u.pathname==='/shell'?route.fulfill({contentType:'text/html; charset=utf-8',body:html}):route.continue();});
 let db=C.seed();db=C.command(db,'document',{type:'purchase',date:C.today(),warehouse:'W001',partner:'V001',lines:[{item:'M001',qty:2,price:100}]}).db;
 await page.addInitScript(db=>{if(!localStorage.getItem('ecount-inventory-v2'))localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));},db);
 await page.setViewportSize({width,height});await page.goto('/shell');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
}
async function open(page,id,name){await page.getByLabel('전체 메뉴 검색',{exact:true}).fill(name);await page.locator('#search-results [data-menu="'+id+'"]').click();}
function bounded(height,min,label){expect(height,label+' minimum touch target').toBeGreaterThanOrEqual(min);expect(height,label+' upper height').toBeLessThanOrEqual(56);}
async function noOverflow(page,width){expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);}
for(const [width,height]of [[390,820],[768,820],[864,820],[864,1200],[980,1100],[1024,820],[1280,1000]])test(`actual purchasing shell has bounded helpers and aligned report controls at ${width}x${height}`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await shell(page,width,height);let before;
 for(const [id,name]of entries){
  await open(page,id,name);if(!before)before=await page.evaluate(()=>InventoryUI.snapshot());
  const primary=page.locator('.entry-primary-actions');await expect(primary).toBeVisible();
  const metrics=await primary.evaluate(node=>[...node.children].map(child=>{const target=child.tagName==='DETAILS'?child.querySelector('summary'):child,r=target.getBoundingClientRect();return {height:r.height,width:r.width};}));
  expect(metrics.length).toBeGreaterThan(4);for(const m of metrics)bounded(m.height,width<=1100?44:36,name);
  await noOverflow(page,width);expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(before);
  if([390,864].includes(width)&&height===820&&id===entries[0][0]){fs.mkdirSync(artifacts,{recursive:true});await primary.scrollIntoViewIfNeeded();await page.screenshot({path:`${artifacts}/after-request-entry-${width}.png`,fullPage:true});}
 }
 for(const [id,name]of reports){
  await open(page,id,name);const host=page.locator('.inv-purchasing-report'),form=host.locator('form.inv-filters'),quick=host.getByLabel(name+' 빠른검색',{exact:true}),search=host.getByRole('button',{name:'Search(F3)',exact:true});
  await expect(form).toBeVisible();await expect(quick).toHaveAttribute('placeholder','검색어 입력 후 Enter');await expect(host.locator('.inv-report-head>h2')).toBeHidden();
  const q=await quick.boundingBox(),s=await search.boundingBox();expect(Math.abs(q.y-s.y),name+' search on one row').toBeLessThanOrEqual(2);bounded(q.height,width<=1100?44:36,name+' quick');bounded(s.height,width<=1100?44:36,name+' F3');
  const modes=await host.locator('.inv-report-mode input[type=radio]').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),p=node.parentElement.getBoundingClientRect();return {width:r.width,height:r.height,y:r.y,labelHeight:p.height};}));
  expect(modes).toHaveLength(2);for(const r of modes){expect(r.width).toBe(18);expect(r.height).toBe(18);bounded(r.labelHeight,width<=1100?44:36,name+' mode');}expect(Math.abs(modes[0].y-modes[1].y)).toBeLessThanOrEqual(2);
  const filters=await form.locator('.inv-field>input:not([type=radio]):not([type=checkbox]),.inv-field>select').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height).map(n=>n.getBoundingClientRect().height));for(const h of filters)bounded(h,width<=1100?44:36,name+' filter');
  const actions=await host.locator('.inv-report-search-actions>button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));for(const h of actions)bounded(h,width<=1100?44:36,name+' date actions');
  await noOverflow(page,width);
  if([390,864].includes(width)&&height===820&&id===reports[1][0]){await host.scrollIntoViewIfNeeded();await page.screenshot({path:`${artifacts}/after-plan-report-${width}.png`,fullPage:true});}
  // Exercise read-only search and mode controls through real app event handlers.
  await search.click();await expect(form).toBeHidden();await quick.focus();await page.keyboard.press('F3');await expect(form).toBeVisible();
  await host.locator('input[type=radio][value=summary]').check();await expect(host.locator('.inv-aggregate-fields')).toBeVisible();await host.locator('input[type=radio][value=detail]').check();await expect(host.locator('.inv-aggregate-fields')).toBeHidden();
  await quick.fill('');await quick.press('Enter');await expect(form).toBeHidden();await search.click();await expect(form).toBeVisible();await host.getByLabel('조회 시작일',{exact:true}).focus();await page.keyboard.press('F8');await expect(form).toBeHidden();
  expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(before);
 }
 expect(errors).toEqual([]);
});
test('tablet helper menus remain compact, usable and preserve unsaved fields',async({page})=>{
 await shell(page,864,1200);await open(page,...entries[0]);const before=await page.evaluate(()=>InventoryUI.snapshot()),host=page.locator('#inventory-app');
 const pending=host.getByLabel('납기일',{exact:true});await pending.fill('2026-10-30');
 const my=host.getByLabel('My품목 옵션',{exact:true});await my.click();await expect(host.getByRole('button',{name:'My품목설정',exact:true})).toBeVisible();await my.click();await expect(host.getByRole('button',{name:'My품목설정',exact:true})).toBeHidden();
 const safety=host.locator('.entry-primary-actions>details');await safety.locator('summary').click();await expect(safety.getByRole('button',{name:'품목별안전재고',exact:true})).toBeVisible();await safety.locator('summary').click();await expect(safety.getByRole('button',{name:'품목별안전재고',exact:true})).toBeHidden();
 await expect(pending).toHaveValue('2026-10-30');await open(page,...reports[1]);await page.locator('[data-tab="'+entries[0][0]+'"]').click();await expect(pending).toHaveValue('2026-10-30');expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(before);
});
