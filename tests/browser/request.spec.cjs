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
    await expect(page.locator('.inv-filters')).toBeHidden();
    await expect(quick).toBeFocused();
    await page.keyboard.press('F3');
    await expect(page.locator('.inv-filters')).toBeVisible();
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
 for(const [type,title]of [['request','발주요청'],['purchaseorder','발주서'],['purchase','구매']]){await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();await page.getByLabel(title+' 빠른검색').press('F3');await page.getByLabel('내.외자구분',{exact:true}).selectOption('외자');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);if(type==='request'){await page.getByLabel(title+' 빠른검색').press('F3');await page.getByLabel('내.외자구분',{exact:true}).selectOption('전체');await page.getByLabel('발주요청No.',{exact:true}).fill(' '+ids[type].toLowerCase()+' ');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);}expect(await documents(page)).toEqual(before);}
});
test('plan detailed search F3 and F8 keep selection and staged quantity without saving',async({page})=>{
 const id=await page.evaluate(()=>{let db=InventoryUI.snapshot();db.masters.projects=[{code:'ROUND2',name:'가상 상세검색 프로젝트'}];const result=InventoryCore.command(db,'document',{type:'plan',date:InventoryCore.today(),warehouse:'W002',project:'ROUND2',status:'진행',lines:[{lineId:'SEARCH-A',item:'M001',supplier:'V001',qty:4,price:100},{lineId:'SEARCH-B',item:'S001',supplier:'V001',qty:2,price:20}]});InventoryUI.replace(result.db);return result.result.id;});
 const before=await documents(page);await page.locator('#routes').getByRole('button',{name:'발주계획조회',exact:true}).click();await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeHidden();await page.getByLabel('계획 선택 '+id+'|SEARCH-A',{exact:true}).check();await page.getByLabel('계획 수량 '+id+'|SEARCH-A',{exact:true}).fill('9');await page.getByLabel('계획 단가 '+id+'|SEARCH-A',{exact:true}).focus();await page.getByLabel('발주계획 빠른검색').press('F3');await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeVisible();await expect(page.getByLabel('발주계획 시작일',{exact:true})).toBeFocused();await page.getByLabel('발주계획 창고 필터',{exact:true}).selectOption('W002');await page.getByLabel('발주계획 프로젝트 필터',{exact:true}).selectOption('ROUND2');await page.getByLabel('발주계획 거래처 필터',{exact:true}).selectOption('V001');await page.getByLabel('발주계획 품목 필터',{exact:true}).selectOption('M001');await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.getByLabel('계획 수량 '+id+'|SEARCH-A',{exact:true})).toHaveValue('9');await expect(page.getByLabel('계획 선택 '+id+'|SEARCH-A',{exact:true})).toBeChecked();await expect(page.getByLabel('발주계획 상세검색',{exact:true})).toBeHidden();await expect(page.getByLabel('발주계획 빠른검색')).toBeFocused();await page.keyboard.press('F3');await expect(page.getByLabel('발주계획 프로젝트 필터',{exact:true})).toHaveValue('ROUND2');expect(await documents(page)).toEqual(before);await page.screenshot({path:'.artifacts/purchasing-round2-20261019/synthetic-plan-search.png',fullPage:true});
});

test('plan request loader selects a voucher once and stages all source item lines',async({page})=>{
 const source=await page.evaluate(()=>{const db=InventoryUI.snapshot(),r=InventoryCore.command(db,'document',{type:'request',date:InventoryCore.today(),warehouse:'W001',status:'진행',lines:[{lineId:'VOUCHER-A',item:'M001',supplier:'V001',qty:3,price:100},{lineId:'VOUCHER-B',item:'M001',supplier:'V001',qty:4,price:200}]});InventoryUI.replace(r.db);return r.result.id;});const before=await documents(page);
 await page.locator('#routes').getByRole('button',{name:'발주계획입력',exact:true}).click();await page.getByRole('button',{name:'발주요청',exact:true}).click();let helper=page.locator('#entry-helper-dialog');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('전표 검색',{exact:true}).fill(source);await expect(helper.locator('tbody tr')).toHaveCount(1);await expect(helper.locator('tbody input[type=number]')).toHaveCount(0);await expect(helper.locator('tbody')).toContainText('외 1건');await helper.getByLabel('전표 선택 '+source,{exact:true}).check();await expect(helper).toContainText('선택 1건');await page.screenshot({path:'.artifacts/plan-request-import-20261019/synthetic-voucher-import.png',fullPage:true});await helper.getByLabel('선택 적용',{exact:true}).click();await expect(helper).toBeHidden();await expect(page.getByLabel('수량 1',{exact:true})).toHaveValue('3');await expect(page.getByLabel('수량 2',{exact:true})).toHaveValue('4');await expect(page.getByLabel('단가 1',{exact:true})).toHaveValue('100');await expect(page.getByLabel('단가 2',{exact:true})).toHaveValue('200');expect(await documents(page)).toEqual(before);
 await page.getByRole('button',{name:'전표 불러오기',exact:true}).click();helper=page.locator('#entry-helper-dialog');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('원본 전표 종류',{exact:true}).selectOption('request');await expect(helper.getByLabel('집계조건',{exact:true})).toHaveValue('document');await helper.getByLabel('전표 검색',{exact:true}).fill(source);await expect(helper.locator('tbody tr')).toHaveCount(1);await helper.getByRole('button',{name:'취소',exact:true}).click();await expect(page.getByLabel('수량 2',{exact:true})).toHaveValue('4');expect(await documents(page)).toEqual(before);
});

