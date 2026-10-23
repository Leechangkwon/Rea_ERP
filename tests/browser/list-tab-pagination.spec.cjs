'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs'),C=require('../../dist/inventory-core.js');
for(const width of [390,1280])test('status tab pagination preserves search draft and records at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let db=C.empty();db.masters=C.clone(C.seed().masters);const first={};
 for(const type of ['request','purchaseorder','purchase'])for(let i=0;i<6;i++){const r=C.command(db,'document',{type,date:C.today(),partner:'V001',warehouse:'W001',status:i<4?'진행':'미확인',lines:[{item:'M001',qty:2,price:100}]});db=r.db;if(i===0)first[type]=r.result.id;}
 const auth='<script>window.AuthUI={state:()=>({user:{id:"owner",loginId:"owner",roleId:"admin",company:{code:"SYNTH"},permissions:["*"]}}),can:()=>true,settings:()=>{const c=SelfCore.empty().config;c.conveniences.pageSize=2;return c;},accountContent:()=>document.createTextNode("합성 검증 계정"),request:async()=>{throw Error("Synthetic endpoint unavailable");}};</script>';
 const html=fs.readFileSync('dist/index.html','utf8').replace('<script src="auth-ui.js" defer></script>',auth);
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin!=='http://127.0.0.1:4179'?route.abort():u.pathname==='/shell'?route.fulfill({contentType:'text/html; charset=utf-8',body:html}):route.continue();});
 await page.addInitScript(value=>{if(!localStorage.getItem('ecount-inventory-v2'))localStorage.setItem('ecount-inventory-v2',JSON.stringify(value));},db);
 await page.goto('/shell');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 const raw=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2')),host=page.locator('#menu-page'),wrap=host.locator('.inv-document-list .inv-table-wrap');
 for(const [type,menu,name]of [['request','2-2-0-0','발주요청조회'],['purchaseorder','2-2-3-0','발주서조회'],['purchase','2-2-4-0','구매조회']]){
  await page.getByLabel('전체 메뉴 검색',{exact:true}).fill(name);await page.locator('#search-results [data-menu="'+menu+'"]').click();
  await host.getByLabel('전표 선택 '+first[type],{exact:true}).check();await host.getByRole('button',{name:'다음 페이지',exact:true}).click();await expect(wrap).toHaveAttribute('data-page','1');
  await host.getByRole('button',{name:'Search(F3)',exact:true}).click();const quick=host.getByLabel(C.types[type]+' 빠른검색',{exact:true});await quick.fill('미적용 검색');
  await host.getByLabel('확인 상태 조회',{exact:true}).click();await expect(wrap).toHaveAttribute('data-page','0');await expect(host.getByLabel('전표 선택 '+first[type],{exact:true})).toBeChecked();
  await expect(quick).toHaveValue('미적용 검색');await expect(host.locator('.inv-filters')).toBeVisible();await expect(host.getByRole('status')).toContainText('검색 조건을 변경했습니다.');
  await host.getByRole('button',{name:'다음 페이지',exact:true}).click();await expect(wrap).toHaveAttribute('data-page','1');await host.getByLabel('전체 상태 조회',{exact:true}).click();await expect(wrap).toHaveAttribute('data-page','0');
  await expect(host.getByLabel('전표 선택 '+first[type],{exact:true})).toBeChecked();expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(raw);
 }
 expect(errors).toEqual([]);
});
