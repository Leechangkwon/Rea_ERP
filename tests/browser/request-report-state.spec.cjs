'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs'),C=require('../../dist/inventory-core.js');
test('request report closes and reopens a saved request across real tabs and reload without changing linked data',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let db=C.empty();db.masters=C.clone(C.seed().masters);db=C.command(db,'document',{type:'request',date:'2026-10-21',warehouse:'W001',partner:'V001',lines:[{lineId:'REQ',item:'M001',qty:5,price:100,memo:'합성 보존'}]}).db;const id=db.documents[0].id;db=C.command(db,'convert',{id,type:'plan',date:'2026-10-21',quantities:{REQ:2}}).db;
 const auth='<script>window.AuthUI={state:()=>({user:{id:"owner",loginId:"owner",roleId:"admin",company:{code:"SYNTH"},permissions:["*"]}}),can:()=>true,settings:()=>SelfCore.empty().config,accountContent:()=>document.createTextNode("합성 검증 계정"),request:async()=>{throw Error("Synthetic endpoint unavailable");}};</script>';
 const html=fs.readFileSync('dist/index.html','utf8').replace('<script src="auth-ui.js" defer></script>',auth);
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin!=='http://127.0.0.1:4179'?route.abort():u.pathname==='/shell'?route.fulfill({contentType:'text/html; charset=utf-8',body:html}):route.continue();});
 await page.addInitScript(value=>{if(!localStorage.getItem('ecount-inventory-v2'))localStorage.setItem('ecount-inventory-v2',JSON.stringify(value));},db);
 await page.goto('/shell');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 async function open(menu,name){await page.getByLabel('전체 메뉴 검색',{exact:true}).fill(name);await page.locator('#search-results [data-menu="'+menu+'"]').click();}
 const host=page.locator('#menu-page'),report=host.locator('.inv-purchasing-report'),dialog=page.locator('#inventory-dialog'),state=()=>report.getByRole('button',{name:new RegExp('^'+id+' 진행상태')});
 async function query(){await host.getByLabel('조회 시작일',{exact:true}).fill('2026-10-01');await host.getByLabel('조회 종료일',{exact:true}).fill('2026-10-31');await host.getByRole('button',{name:'검색(F8)',exact:true}).click();}
 await open('2-2-0-2','발주요청현황');await query();const raw=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await state().click();await dialog.getByLabel('변경할 진행상태',{exact:true}).selectOption('완료');await dialog.getByRole('button',{name:'닫기',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(raw);
 await report.getByRole('button',{name:'Search(F3)',exact:true}).click();await host.getByLabel('조회 시작일',{exact:true}).fill('2026-11-01');await host.getByLabel('발주요청현황 빠른검색',{exact:true}).fill('미적용 검색');
 await state().click();await dialog.getByLabel('변경할 진행상태',{exact:true}).selectOption('완료');await dialog.getByRole('button',{name:'상태 변경 적용',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(state()).toHaveText('완료');await expect(host.getByLabel('조회 시작일',{exact:true})).toHaveValue('2026-11-01');await expect(host.getByLabel('발주요청현황 빠른검색',{exact:true})).toHaveValue('미적용 검색');
 const after=await page.evaluate(()=>InventoryUI.snapshot());expect(after.documents[0].progress).toBe('완료');expect(after.documents[0].lines).toEqual(db.documents[0].lines);expect(after.documents[1]).toEqual(db.documents[1]);expect(after.settings).toEqual(db.settings);expect(C.remaining(after,after.documents[0],'plan')).toEqual(C.remaining(db,db.documents[0],'plan'));
 const [download]=await Promise.all([page.waitForEvent('download'),report.getByRole('button',{name:'Excel(화면)',exact:true}).click()]);expect(fs.readFileSync(await download.path(),'utf8')).toContain('완료');
 await open('2-2-0-0','발주요청조회');await expect(host.getByRole('button',{name:id+' 진행상태 완료',exact:true})).toContainText('완료');await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ready','true');await open('2-2-0-2','발주요청현황');await query();await expect(state()).toHaveText('완료');
 fs.mkdirSync('.artifacts/manual-request-upload-close-20261022',{recursive:true});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await state().click();await expect(dialog).toBeVisible();const bounds=await dialog.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);await page.screenshot({path:'.artifacts/manual-request-upload-close-20261022/synthetic-request-state-'+width+'.png',fullPage:true});await dialog.getByRole('button',{name:'닫기',exact:true}).click();
 }
 await state().click();await dialog.getByLabel('변경할 진행상태',{exact:true}).selectOption('진행');await dialog.getByRole('button',{name:'상태 변경 적용',exact:true}).click();await expect(state()).toHaveText('진행중');await page.reload();await expect(page.locator('body')).toHaveAttribute('data-ready','true');expect((await page.evaluate(()=>InventoryUI.snapshot())).documents[0].progress).toBe('진행');expect(errors).toEqual([]);
});