test('purchase-order Email reviews one supplier and sends a single confirmed synthetic request',async({page})=>{
 let record=null,sends=0;await page.route('**/api/mail/**',async route=>{const path=new URL(route.request().url()).pathname;let json;if(path.endsWith('/status'))json={configured:true,sender:'synthetic-sender@gmail.com'};else if(path.endsWith('/history'))json={records:record?[record]:[]};else if(path.endsWith('/send')){const body=route.request().postDataJSON();expect(body.confirmed).toBe(true);expect(body.recipient).toBe('supplier@example.test');expect(body.documents).toHaveLength(1);sends++;record={id:'synthetic-mail',requestId:body.requestId,recipient:body.recipient,subject:body.subject,documentIds:body.documents.map(d=>d.id),documentHashes:{},createdAt:'2026-10-19T00:00:00Z',status:'accepted'};json={record};}else return route.fulfill({status:404});await route.fulfill({json});});
 const before=await documents(page);await page.evaluate(()=>{AuthUI.request=async(path,data)=>{const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return r.json();};});await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();const id=(await documents(page)).find(d=>d.type==='purchaseorder'&&InventoryStatus(d)).id;function InventoryStatus(d){return !['취소','보류','미확인'].includes(d.status);}
 await page.getByLabel('전표 선택 '+id,{exact:true}).check();await page.getByRole('button',{name:'Email',exact:true}).click();const dialog=page.getByRole('dialog',{name:'발주서 Gmail 이메일',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel('받는 이메일',{exact:true}).fill('supplier@example.test');await dialog.getByLabel('메일 제목',{exact:true}).fill('합성 발주서 검증');await dialog.getByLabel('메일 본문',{exact:true}).fill('실제 발송하지 않는 합성 검증입니다.');await dialog.getByRole('button',{name:'발송 내용 확인',exact:true}).click();await expect(dialog.getByRole('button',{name:'Gmail로 발송',exact:true})).toBeDisabled();expect(sends).toBe(0);await dialog.getByLabel('수신자와 첨부 발주서 확인',{exact:true}).check();await dialog.getByRole('button',{name:'Gmail로 발송',exact:true}).dblclick();await expect(dialog.getByRole('status')).toContainText('Gmail 접수');expect(sends).toBe(1);expect(await documents(page)).toEqual(before);await page.screenshot({path:'.artifacts/gmail-purchaseorder-20261019/synthetic-composer-result.png',fullPage:true});
});
test('Gmail not connected and cancelled composer never send or alter vouchers',async({page})=>{
 let sends=0,pdfs=0;await page.route('**/api/mail/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/pdf')){pdfs++;return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%synthetic-client-download-only\n'});}if(path.endsWith('/send'))sends++;await route.fulfill({json:path.endsWith('/status')?{configured:false,sender:''}:{records:[]}});});await page.evaluate(()=>{AuthUI.request=async path=>(await fetch(path)).json();});const before=await documents(page);await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();await page.getByLabel('현재 페이지 전체 선택',{exact:true}).check();await page.getByRole('button',{name:'Email',exact:true}).click();const dialog=page.getByRole('dialog',{name:'발주서 Gmail 이메일',exact:true});await expect(dialog).toContainText('아직 연결되지 않았습니다');await expect(dialog.getByRole('button',{name:'발송 내용 확인',exact:true})).toBeDisabled();const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:/^PDF 확인/}).click()]);expect(download.suggestedFilename()).toMatch(/\.pdf$/);expect(pdfs).toBe(1);await dialog.getByRole('button',{name:'닫기',exact:true}).click();expect(sends).toBe(0);expect(await documents(page)).toEqual(before);
});

test('changed purchase order cannot be sent from a stale reviewed Gmail composer',async({page})=>{let sends=0;await page.route('**/api/mail/**',async route=>{if(route.request().method()==='POST')sends++;await route.fulfill({json:new URL(route.request().url()).pathname.endsWith('/status')?{configured:true,sender:'synthetic-sender@gmail.com'}:{records:[]}});});await page.evaluate(()=>{AuthUI.request=async path=>(await fetch(path)).json();});await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();await page.getByLabel('현재 페이지 전체 선택',{exact:true}).check();await page.getByRole('button',{name:'Email',exact:true}).click();const d=page.getByRole('dialog',{name:'발주서 Gmail 이메일',exact:true});await d.getByLabel('받는 이메일',{exact:true}).fill('supplier@example.test');await d.getByRole('button',{name:'발송 내용 확인',exact:true}).click();await d.getByLabel('수신자와 첨부 발주서 확인',{exact:true}).check();await page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));db.documents.find(d=>d.type==='purchaseorder').lines[0].qty+=1;localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));});await d.getByRole('button',{name:'Gmail로 발송',exact:true}).click();await expect(d.getByRole('alert')).toContainText('발주서 내용이 변경');expect(sends).toBe(0);});

