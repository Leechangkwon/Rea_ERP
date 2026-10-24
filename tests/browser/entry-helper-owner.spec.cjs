const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
  await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
});
for(const width of [390,1280])test('BOM helper guards changed owner and storage while normal save survives reload '+width,async({page})=>{
  await page.setViewportSize({width,height:844});page.on('dialog',dialog=>dialog.accept());
  const before=await page.evaluate(()=>({db:InventoryUI.snapshot(),forms:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('form')))}));
  await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
  const parent=page.locator('#inventory-dialog'),helper=page.locator('#entry-extra-dialog');
  await parent.getByRole('button',{name:'소요',exact:true}).click();
  await helper.getByLabel('생산 제품',{exact:true}).selectOption('P001');await helper.getByLabel('생산할 수량',{exact:true}).fill('5');
  await helper.getByRole('button',{name:'제품 추가',exact:true}).click();await helper.getByRole('button',{name:'계산(F8)',exact:true}).click();
  await page.evaluate(()=>{window.helperOwner=AuthUI.state;AuthUI.state=()=>({user:{id:'owner',roleId:'changed',company:{code:'SYNTH'}}});});
  await helper.getByRole('button',{name:'소요량 적용',exact:true}).click();await expect(helper.getByRole('alert')).toContainText('계정');await expect(parent.getByLabel('품목 1',{exact:true})).toHaveValue('');
  await page.screenshot({path:'.artifacts/manual-entry-helper-owner-20261024/blocked-'+width+'.png',fullPage:true});
  await page.evaluate(()=>{AuthUI.state=window.helperOwner;window.helperRaw=localStorage.getItem('ecount-inventory-v2');const next=JSON.parse(window.helperRaw);next.settings.externalMarker='other-window';localStorage.setItem('ecount-inventory-v2',JSON.stringify(next));});
  const externalRaw=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
  await helper.getByRole('button',{name:'소요량 적용',exact:true}).click();await expect(parent.getByLabel('품목 1',{exact:true})).toHaveValue('');expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(externalRaw);
  await page.evaluate(()=>localStorage.setItem('ecount-inventory-v2',window.helperRaw));
  await helper.getByRole('button',{name:'소요량 적용',exact:true}).click();await expect(helper).toHaveCount(0);await expect(parent.getByLabel('수량 1',{exact:true})).toHaveValue('10');
  expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(before.db);
  await parent.locator('.purchasing-local-state summary').click();await parent.getByLabel('전표 적요',{exact:true}).fill('합성 보조창 소유자 보존 '+width);
  await parent.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(parent).toHaveCount(0);await page.reload();
  const after=await page.evaluate(()=>({db:InventoryUI.snapshot(),forms:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes('form')))})),saved=after.db.documents.find(d=>d.memo==='합성 보조창 소유자 보존 '+width);
  expect(saved.lines.map(l=>[l.item,l.qty])).toEqual([['M001',10],['S001',5]]);expect(after.db.documents.filter(d=>d.id!==saved.id)).toEqual(before.db.documents);expect(after.db.settings).toEqual(before.db.settings);expect(after.forms).toEqual(before.forms);
  expect(await page.evaluate(()=>{const db=InventoryUI.snapshot();InventoryCore.validateBackup(db);return InventoryCore.movements(db);})).toEqual(await page.evaluate(before=>InventoryCore.movements(before),before.db));
});
