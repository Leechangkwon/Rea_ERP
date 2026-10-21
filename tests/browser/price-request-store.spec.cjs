const {test,expect}=require('@playwright/test');
test('first confirmation defaults request price, cancels without writing, then saves a chosen supplier and reloads',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{
  const C=InventoryCore;let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));
  const out=C.command(db,'priceRequestCreate',{document:{type:'pricerequest',date:C.today(),warehouse:'W001',partner:'',status:'진행',lines:[{lineId:'a',item:'M001',qty:100,price:50000},{lineId:'b',item:'M001',qty:1,price:0}]},vendorCodes:['V001']});
  db=C.command(out.db,'priceRequest',{action:'reply',documentId:out.result.id,expectedRevision:0,vendorCode:'V001',lineKey:'id:a',price:'25000.123456789'}).db;
  localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));
 });
 await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();const dialog=page.getByRole('dialog',{name:'단가요청비교현황',exact:true});
 await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();
 await expect(dialog.getByLabel('1행 요청단가 선택',{exact:true})).toBeChecked();await expect(dialog.getByLabel('2행 요청단가 선택',{exact:true})).toBeChecked();
 expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.screenshot({path:'.artifacts/price-default-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(el=>el.getBoundingClientRect().width<=innerWidth)).toBe(true);await page.screenshot({path:'.artifacts/price-default-mobile.png',fullPage:true});
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();
 await dialog.getByLabel('1행 V001 수취단가 선택',{exact:true}).check();await dialog.getByRole('button',{name:'단가확정/저장(F8)',exact:true}).click();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2'))),old=JSON.parse(before),state=after.settings.priceRequests.records[0].comparison;
 expect(state.selections.map(row=>row.price)).toEqual(['25000.123456789','0']);expect(state.revision).toBe(2);expect(after.documents).toEqual(old.documents);expect(after.prices).toEqual(old.prices);expect(after.settings.customization).toEqual(old.settings.customization);expect(state.vendors).toEqual(old.settings.priceRequests.records[0].comparison.vendors);
 await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();await expect(dialog.getByLabel('1행 V001 수취단가 선택',{exact:true})).toBeChecked();await expect(dialog.getByLabel('2행 요청단가 선택',{exact:true})).toBeChecked();await expect(dialog.getByRole('button',{name:'단가확정/저장(F8)',exact:true})).toBeDisabled();
});
test('new request chooses two suppliers, saves once and opens a ready comparison after reload',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));db=InventoryCore.command(db,'master',{key:'partners',record:{code:'V002',name:'다른 요청 거래처',kind:'매입'}}).db;localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));});
 await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
 const entry=page.getByRole('dialog',{name:'단가요청 신규',exact:true});await expect(entry).toBeVisible();
 await entry.getByRole('button',{name:'거래처 다중 선택',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'거래처 다중 선택',exact:true});
 await picker.getByLabel('거래처 V001 선택',{exact:true}).check();await picker.getByLabel('거래처 V002 선택',{exact:true}).check();
 await picker.getByRole('button',{name:'적용(F8)',exact:true}).click();await expect(picker).toHaveCount(0);
 await entry.getByLabel('품목 1',{exact:true}).selectOption('M001');await entry.getByLabel('수량 1',{exact:true}).fill('100');await entry.getByLabel('단가 1',{exact:true}).fill('50000');
 expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.screenshot({path:'.artifacts/price-start-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await entry.evaluate(el=>el.getBoundingClientRect().width<=innerWidth)).toBe(true);await entry.getByLabel('거래처',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.artifacts/price-start-mobile.png',fullPage:true});
 await entry.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(entry).toHaveCount(0);
 const saved=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2')),old=JSON.parse(before),now=JSON.parse(saved),source=now.documents.at(-1),record=now.settings.priceRequests.records[0];
 expect(now.documents.slice(0,-1)).toEqual(old.documents);expect(now.documents.length).toBe(old.documents.length+1);expect(now.settings.customization).toEqual(old.settings.customization);expect(now.prices).toEqual(old.prices);expect(record.snapshot).toEqual(source);expect(record.comparison.vendors.map(v=>v.code)).toEqual(['V001','V002']);expect(record.comparison.vendors.every(v=>v.received.every(r=>r.price===null))).toBe(true);
 await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 const compare=page.getByRole('dialog',{name:'단가요청비교현황',exact:true});await expect(compare.getByRole('button',{name:'V001 샘플 구매처 수취단가 직접입력',exact:true})).toBeEnabled();await expect(compare.getByRole('button',{name:'V002 다른 요청 거래처 수취단가 직접입력',exact:true})).toBeEnabled();
 await compare.getByRole('button',{name:'V001 샘플 구매처 수취단가 직접입력',exact:true}).click();const reply=page.getByRole('dialog',{name:'수취단가 직접입력',exact:true});await reply.getByLabel('1행 V001 수취단가',{exact:true}).fill('0');await reply.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(compare).toBeVisible();
 const updated=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));expect(updated.documents).toEqual(now.documents);expect(updated.settings.priceRequests.records[0].comparison.vendors[0].received[0].price).toBe('0');expect(updated.settings.priceRequests.records[0].comparison.vendors[1].received[0].price).toBeNull();
});
test('direct received prices stage, save once and reload without changing original vouchers or forms',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{
  const C=InventoryCore;let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));
  db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'다른 비교 거래처',kind:'매입'}}).db;
  const out=C.command(db,'document',{type:'pricerequest',date:C.today(),warehouse:'W001',partner:'V001',status:'진행',lines:[{lineId:'a',item:'M001',qty:100,price:50000},{lineId:'b',item:'M001',qty:2,price:1},{lineId:'c',item:'M001',qty:3,price:5}]});db=out.db;
  db=C.command(db,'priceRequest',{action:'start',documentId:out.result.id,vendorCodes:['V001','V002']}).db;
  localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));
 });
 await page.reload();await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 const compare=page.getByRole('dialog',{name:'단가요청비교현황',exact:true}),reply=page.getByRole('dialog',{name:'수취단가 직접입력',exact:true});
 await compare.getByRole('button',{name:'V001 샘플 구매처 수취단가 직접입력',exact:true}).click();
 await reply.getByLabel('1행 V001 수취단가',{exact:true}).fill('0');await reply.getByLabel('2행 V001 수취단가',{exact:true}).fill('25000.0123456789');
 expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.screenshot({path:'.artifacts/price-reply-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await reply.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth)).toBe(true);
 await reply.getByLabel('2행 V001 수취단가',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.artifacts/price-reply-mobile.png',fullPage:true});
 await page.keyboard.press('F8');await expect(compare).toBeVisible();
 const saved=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2')),old=JSON.parse(before),now=JSON.parse(saved),state=now.settings.priceRequests.records[0].comparison;
 expect(state.vendors[0].received.map(r=>r.price)).toEqual(['0','25000.0123456789',null]);expect(state.vendors[1]).toEqual(old.settings.priceRequests.records[0].comparison.vendors[1]);expect(state.revision).toBe(1);expect(now.sequence).toBe(old.sequence+1);expect(now.documents).toEqual(old.documents);expect(now.prices).toEqual(old.prices);expect(now.settings.customization).toEqual(old.settings.customization);
 await compare.getByRole('button',{name:'닫기',exact:true}).click();await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 await compare.getByRole('button',{name:'V001 샘플 구매처 수취단가 직접입력',exact:true}).click();await expect(reply.getByLabel('2행 V001 수취단가',{exact:true})).toHaveValue('25000.0123456789');await expect(reply.getByLabel('3행 V001 수취단가',{exact:true})).toHaveValue('');
 await reply.getByLabel('2행 V001 수취단가',{exact:true}).fill('123');await page.keyboard.press('Escape');await expect(compare).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(saved);
});
test('shared price comparison core persists a synthetic backup across reload and retains replies after source edit',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 const prepared=await page.evaluate(()=>{
  const C=InventoryCore,Q=PriceRequestCore,base=JSON.parse(localStorage.getItem('ecount-inventory-v2'));
  let out=C.command(base,'document',{type:'pricerequest',date:'2026-10-21',partner:'V001',warehouse:'W001',status:'진행',vatRate:10,lines:[{item:'M001',qty:100,price:50000,lineId:'quote-row'}]});
  let db=out.db;const id=out.result.id,source=JSON.stringify(db.documents),forms=JSON.stringify(db.settings.customization),prices=JSON.stringify(db.prices);
  db=C.command(db,'priceRequest',{action:'start',documentId:id,vendorCodes:['V001']}).db;
  db=C.command(db,'priceRequest',{action:'reply',documentId:id,expectedRevision:0,vendorCode:'V001',lineKey:'id:quote-row',price:'25000.0123456789'}).db;
  db=C.command(db,'priceRequest',{action:'select',documentId:id,expectedRevision:1,vendorCode:'V001',lineKey:'id:quote-row',source:'vendor'}).db;
  const preserved=source===JSON.stringify(db.documents)&&forms===JSON.stringify(db.settings.customization)&&prices===JSON.stringify(db.prices);
  localStorage.setItem('ecount-inventory-v2',JSON.stringify(C.validateBackup(db)));
  return {id,preserved,view:Q.view(db,id,C)};
 });
 expect(prepared.preserved).toBe(true);expect(prepared.view.status).toBe('ready');expect(prepared.view.rows[0].confirmed.price).toBe('25000.0123456789');
 await page.reload();await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 const restored=await page.evaluate(id=>{
  const C=InventoryCore,Q=PriceRequestCore;let db=C.validateBackup(JSON.parse(localStorage.getItem('ecount-inventory-v2')));
  const before=Q.view(db,id,C),store=JSON.stringify(db.settings.priceRequests),doc=db.documents.find(d=>d.id===id);
  db=C.command(db,'document',{...doc,memo:'Updated after quote'}).db;
  let rejected=false;try{C.command(db,'priceRequest',{action:'close',documentId:id,expectedRevision:2,vendorCode:'V001',closed:true});}catch{rejected=true;}
  const reimported=C.validateBackup(JSON.parse(JSON.stringify(db)));
  return {before,status:Q.view(reimported,id,C).status,rejected,preserved:JSON.stringify(reimported.settings.priceRequests)===store,price:Q.view(reimported,id,C).rows[0].confirmed.price};
 },prepared.id);
 expect(restored.before).toEqual(prepared.view);expect(restored.status).toBe('source-changed');expect(restored.rejected).toBe(true);expect(restored.preserved).toBe(true);expect(restored.price).toBe('25000.0123456789');
});