test('three purchasing lists retain successful rows and CSV until explicit search, including invalid-date recovery',async({page})=>{
 const ids=await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);db.masters.projects=[{code:'APPLY-A',name:'합성 A'},{code:'APPLY-B',name:'합성 B'}];const result={};for(const type of ['request','purchaseorder','purchase'])for(const project of ['APPLY-A','APPLY-B']){const saved=InventoryCore.command(db,'document',{type,date:InventoryCore.today(),warehouse:'W001',partner:'V001',project,status:'진행',lines:[{item:'M001',qty:2,price:100}]});db=saved.db;if(project==='APPLY-B')result[type]=saved.result.id;}InventoryUI.replace(db);return result;});
 const before=await documents(page);
 for(const [type,title]of [['request','발주요청'],['purchaseorder','발주서'],['purchase','구매']]){
  await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();await page.getByLabel(title+' 빠른검색').press('F3');await page.getByLabel('프로젝트 필터',{exact:true}).selectOption('APPLY-B');await expect(page.locator('tbody .inv-link')).toHaveCount(2);await page.keyboard.press('F8');await expect(page.locator('.inv-filters')).toBeHidden();await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);
  await page.getByLabel('전표 선택 '+ids[type],{exact:true}).check();await page.getByLabel(title+' 빠른검색').press('F3');await page.getByLabel('프로젝트 필터',{exact:true}).selectOption('APPLY-A');await page.getByLabel('자료 검색',{exact:true}).fill('pending-no-match');await page.getByRole('button',{name:'전체 상태 조회',exact:true}).click();await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);await expect(page.getByLabel('전표 선택 '+ids[type],{exact:true})).toBeChecked();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Excel (CSV)',exact:true}).click();const download=await downloadPromise,text=require('node:fs').readFileSync(await download.path(),'utf8');expect(text).toContain(ids[type]);expect(text).not.toContain('pending-no-match');
  await page.getByLabel('시작일',{exact:true}).fill('2099-12-31');await page.getByLabel('종료일',{exact:true}).fill('2000-01-01');await page.keyboard.press('F8');await expect(page.locator('.inv-filters')).toBeVisible();await expect(page.locator('[role="alert"]')).toContainText('시작일');await expect(page.locator('tbody .inv-link')).toContainText(ids[type]);await expect(page.getByLabel('전표 선택 '+ids[type],{exact:true})).toBeChecked();expect(await documents(page)).toEqual(before);
 }
 await page.screenshot({path:'.artifacts/purchasing-search-state-20261019/synthetic-search-state.png',fullPage:true});
});
test('plan saved detail keeps staged list quantity and pending query while retaining stale-source protection',async({page})=>{
 const id=await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);const r=InventoryCore.command(db,'document',{type:'plan',date:InventoryCore.today(),warehouse:'W001',status:'진행',lines:[{lineId:'STATE-A',item:'M001',supplier:'V001',qty:2,price:100}]});InventoryUI.replace(r.db);return r.result.id;});
 await page.locator('#routes').getByRole('button',{name:'발주계획조회',exact:true}).click();const quick=page.getByLabel('발주계획 빠른검색');await quick.fill(id);await quick.press('Enter');await page.getByLabel('계획 선택 '+id+'|STATE-A',{exact:true}).check();await page.getByLabel('계획 수량 '+id+'|STATE-A',{exact:true}).fill('9');await page.getByLabel('계획 단가 '+id+'|STATE-A',{exact:true}).focus();await quick.press('F3');await quick.fill('pending-no-match');await page.locator('tbody .inv-link').click();let dialog=page.getByRole('dialog',{name:'발주계획 상세 / 수정',exact:true});await dialog.getByLabel('납기일',{exact:true}).fill('2099-12-30');await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();if(await dialog.isVisible())await dialog.getByRole('button',{name:'상세 창 닫기',exact:true}).click();await expect(page.locator('tbody .inv-link')).toHaveCount(1);await expect(quick).toHaveValue('pending-no-match');await expect(page.getByLabel('계획 선택 '+id+'|STATE-A',{exact:true})).toBeChecked();await expect(page.getByLabel('계획 수량 '+id+'|STATE-A',{exact:true})).toHaveValue('9');await page.getByRole('button',{name:'변경 저장',exact:true}).click();await expect(page.locator('[role="alert"]')).toContainText('원본 전표가 변경');expect((await documents(page))[0].lines[0].qty).toBe(2);
});

