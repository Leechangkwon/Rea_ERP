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

test('purchasing currency and request number conditions filter without changing synthetic vouchers',async({page})=>{
 const ids=await page.evaluate(()=>{let db=InventoryUI.snapshot();const ids={};for(const type of ['request','purchaseorder','purchase']){const result=InventoryCore.command(db,'document',{type,date:InventoryCore.today(),warehouse:'W001',partner:'V001',currency:'USD',status:'진행',lines:[{item:'M001',qty:2,price:3}]});db=result.db;ids[type]=result.result.id;}InventoryUI.replace(db);return ids;});
 const before=await documents(page);
 for(const [type,title]of [['request','발주요청'],['purchaseorder','발주서'],['purchase','구매']]){await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();await page.getByLabel(title+' 빠른검색').press('F3');await page.getByLabel('내.외자구분',{exact:true}).selectOption('외자');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);if(type==='request'){await page.getByLabel('내.외자구분',{exact:true}).selectOption('전체');await page.getByLabel('발주요청No.',{exact:true}).fill(' '+ids[type].toLowerCase()+' ');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);}expect(await documents(page)).toEqual(before);}
});
test('plan detailed search F3 and F8 keep selection and staged quantity without saving',async({page})=>{
 const id=await page.evaluate(()=>{let db=InventoryUI.snapshot();db.masters.projects=[{code:'ROUND2',name:'가상 상세검색 프로젝트'}];const result=InventoryCore.command(db,'document',{type:'plan',date:InventoryCore.today(),warehouse:'W002',project:'ROUND2',status:'진행',lines:[{lineId:'SEARCH-A',item:'M001',supplier:'V001',qty:4,price:100},{lineId:'SEARCH-B',item:'S001',supplier:'V001',qty:2,price:20}]});InventoryUI.replace(result.db);return result.result.id;});
 const before=await documents(page);await page.locator('#routes').getByRole('button',{name:'발주계획조회',exact:true}).click();await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeHidden();await page.getByLabel('계획 선택 '+id+'|SEARCH-A',{exact:true}).check();await page.getByLabel('계획 수량 '+id+'|SEARCH-A',{exact:true}).fill('9');await page.getByLabel('계획 단가 '+id+'|SEARCH-A',{exact:true}).focus();await page.getByLabel('발주계획 빠른검색').press('F3');await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeVisible();await expect(page.getByLabel('발주계획 시작일',{exact:true})).toBeFocused();await page.getByLabel('발주계획 창고 필터',{exact:true}).selectOption('W002');await page.getByLabel('발주계획 프로젝트 필터',{exact:true}).selectOption('ROUND2');await page.getByLabel('발주계획 거래처 필터',{exact:true}).selectOption('V001');await page.getByLabel('발주계획 품목 필터',{exact:true}).selectOption('M001');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.getByLabel('계획 수량 '+id+'|SEARCH-A',{exact:true})).toHaveValue('9');await expect(page.getByLabel('계획 선택 '+id+'|SEARCH-A',{exact:true})).toBeChecked();await page.keyboard.press('F3');await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeHidden();await expect(page.getByLabel('발주계획 빠른검색')).toBeFocused();await page.keyboard.press('F3');await expect(page.getByLabel('발주계획 프로젝트 필터',{exact:true})).toHaveValue('ROUND2');expect(await documents(page)).toEqual(before);await page.screenshot({path:'.artifacts/purchasing-round2-20261019/synthetic-plan-search.png',fullPage:true});
});

test('plan request loader selects a voucher once and stages all source item lines',async({page})=>{
 const source=await page.evaluate(()=>{const db=InventoryUI.snapshot(),r=InventoryCore.command(db,'document',{type:'request',date:InventoryCore.today(),warehouse:'W001',status:'진행',lines:[{lineId:'VOUCHER-A',item:'M001',supplier:'V001',qty:3,price:100},{lineId:'VOUCHER-B',item:'M001',supplier:'V001',qty:4,price:200}]});InventoryUI.replace(r.db);return r.result.id;});const before=await documents(page);
 await page.locator('#routes').getByRole('button',{name:'발주계획입력',exact:true}).click();await page.getByRole('button',{name:'발주요청',exact:true}).click();let helper=page.locator('#entry-helper-dialog');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('전표 검색',{exact:true}).fill(source);await expect(helper.locator('tbody tr')).toHaveCount(1);await expect(helper.locator('tbody input[type=number]')).toHaveCount(0);await expect(helper.locator('tbody')).toContainText('외 1건');await helper.getByLabel('전표 선택 '+source,{exact:true}).check();await expect(helper).toContainText('선택 1건');await page.screenshot({path:'.artifacts/plan-request-import-20261019/synthetic-voucher-import.png',fullPage:true});await helper.getByLabel('선택 적용',{exact:true}).click();await expect(helper).toBeHidden();await expect(page.getByLabel('수량 1',{exact:true})).toHaveValue('3');await expect(page.getByLabel('수량 2',{exact:true})).toHaveValue('4');await expect(page.getByLabel('단가 1',{exact:true})).toHaveValue('100');await expect(page.getByLabel('단가 2',{exact:true})).toHaveValue('200');expect(await documents(page)).toEqual(before);
 await page.getByRole('button',{name:'전표 불러오기',exact:true}).click();helper=page.locator('#entry-helper-dialog');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('원본 전표 종류',{exact:true}).selectOption('request');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('전표 검색',{exact:true}).fill(source);await expect(helper.locator('tbody tr')).toHaveCount(1);await helper.getByRole('button',{name:'취소',exact:true}).click();await expect(page.getByLabel('수량 2',{exact:true})).toHaveValue('4');expect(await documents(page)).toEqual(before);
});