test('quote comparison list view preserves exact prices, remains read-only and fits a narrow screen',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{
  const C=InventoryCore;let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));
  for(let i=2;i<=5;i++)db=C.command(db,'master',{key:'partners',record:{code:'V00'+i,name:'비교 공급처 '+i,kind:'매입'}}).db;
  const out=C.command(db,'document',{type:'pricerequest',date:C.today(),warehouse:'W001',partner:'V001',status:'진행',lines:[{item:'M001',qty:100,price:50000}]});db=out.db;const documentId=out.result.id;
  db=C.command(db,'priceRequest',{action:'start',documentId,vendorCodes:['V001','V002','V003','V004','V005']}).db;
  db=C.command(db,'priceRequest',{action:'reply',documentId,expectedRevision:0,vendorCode:'V001',lineKey:'row:0',price:0}).db;
  db=C.command(db,'priceRequest',{action:'reply',documentId,expectedRevision:1,vendorCode:'V002',lineKey:'row:0',price:'25000.0123456789'}).db;
  db=C.command(db,'priceRequest',{action:'select',documentId,expectedRevision:2,vendorCode:'V002',lineKey:'row:0',source:'vendor'}).db;
  localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));
 });
 await page.reload();await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{AuthUI.can=p=>p==='inventory.read';});
 await page.getByRole('button',{name:'단가요청조회',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await expect(page.getByRole('button',{name:'신규(F2)',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'단가요청비교현황',exact:true});await expect(dialog).toBeVisible();
 const cells=await dialog.locator('tbody tr').first().locator('td').allTextContents();expect(cells.slice(3)).toEqual(['100','50,000','0','25,000.0123456789','미회신','미회신','미회신','25,000.0123456789','V002']);
 await expect(dialog.locator('input,select,textarea')).toHaveCount(0);
 await page.screenshot({path:'.artifacts/price-comparison-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await dialog.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth)).toBe(true);
 expect(await dialog.getByLabel('단가 비교표 가로 스크롤').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.screenshot({path:'.artifacts/price-comparison-mobile.png',fullPage:true});
 await dialog.getByLabel('단가 비교표 가로 스크롤').evaluate(el=>{el.scrollLeft=el.scrollWidth;});
 const confirmed=dialog.locator('tbody tr').first().locator('td').nth(10);await expect(confirmed).toBeInViewport();await expect(confirmed).toHaveText('25,000.0123456789');
 await page.screenshot({path:'.artifacts/price-comparison-mobile-scrolled.png',fullPage:true});
 expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 await page.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('ecount-inventory-v2'));raw.settings.allowNegative=!raw.settings.allowNegative;localStorage.setItem('ecount-inventory-v2',JSON.stringify(raw));window.dispatchEvent(new StorageEvent('storage',{key:'ecount-inventory-v2'}));});
 await expect(dialog.getByRole('alert')).toContainText('다른 화면');await expect(dialog.locator('table')).toHaveCount(0);
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();await expect(dialog).toHaveCount(0);
});


test('confirmed price radios replace default choices only on explicit save and persist across reload',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 const id=await page.evaluate(()=>{
  const C=InventoryCore;let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));
  db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'정밀단가 공급처',kind:'매입'}}).db;
  const out=C.command(db,'document',{type:'pricerequest',date:C.today(),warehouse:'W001',partner:'V001',status:'진행',lines:[{lineId:'a',item:'M001',qty:100,price:50000},{lineId:'b',item:'M001',qty:2,price:1}]});db=out.db;const documentId=out.result.id;
  db=C.command(db,'priceRequest',{action:'start',documentId,vendorCodes:['V001','V002']}).db;
  db=C.command(db,'priceRequest',{action:'reply',documentId,expectedRevision:0,vendorCode:'V001',lineKey:'id:a',price:0}).db;
  db=C.command(db,'priceRequest',{action:'reply',documentId,expectedRevision:1,vendorCode:'V002',lineKey:'id:b',price:'1.9999999999'}).db;
  localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));return documentId;
 });
 await page.reload();await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();
 const before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();const dialog=page.getByRole('dialog',{name:'단가요청비교현황',exact:true});
 await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();await expect(dialog.getByLabel('1행 요청단가 선택',{exact:true})).toBeChecked();await expect(dialog.getByLabel('2행 요청단가 선택',{exact:true})).toBeChecked();expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await dialog.getByRole('radio',{name:'1행 V001 수취단가 선택',exact:true}).check();await expect(dialog.getByRole('radio',{name:'1행 V002 수취단가 선택',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(before);
 await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();
 await dialog.getByRole('radio',{name:'1행 V001 수취단가 선택',exact:true}).check();await dialog.getByRole('radio',{name:'2행 V002 수취단가 선택',exact:true}).check();
 await page.screenshot({path:'.artifacts/price-selection-before-save.png',fullPage:true});
 await page.keyboard.press('F8');await expect(dialog.locator('input')).toHaveCount(0);await expect(dialog.locator('tbody tr').nth(1).locator('td').nth(7)).toHaveText('1.9999999999');
 await page.screenshot({path:'.artifacts/price-selection-saved.png',fullPage:true});
 const saved=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2')),old=JSON.parse(before),now=JSON.parse(saved);
 expect(now.documents).toEqual(old.documents);expect(now.prices).toEqual(old.prices);expect(now.settings.customization).toEqual(old.settings.customization);expect(now.sequence).toBe(old.sequence+1);expect(now.settings.priceRequests.records[0].comparison.revision).toBe(3);
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 await expect(dialog.locator('tbody tr').first().locator('td').nth(7)).toHaveText('0');await expect(dialog.locator('tbody tr').nth(1).locator('td').nth(7)).toHaveText('1.9999999999');
 expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(saved);
 await dialog.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();await dialog.getByRole('radio',{name:'1행 요청단가 선택',exact:true}).check();
 const changed=await page.evaluate(id=>{const db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));db.documents.find(d=>d.id===id).memo='concurrent update';const raw=JSON.stringify(db);localStorage.setItem('ecount-inventory-v2',raw);return raw;},id);
 await dialog.getByRole('button',{name:'단가확정/저장(F8)',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('다른 화면');expect(await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'))).toBe(changed);
});


test('vendor input close and reopen survive reload without changing prices or saved vouchers',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{const C=InventoryCore;let db=JSON.parse(localStorage.getItem('ecount-inventory-v2'));db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'합성 공급처',kind:'매입'}}).db;const out=C.command(db,'document',{type:'pricerequest',date:C.today(),warehouse:'W001',partner:'V001',status:'진행',lines:[{item:'M001',qty:100,price:50000}]});db=out.db;const documentId=out.result.id;db=C.command(db,'priceRequest',{action:'start',documentId,vendorCodes:['V001','V002']}).db;db=C.command(db,'priceRequest',{action:'reply',documentId,expectedRevision:0,vendorCode:'V002',lineKey:'row:0',price:'25000.0123456789'}).db;db=C.command(db,'priceRequest',{action:'select',documentId,expectedRevision:1,vendorCode:'V002',lineKey:'row:0',source:'vendor'}).db;localStorage.setItem('ecount-inventory-v2',JSON.stringify(db));});
 await page.reload();await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();const dialog=page.getByRole('dialog',{name:'단가요청비교현황',exact:true}),before=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2'));
 await dialog.getByRole('button',{name:'V002 합성 공급처 입력마감',exact:true}).click();await expect(dialog.getByRole('button',{name:'V002 합성 공급처 입력마감취소',exact:true})).toBeFocused();await expect(dialog.locator('tbody tr td').nth(7)).toHaveText('25,000.0123456789');
 const saved=await page.evaluate(()=>localStorage.getItem('ecount-inventory-v2')),a=JSON.parse(before),b=JSON.parse(saved);expect(b.documents).toEqual(a.documents);expect(b.prices).toEqual(a.prices);expect(b.settings.customization).toEqual(a.settings.customization);expect(b.settings.priceRequests.records[0].comparison.selections).toEqual(a.settings.priceRequests.records[0].comparison.selections);expect(b.settings.priceRequests.records[0].comparison.vendors[1].received).toEqual(a.settings.priceRequests.records[0].comparison.vendors[1].received);expect(b.settings.priceRequests.records[0].comparison.vendors[0]).toEqual(a.settings.priceRequests.records[0].comparison.vendors[0]);expect(b.settings.priceRequests.records[0].comparison.revision).toBe(3);
 await page.screenshot({path:'.artifacts/price-input-closed-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth)).toBe(true);await dialog.getByRole('button',{name:'V002 합성 공급처 입력마감취소',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.artifacts/price-input-closed-mobile.png',fullPage:true});
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();await dialog.getByRole('button',{name:'V002 합성 공급처 입력마감취소',exact:true}).click();const reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecount-inventory-v2')));expect(reopened.settings.priceRequests.records[0].comparison.vendors).toEqual(a.settings.priceRequests.records[0].comparison.vendors);expect(reopened.settings.priceRequests.records[0].comparison.selections).toEqual(a.settings.priceRequests.records[0].comparison.selections);expect(reopened.settings.priceRequests.records[0].comparison.revision).toBe(4);await expect(dialog.getByRole('button',{name:'V002 합성 공급처 입력마감',exact:true})).toBeVisible();
});