test('all four purchasing reference dialogs stage multi selections separately from list F8 and cancellation',async({page})=>{
 await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);db.masters.warehouses.push({code:'MULTI3',name:'합성 세번째 창고'});for(const type of ['request','plan','purchaseorder','purchase'])for(const warehouse of ['W001','W002','MULTI3'])db=InventoryCore.command(db,'document',{type,date:InventoryCore.today(),warehouse,partner:'V001',status:'진행',lines:[{lineId:'MULTI-A',item:'M001',supplier:'V001',qty:2,price:100}]}).db;InventoryUI.replace(db);});
 const before=await documents(page);
 for(const title of ['발주요청','발주계획','발주서','구매']){await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();await page.getByLabel(title+' 빠른검색').press('F3');const prefix=title==='발주계획'?'발주계획 ':'';await page.getByRole('button',{name:prefix+'창고 필터 다중 선택',exact:true}).click();let dialog=page.getByRole('dialog',{name:prefix+'창고 다중 선택',exact:true});await expect(dialog).toBeVisible();await dialog.getByLabel(prefix+'창고 W001 선택',{exact:true}).check();await dialog.getByLabel(prefix+'창고 W002 선택',{exact:true}).check();await page.keyboard.press('F8');await expect(dialog).toHaveCount(0);await expect(page.locator('tbody .inv-link')).toHaveCount(3);await expect(page.getByRole('button',{name:prefix+'창고 필터 다중 선택',exact:true})).toContainText('(2)');await page.getByRole('button',{name:prefix+'창고 필터 다중 선택',exact:true}).click();dialog=page.getByRole('dialog',{name:prefix+'창고 다중 선택',exact:true});await expect(dialog.getByLabel(prefix+'창고 W001 선택',{exact:true})).toBeChecked();await dialog.getByLabel(prefix+'창고 MULTI3 선택',{exact:true}).check();await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(2);await expect(page.locator('.inv-filters')).toBeHidden();expect(await documents(page)).toEqual(before);}
});
test('modified sorting uses recorded edits and keeps ordering after a real synthetic detail save',async({page})=>{
 const ids=await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);const ids=[];for(const warehouse of ['W001','W002']){const r=InventoryCore.command(db,'document',{type:'request',date:InventoryCore.today(),warehouse,partner:'V001',dueDate:InventoryCore.today(),status:'진행',lines:[{item:'M001',qty:2,price:100}]});db=r.db;ids.push(r.result.id);}delete db.documentHistory;db.documents[0].modifiedAt='2001-01-01T00:00:00.000Z';db.documents[1].modifiedAt='2002-01-01T00:00:00.000Z';InventoryUI.replace(db);return ids;});await page.locator('#routes').getByRole('button',{name:'발주요청조회',exact:true}).click();const before=await documents(page);await page.getByLabel('발주요청 빠른검색').press('F3');await page.getByLabel('수정일자순(정렬)',{exact:true}).check();await expect(page.locator('tbody .inv-link').first()).toContainText(ids[0]);await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link').first()).toContainText(ids[1]);expect(await documents(page)).toEqual(before);await page.locator('tbody .inv-link').filter({hasText:ids[0]}).click();const dialog=page.getByRole('dialog',{name:'발주요청 상세 / 수정',exact:true});await dialog.getByLabel('납기일',{exact:true}).fill('2099-12-30');await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();if(await dialog.isVisible())await dialog.getByRole('button',{name:'상세 창 닫기',exact:true}).click();await expect(page.locator('tbody .inv-link').first()).toContainText(ids[0]);const after=await documents(page);expect(after.find(d=>d.id===ids[0]).modifiedAt>before[0].modifiedAt).toBe(true);expect(after.find(d=>d.id===ids[1])).toEqual(before[1]);
});
test('large multi picker stays within a narrow viewport and searches beyond native options',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const db=InventoryUI.snapshot();const base=db.masters.items.find(x=>x.code==='M001');db.masters.items.push(...Array.from({length:1500},(_,i)=>({...base,code:'MULTI-'+i,name:'합성 품목 '+i})));InventoryUI.replace(db);});await page.locator('#routes').getByRole('button',{name:'발주요청조회',exact:true}).click();const before=await documents(page);await page.getByLabel('발주요청 빠른검색').press('F3');await page.getByRole('button',{name:'품목 필터 다중 선택',exact:true}).click();const dialog=page.getByRole('dialog',{name:'품목 다중 선택',exact:true});await expect(dialog.locator('tbody tr')).toHaveCount(50);const bound=await dialog.boundingBox();expect(bound.x).toBeGreaterThanOrEqual(0);expect(bound.x+bound.width).toBeLessThanOrEqual(390);await dialog.getByLabel('품목 선택 검색',{exact:true}).fill('MULTI-1499');await dialog.getByLabel('품목 선택 검색',{exact:true}).press('Enter');await expect(dialog.locator('tbody tr')).toHaveCount(1);await dialog.getByLabel('품목 MULTI-1499 선택',{exact:true}).check();await dialog.getByRole('button',{name:'적용(F8)',exact:true}).click();await expect(page.getByLabel('품목 필터',{exact:true})).toHaveValue('MULTI-1499');expect(await documents(page)).toEqual(before);await page.screenshot({path:'.artifacts/purchasing-multiselect-sort-20261020/synthetic-mobile-picker.png',fullPage:true});
});

