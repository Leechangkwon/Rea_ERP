const {test,expect} = require('@playwright/test');
const documents = page => page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')).documents);
test.beforeEach(async({page})=>{
  // Enforce local synthetic QA. Never navigate to original ERP or hosted business data.
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179' ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
});
test('search expands, filters on Enter and page selection matches visible rows',async({page})=>{
  const request=(await documents(page)).find(d=>d.type==='request');
  await page.getByRole('button',{name:'Search(F3)',exact:true}).click();
  await expect(page.locator('.inv-filters')).toBeVisible();
  await page.getByLabel('발주요청 빠른검색').fill(request.id);
  await page.getByLabel('발주요청 빠른검색').press('Enter');
  await expect(page.locator('tbody .inv-link')).toHaveCount(1);
  await page.getByLabel('현재 페이지 전체 선택',{exact:true}).check();
  await expect(page.getByLabel('전표 선택 '+request.id,{exact:true})).toBeChecked();
  await page.getByLabel('현재 페이지 전체 선택',{exact:true}).uncheck();
  await expect(page.getByLabel('전표 선택 '+request.id,{exact:true})).not.toBeChecked();
});
test('conversion requires selection and closing preview does not save',async({page})=>{
  const before=await documents(page);
  const request=before.find(d=>d.type==='request'&&d.status==='진행');
  const menu=page.locator('summary[aria-label="다른전표생성"]');
  await menu.click();
  await page.getByRole('button',{name:'발주계획',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('선택된 자료');
  await page.getByLabel('전표 선택 '+request.id,{exact:true}).check();
  if (!await page.getByRole('button',{name:'발주계획',exact:true}).isVisible()) await menu.click();
  await page.getByRole('button',{name:'발주계획',exact:true}).click();
  const dialog=page.locator('#inventory-dialog');
  await expect(dialog).toBeVisible();
  expect(await documents(page)).toEqual(before);
  await dialog.getByRole('button',{name:'×',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await documents(page)).toEqual(before);
});
test('F3 toggles list search without losing query, selection or saved data',async({page})=>{
  const before=await documents(page),request=before.find(d=>d.type==='request');
  const quick=page.getByLabel('발주요청 빠른검색');
  await quick.fill(request.id);
  await quick.press('Enter');
  await page.getByLabel('전표 선택 '+request.id,{exact:true}).check();
  await quick.press('F3');
  await expect(page.locator('.inv-filters')).toBeVisible();
  await expect(page.getByLabel('자료 검색',{exact:true})).toBeFocused();
  await page.keyboard.press('F3');
  await expect(page.locator('.inv-filters')).toBeHidden();
  await expect(quick).toBeFocused();
  await page.keyboard.press('F3');
  await expect(page.locator('.inv-filters')).toBeVisible();
  await expect(quick).toHaveValue(request.id);
  await expect(page.getByLabel('전표 선택 '+request.id,{exact:true})).toBeChecked();
  await expect(page.locator('tbody .inv-link')).toHaveCount(1);
  expect(await documents(page)).toEqual(before);
});
test('request, order and purchase lists filter project and item with F3 and F8',async({page})=>{
  const ids=await page.evaluate(()=>{
    let db=InventoryUI.snapshot();
    db.masters.projects=[{code:'PR1',name:'검증 프로젝트 1'},{code:'PR2',name:'검증 프로젝트 2'}];
    db.masters.items.push({code:'REVIEW-B',name:'검증 품목 B'});
    const ids={};
    for(const type of ['request','purchaseorder','purchase'])for(const [project,item] of [['PR1','M001'],['PR2','REVIEW-B']]){
      const saved=InventoryCore.command(db,'document',{type,date:InventoryCore.today(),warehouse:'W001',partner:'V001',project,status:'진행',lines:[{item,qty:2,price:100}]});
      db=saved.db;if(project==='PR2')ids[type]=saved.result.id;
    }
    InventoryUI.replace(db);return ids;
  });
  const before=await documents(page);
  for(const [type,title] of [['request','발주요청'],['purchaseorder','발주서'],['purchase','구매']]){
    await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();
    const quick=page.getByLabel(title+' 빠른검색');
    await quick.press('F3');
    await expect(page.locator('.inv-filters')).toBeVisible();
    await page.getByLabel('프로젝트 필터',{exact:true}).selectOption('PR2');
    await page.getByLabel('품목 필터',{exact:true}).selectOption('REVIEW-B');
    await page.keyboard.press('F8');
    await expect(page.locator('tbody .inv-link')).toHaveCount(1);
    await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);
    await page.keyboard.press('F3');
    await expect(page.locator('.inv-filters')).toBeHidden();
    await expect(quick).toBeFocused();
    expect(await documents(page)).toEqual(before);
  }
});
test('saved synthetic request survives reload and unsupported sending stays disabled',async({page})=>{
  const beforeIds=new Set((await documents(page)).map(d=>d.id));
  await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
  const dialog=page.locator('#inventory-dialog');
  await dialog.getByLabel('품목 1',{exact:true}).selectOption('M001');
  await dialog.getByLabel('수량 1',{exact:true}).fill('3');
  await dialog.getByLabel('단가 1',{exact:true}).fill('123');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const saved=(await documents(page)).find(d=>d.type==='request'&&!beforeIds.has(d.id));
  expect(saved).toBeTruthy();
  expect(saved.lines[0].qty).toBe(3);
  await page.reload();
  await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
  expect((await documents(page)).find(d=>d.id===saved.id)).toEqual(saved);
  for(const name of ['Email','보내기','전자결재']) await expect(page.getByRole('button',{name:new RegExp('^'+name)})).toBeDisabled();
});
test('empty request cannot create a voucher',async({page})=>{
  const before=await documents(page);
  await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
  const dialog=page.locator('#inventory-dialog');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.inv-error')).not.toBeEmpty();
  expect(await documents(page)).toEqual(before);
});