test('transaction selection and optional BODY management persist through actual synthetic save and reload',async({page})=>{
 await page.evaluate(()=>{const db=InventoryUI.snapshot();db.masters.controls=[{code:'BROWSER-MG',name:'합성 관리항목'}];db.settings.customization=FormCore.save(db.settings.customization,'doc:request','lines',{id:'browser_management',name:'합성 BODY',fields:[FormCore.field('managementItem','관리항목','reference')]});InventoryUI.replace(db);});
 await page.locator('#routes').getByRole('button',{name:'발주요청조회',exact:true}).click();const beforeIds=new Set((await documents(page)).map(x=>x.id));await page.getByRole('button',{name:'신규(F2)',exact:true}).click();const dialog=page.locator('#inventory-dialog');await dialog.getByLabel('품목 1',{exact:true}).selectOption('M001');await dialog.getByLabel('단가 1',{exact:true}).fill('100');await dialog.getByLabel('관리항목 1',{exact:true}).selectOption('BROWSER-MG');await dialog.getByLabel('거래유형',{exact:true}).selectOption('22');await expect(dialog.getByLabel('부가세율(로컬 계산)',{exact:true})).toHaveValue('0');await expect(dialog.locator('.inv-totals')).toContainText('부가세 0');await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(dialog).toHaveCount(0);const saved=(await documents(page)).find(x=>!beforeIds.has(x.id));expect(saved.transactionType).toBe('22');expect(saved.vatRate).toBe(0);expect(saved.lines[0].managementItem).toBe('BROWSER-MG');await page.reload();expect((await documents(page)).find(x=>x.id===saved.id)).toEqual(saved);
});
test('management and transaction popup filters keep query staging and do not reclassify old vouchers',async({page})=>{
 await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);db.masters.controls=[{code:'MG-A',name:'합성 관리 A'},{code:'MG-B',name:'합성 관리 B'}];for(const [type,transactionType,managementItem]of [['request',undefined,'MG-A'],['request',undefined,'MG-B'],['purchase','21',undefined],['purchase','22',undefined],['purchase',undefined,undefined]])db=InventoryCore.command(db,'document',{type,transactionType,date:InventoryCore.today(),warehouse:'W001',partner:'V001',lines:[{item:'M001',qty:1,price:100,...(managementItem?{managementItem}:{})}]}).db;db.masters.controls[1].disabled=true;InventoryUI.replace(db);});const before=await documents(page);
 for(const [title,field,code,inactive]of [['발주요청','관리항목','MG-B',true],['구매','거래유형','22',false]]){await page.locator('#routes').getByRole('button',{name:title+'조회',exact:true}).click();await page.getByLabel(title+' 빠른검색').press('F3');const count=await page.locator('tbody .inv-link').count();await page.getByRole('button',{name:field+' 필터 다중 선택',exact:true}).click();const dialog=page.getByRole('dialog',{name:field+' 다중 선택',exact:true});if(inactive){await expect(dialog.getByLabel(field+' '+code+' 선택',{exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'사용중단포함',exact:true}).click();}await dialog.getByLabel(field+' '+code+' 선택',{exact:true}).check();await dialog.getByRole('button',{name:'적용(F8)',exact:true}).click();await expect(page.locator('tbody .inv-link')).toHaveCount(count);await page.keyboard.press('F8');await expect(page.locator('tbody .inv-link')).toHaveCount(1);expect(await documents(page)).toEqual(before);}
});

test('manual date ranges apply on F8, preserve errors and survive unchanged stored data on reload',async({page})=>{
 const ids=await page.evaluate(()=>{let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);for(let i=0;i<3;i++)db=InventoryCore.command(db,'document',{type:'request',date:InventoryCore.today(),warehouse:'W001',partner:'V001',lines:[{item:'M001',qty:1,price:100}]}).db;delete db.documentHistory;db.documents.forEach((d,i)=>{d.createdAt=i<2?'2024-02-28T15:00:00.000Z':'2024-02-29T15:00:00.000Z';d.modifiedAt=i===0?'2024-03-01T00:00:00.000Z':'2024-03-02T00:00:00.000Z';});InventoryUI.replace(db);return db.documents.map(d=>d.id);});
 await page.locator('#routes').getByRole('button',{name:'발주요청조회',exact:true}).click();const before=await documents(page);await page.getByLabel('발주요청 빠른검색').press('F3');await page.getByLabel('최초작성일자 시작',{exact:true}).fill('2024-02-29');await page.getByLabel('최초작성일자 종료',{exact:true}).fill('2024-02-29');await page.getByLabel('최종수정일시 종료',{exact:true}).fill('2024-03-01');await expect(page.locator('tbody input[type=checkbox]')).toHaveCount(3);await page.keyboard.press('F8');await expect(page.locator('tbody input[type=checkbox]')).toHaveCount(1);await page.getByLabel('전표 선택 '+ids[0],{exact:true}).check();await page.getByLabel('발주요청 빠른검색').press('F3');await page.getByLabel('최초작성일자 시작',{exact:true}).fill('2024-03-02');await page.keyboard.press('F8');await expect(page.locator('.inv-filters')).toBeVisible();await expect(page.locator('.inv-error[role="alert"]')).toContainText('최초작성일자 시작일');await expect(page.getByLabel('전표 선택 '+ids[0],{exact:true})).toBeChecked();expect(await documents(page)).toEqual(before);
 await page.getByLabel('최초작성일자 시작',{exact:true}).fill('2024-02-29');await page.keyboard.press('F8');await page.reload();expect(await documents(page)).toEqual(before);await page.setViewportSize({width:390,height:844});await page.getByLabel('발주요청 빠른검색').press('F3');await expect(page.getByLabel('최종수정일시 종료',{exact:true})).toBeVisible();await page.screenshot({path:'.artifacts/manual-parity-20261021/date-search-mobile.png',fullPage:true});
});

test('request BOM first-level calculation is staged, saved and reloaded without replacing existing records or forms',async({page})=>{
 await page.evaluate(()=>{const key='ecount-inventory-v2',db=JSON.parse(localStorage.getItem(key));db.bom=[{product:'P001',material:'P002',qty:2,loss:0},{product:'P001',material:'M001',qty:3,loss:0},{product:'P002',material:'S001',qty:4,loss:0}];localStorage.setItem(key,JSON.stringify(db));});await page.reload();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));await page.getByRole('button',{name:'신규(F2)',exact:true}).click();const editor=page.locator('#inventory-dialog');await editor.getByRole('button',{name:'소요',exact:true}).click();const helper=page.locator('#entry-extra-dialog');await expect(helper.getByLabel('BOM구분',{exact:true})).toHaveValue('all');await helper.getByLabel('생산 제품',{exact:true}).selectOption('P001');await helper.getByLabel('생산할 수량',{exact:true}).fill('5');await helper.getByRole('button',{name:'제품 추가',exact:true}).click();await helper.getByRole('button',{name:'계산(F8)',exact:true}).click();await helper.getByLabel('BOM구분',{exact:true}).selectOption('first');await helper.getByRole('button',{name:'소요량 적용',exact:true}).click();await expect(helper.getByRole('alert')).toContainText('계산');await helper.getByRole('button',{name:'계산(F8)',exact:true}).click();expect(await documents(page)).toEqual(before.documents);await helper.getByRole('button',{name:'소요량 적용',exact:true}).click();await expect(helper).toHaveCount(0);await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();
 const saved=await documents(page),added=saved.find(d=>!before.documents.some(old=>old.id===d.id));expect(added.lines.map(l=>[l.item,l.qty])).toEqual([['P002',10],['M001',15]]);expect(added.lines[0].importedFrom[0].bomDepth).toBe('first');await page.reload();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));expect(after.settings).toEqual(before.settings);expect(after.documents.filter(d=>d.id!==added.id)).toEqual(before.documents);expect(after.documents.find(d=>d.id===added.id).lines).toEqual(added.lines);
});

test('order imports keep line rows or sum item rows through save and reload while preserving prior records',async({page})=>{
 await page.evaluate(()=>{const key='ecount-inventory-v2';let db=JSON.parse(localStorage.getItem(key));db.documents=db.documents.filter(d=>d.type!=='order'&&!d.sourceId);for(const qty of [2,3])db=InventoryCore.command(db,'document',{type:'order',date:InventoryCore.today(),warehouse:'W001',partner:'C001',lines:[{item:'M001',qty,price:100,memo:'합성 주문'}]}).db;localStorage.setItem(key,JSON.stringify(db));});await page.reload();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));const added=[];
 for(const grouping of ['line','item']){await page.getByRole('button',{name:'신규(F2)',exact:true}).click();const editor=page.locator('#inventory-dialog');await editor.getByRole('button',{name:'주문',exact:true}).click();const helper=page.locator('#entry-helper-dialog');await helper.getByLabel('집계조건',{exact:true}).selectOption(grouping);await helper.getByLabel('현재 페이지 전체 선택',{exact:true}).check();expect(await documents(page)).toHaveLength(before.documents.length+added.length);await helper.getByRole('button',{name:'선택 적용',exact:true}).click();await expect(helper).toHaveCount(0);await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);const saved=(await documents(page)).filter(d=>!before.documents.some(old=>old.id===d.id)&&!added.some(old=>old.id===d.id))[0];expect(saved.lines.map(l=>l.qty).sort()).toEqual(grouping==='line'?[2,3]:[5]);expect(saved.lines.flatMap(l=>l.importedFrom).map(x=>x.qty).sort()).toEqual([2,3]);added.push(saved);await page.reload();expect((await documents(page)).find(d=>d.id===saved.id)).toEqual(saved);}
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));expect(after.settings).toEqual(before.settings);expect(after.documents.filter(d=>before.documents.some(old=>old.id===d.id))).toEqual(before.documents);
});

test('linked purchase blocks parent header mismatch without changing saved data and allows memo edits',async({page})=>{
  const ids=await page.evaluate(()=>{
    let db=InventoryUI.snapshot();
    db.masters.partners.push({code:'LINK-V2',name:'가상 연결 검증 공급사'});
    let out=InventoryCore.command(db,'document',{type:'purchaseorder',date:InventoryCore.today(),warehouse:'W001',partner:'V001',status:'진행',lines:[{item:'M001',qty:10,price:100}]});
    const sourceId=out.result.id;
    out=InventoryCore.command(out.db,'convert',{id:sourceId,type:'purchase',quantities:{M001:4}});
    InventoryUI.replace(out.db);return {sourceId,childId:out.result.id};
  });
  await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();
  const quick=page.getByLabel('발주서 빠른검색');await quick.fill(ids.sourceId);await quick.press('Enter');
  await page.locator('tbody .inv-link').click();
  const dialog=page.getByRole('dialog',{name:'발주서 상세 / 수정',exact:true});
  await expect(dialog).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));
  await dialog.getByLabel('거래처',{exact:true}).selectOption('LINK-V2');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('후속 전표와 거래처');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')))).toEqual(before);
  await dialog.getByLabel('거래처',{exact:true}).selectOption('V001');
  await dialog.getByLabel('출하/입고창고',{exact:true}).selectOption('W002');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('후속 전표와 창고');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')))).toEqual(before);
  await page.screenshot({path:'.artifacts/manual-purchase-link-20261021/synthetic-header-rejection.png',fullPage:true});
  await dialog.getByLabel('출하/입고창고',{exact:true}).selectOption('W001');
  await dialog.locator('.purchasing-local-state summary').click();
  await dialog.getByLabel('전표 적요',{exact:true}).fill('연결 보존 후 적요 저장');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));
  expect(after.documents.find(d=>d.id===ids.sourceId).memo).toBe('연결 보존 후 적요 저장');
  expect(after.documents.find(d=>d.id===ids.childId)).toEqual(before.documents.find(d=>d.id===ids.childId));
  expect(after.settings).toEqual(before.settings);
  await page.locator('#routes').getByRole('button',{name:'구매조회',exact:true}).click();
  await page.getByLabel('구매 빠른검색').fill(ids.childId);await page.getByLabel('구매 빠른검색').press('Enter');
  await page.locator('tbody .inv-link').click();
  const child=page.getByRole('dialog',{name:'구매 상세 / 수정',exact:true});
  await child.locator('.purchasing-local-state summary').click();
  await child.getByLabel('전표 적요',{exact:true}).fill('후속 구매 수정 가능');
  await child.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(child).toHaveCount(0);
  expect((await documents(page)).find(d=>d.id===ids.childId).memo).toBe('후속 구매 수정 가능');
});


test('plan line supplier conflict preserves saved vouchers and allows correction before saving',async({page})=>{
  const ids=await page.evaluate(()=>{
    const C=InventoryCore;let db=C.empty();db.masters=C.clone(C.seed().masters);
    db.masters.partners.push({code:'PLAN-V2',name:'합성 계획 공급사2'});
    let out=C.command(db,'document',{type:'plan',date:C.today(),warehouse:'W001',partner:'',status:'진행',lines:[{item:'M001',qty:10,price:100,supplier:'V001'}]});
    const sourceId=out.result.id;out=C.command(out.db,'convert',{id:sourceId,type:'purchaseorder',partner:'V001',quantities:{M001:4}});
    InventoryUI.replace(out.db);return {sourceId,childId:out.result.id};
  });
  await page.locator('#routes').getByRole('button',{name:'발주계획조회',exact:true}).click();
  const quick=page.getByLabel('발주계획 빠른검색');await quick.fill(ids.sourceId);await quick.press('Enter');
  await page.locator('tbody .inv-link').click();
  const dialog=page.getByRole('dialog',{name:'발주계획 상세 / 수정',exact:true});await expect(dialog).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));
  await dialog.getByLabel('거래처 1',{exact:true}).selectOption('PLAN-V2');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('후속 발주서와 품목행 거래처');
  await expect(dialog.getByLabel('거래처 1',{exact:true})).toHaveValue('PLAN-V2');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')))).toEqual(before);
  await page.screenshot({path:'.artifacts/manual-plan-supplier-20261021/supplier-rejection.png',fullPage:true});
  await dialog.getByLabel('거래처 1',{exact:true}).selectOption('V001');
  await dialog.getByLabel('수량 1',{exact:true}).fill('12');
  await dialog.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.reload();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));
  expect(after.documents.find(d=>d.id===ids.sourceId).lines[0].qty).toBe(12);
  expect(after.documents.find(d=>d.id===ids.childId)).toEqual(before.documents.find(d=>d.id===ids.childId));
  expect(after.settings).toEqual(before.settings);
});


test('plan with an ancestor-only row reference imports into orders and purchases through saved UI flows',async({page})=>{
  const ids=await page.evaluate(()=>{
    const C=InventoryCore;let db=C.empty();db.masters=C.clone(C.seed().masters);
    let out=C.command(db,'document',{type:'request',date:C.today(),warehouse:'W001',lines:[{lineId:'REQUEST-ROW',item:'M001',qty:10,price:100,supplier:'V001'}]});
    const requestId=out.result.id;
    out=C.command(out.db,'document',{type:'plan',date:C.today(),warehouse:'W001',sourceId:requestId,lines:[{sourceLineId:'REQUEST-ROW',item:'M001',qty:6,price:100,supplier:'V001'}]});
    InventoryUI.replace(C.validateBackup(out.db));return {requestId,planId:out.result.id};
  });
  const before=await page.evaluate(()=>InventoryUI.snapshot());
  const added=[];
  for(const [type,label,importLabel,sourceId,sourceLineId,qty] of [
    ['purchaseorder','발주서','계획',ids.planId,'',4],
    ['purchase','구매','발주',null,null,2]
  ]){
    const source=type==='purchase'?added[0]:null,id=source?.id||sourceId,key=id+'|'+(source?.lines[0].lineId||sourceLineId||'M001');
    await page.locator('#routes').getByRole('button',{name:label+'조회',exact:true}).click();
    await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
    const editor=page.locator('#inventory-dialog');
    await editor.getByLabel('거래처',{exact:true}).selectOption('V001');
    await editor.getByRole('button',{name:importLabel,exact:true}).click();
    const picker=page.locator('#entry-helper-dialog');
    await expect(picker.getByLabel('불러오기 방식',{exact:true})).toHaveValue('linked');
    await picker.getByLabel('행 선택 '+key,{exact:true}).check();
    await picker.getByLabel('불러올 수량 '+key,{exact:true}).fill(String(qty));
    await picker.getByRole('button',{name:'선택 적용',exact:true}).click();
    await expect(picker).toHaveCount(0);
    expect((await documents(page)).length).toBe(before.documents.length+added.length);
    await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);
    const saved=(await documents(page)).find(d=>d.type===type);added.push(saved);
    expect(saved.sourceId).toBe(id);expect(saved.lines[0].sourceLineId).not.toBe('REQUEST-ROW');expect(saved.lines[0].qty).toBe(qty);
    await page.reload();expect((await documents(page)).find(d=>d.id===saved.id)).toEqual(saved);
  }
  const after=await page.evaluate(()=>InventoryUI.snapshot());
  expect(after.documents.slice(0,2)).toEqual(before.documents);expect(after.settings).toEqual(before.settings);
  const balances=await page.evaluate(({planId,orderId})=>{const db=InventoryUI.snapshot(),C=InventoryCore;return {plan:C.remaining(db,db.documents.find(d=>d.id===planId),'purchaseorder')[0].qty,order:C.remaining(db,db.documents.find(d=>d.id===orderId),'purchase')[0].qty,stock:C.stock(db,'M001','W001'),payable:C.outstanding(db,'payable','V001')};},{planId:ids.planId,orderId:added[0].id});
  expect(balances).toEqual({plan:2,order:2,stock:2,payable:220});
  await page.locator('#routes').getByRole('button',{name:'구매조회',exact:true}).click();
  await page.locator('tbody .inv-link').click();await expect(page.getByRole('dialog',{name:'구매 상세 / 수정',exact:true})).toBeVisible();
  await page.screenshot({path:'.artifacts/manual-five-stage-20261021/synthetic-purchase-lineage.png',fullPage:true});
});


test('completed grouped plan orders retain quantity locks and allow price edits without changing existing receipts',async({page})=>{
 const ids=await page.evaluate(()=>{
  const C=InventoryCore;let db=C.empty();db.masters=C.clone(C.seed().masters);
  let out=C.command(db,'document',{type:'plan',date:C.today(),dueDate:C.today(),warehouse:'W001',lines:[{lineId:'PLAN-ROW',item:'M001',qty:10,price:100,supplier:'V001'}]});
  const planId=out.result.id;
  out=PurchasePlanCore.commit(out.db,PurchasePlanCore.preview(out.db,{date:C.today(),grouping:'supplier-date-item',selections:[{documentId:planId,item:'M001',lineId:'PLAN-ROW',qty:2}]}));
  const orderId=out.result[0].id;
  out=C.command(out.db,'convert',{id:orderId,type:'purchase',quantities:{PL1:1}});const purchaseId=out.result.id;
  out=C.command(out.db,'planLineProgress',{selections:[{documentId:planId,item:'M001',lineId:'PLAN-ROW'}],progress:'완료'});
  InventoryUI.replace(out.db);return {planId,orderId,purchaseId};
 });
 const before=await page.evaluate(()=>InventoryUI.snapshot());
 await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();
 await page.getByLabel('발주서 빠른검색').fill(ids.orderId);await page.getByLabel('발주서 빠른검색').press('Enter');
 await page.locator('tbody .inv-link').click();const editor=page.getByRole('dialog',{name:'발주서 상세 / 수정',exact:true});
 await expect(editor.getByLabel('수량 1',{exact:true})).toBeDisabled();await expect(editor.getByLabel('품목 1',{exact:true})).toBeDisabled();
 await editor.getByLabel('단가 1',{exact:true}).fill('150');
 await editor.locator('.purchasing-local-state summary').click();await editor.getByLabel('전표 적요',{exact:true}).fill('완료 계획의 배분 보존');
 await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);
 await page.reload();const after=await page.evaluate(()=>InventoryUI.snapshot());
 const order=after.documents.find(d=>d.id===ids.orderId),old=before.documents.find(d=>d.id===ids.orderId);
 expect(order.lines[0].qty).toBe(2);expect(order.lines[0].price).toBe(150);expect(order.lines[0].planAllocations).toEqual(old.lines[0].planAllocations);
 expect(order.memo).toBe('완료 계획의 배분 보존');expect(after.documents.filter(d=>d.id!==ids.orderId)).toEqual(before.documents.filter(d=>d.id!==ids.orderId));expect(after.settings).toEqual(before.settings);
 const balances=await page.evaluate(({planId,orderId})=>{const C=InventoryCore,db=InventoryUI.snapshot();return {plan:C.remaining(db,db.documents.find(d=>d.id===planId),'purchaseorder')[0].qty,order:C.remaining(db,db.documents.find(d=>d.id===orderId),'purchase')[0].qty,stock:C.stock(db,'M001','W001'),payable:C.outstanding(db,'payable','V001')};},ids);
 expect(balances).toEqual({plan:8,order:1,stock:1,payable:110});
 await page.locator('#routes').getByRole('button',{name:'발주서조회',exact:true}).click();await page.locator('tbody .inv-link').click();
 await page.getByLabel('수량 1',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.artifacts/manual-plan-allocation-20261021/grouped-order-preserved.png',fullPage:true});
});
