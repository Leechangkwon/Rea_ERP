const {test,expect}=require('@playwright/test');
test('confirmed vendor price imports into a saved order, survives reload and feeds a partial receipt',async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{const C=InventoryCore;const db=C.empty();db.masters=C.clone(C.seed().masters);db.masters.partners.push({code:'V002',name:'확정 구매처',kind:'매입'});InventoryUI.replace(db);});
 await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
 const editor=page.locator('#inventory-dialog');await editor.getByLabel('거래처',{exact:true}).selectOption('V002');
 await editor.getByLabel('품목 1',{exact:true}).selectOption('M001');await editor.getByLabel('수량 1',{exact:true}).fill('100');await editor.getByLabel('단가 1',{exact:true}).fill('50000');
 await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);
 // Reply/confirmation fixture uses the same explicit business commands; all following order/receipt work uses real UI.
 const request=await page.evaluate(()=>{const C=InventoryCore;let db=InventoryUI.snapshot(),doc=db.documents.find(d=>d.type==='pricerequest');const row=PriceRequestCore.view(db,doc.id,C).rows[0];db=C.command(db,'priceRequest',{action:'reply',documentId:doc.id,expectedRevision:0,vendorCode:'V002',lineKey:row.lineKey,price:'25000'}).db;InventoryUI.replace(db);return doc;});
 await page.reload();await page.getByRole('button',{name:'단가요청조회',exact:true}).click();await page.getByRole('button',{name:'단가요청비교현황',exact:true}).click();
 const comparison=page.getByRole('dialog',{name:'단가요청비교현황',exact:true});await comparison.getByRole('button',{name:'확정단가선택/수정',exact:true}).click();await comparison.getByLabel('1행 V002 수취단가 선택',{exact:true}).check();await comparison.getByRole('button',{name:'단가확정/저장(F8)',exact:true}).click();await comparison.getByRole('button',{name:'닫기',exact:true}).click();
 const before=await page.evaluate(()=>InventoryUI.snapshot());
 await page.getByRole('button',{name:'발주서조회',exact:true}).click();await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
 await expect(editor.getByLabel('거래처',{exact:true})).toHaveValue('');
 await editor.getByRole('button',{name:'단가요청',exact:true}).click();const picker=page.locator('#entry-helper-dialog'),key=request.id+'|'+(request.lines[0].lineId||'M001');
 await picker.getByLabel('원본 거래처',{exact:true}).selectOption('V002');await expect(picker.locator('tbody')).toContainText('25,000');
 await picker.getByLabel('행 선택 '+key,{exact:true}).check();await picker.getByLabel('불러올 수량 '+key,{exact:true}).fill('40');
 await picker.getByRole('button',{name:'선택 적용',exact:true}).click();await expect(picker).toHaveCount(0);
 await expect(editor.getByLabel('거래처',{exact:true})).toHaveValue('V002');await expect(editor.getByLabel('단가 1',{exact:true})).toHaveValue('25000');expect((await page.evaluate(()=>InventoryUI.snapshot())).documents).toEqual(before.documents);
 await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);await page.reload();
 const order=await page.evaluate(()=>InventoryUI.snapshot().documents.find(d=>d.type==='purchaseorder'));expect(order.lines[0].price).toBe(25000);expect(order.lines[0].qty).toBe(40);expect(order.lines[0].priceRequestBasis.price).toBe('25000');expect(order.sourceId).toBe(request.id);
 await page.getByRole('button',{name:'구매조회',exact:true}).click();await page.getByRole('button',{name:'신규(F2)',exact:true}).click();await editor.getByLabel('거래처',{exact:true}).selectOption('V002');await editor.getByRole('button',{name:'발주',exact:true}).click();
 const orderKey=order.id+'|'+(order.lines[0].lineId||'M001');await picker.getByLabel('행 선택 '+orderKey,{exact:true}).check();await picker.getByLabel('불러올 수량 '+orderKey,{exact:true}).fill('10');await picker.getByRole('button',{name:'선택 적용',exact:true}).click();await expect(picker).toHaveCount(0);await expect(editor.getByLabel('단가 1',{exact:true})).toHaveValue('25000');await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);await page.reload();
 const after=await page.evaluate(()=>InventoryUI.snapshot());expect(after.settings).toEqual(before.settings);expect(after.documents.find(d=>d.id===request.id)).toEqual(request);expect(after.documents.find(d=>d.id===order.id)).toEqual(order);
 const result=await page.evaluate(({requestId,orderId})=>{const C=InventoryCore,db=C.validateBackup(InventoryUI.snapshot());return {request:C.remaining(db,db.documents.find(d=>d.id===requestId),'purchaseorder')[0].qty,order:C.remaining(db,db.documents.find(d=>d.id===orderId),'purchase')[0].qty,stock:C.stock(db,'M001','W001'),payable:C.outstanding(db,'payable','V002')};},{requestId:request.id,orderId:order.id});expect(result).toEqual({request:60,order:30,stock:10,payable:275000});
 await page.getByRole('button',{name:'발주서조회',exact:true}).click();await page.locator('tbody .inv-link').click();await expect(editor.getByLabel('단가 1',{exact:true})).toHaveValue('25000');await expect(editor.getByLabel('수량 1',{exact:true})).toHaveValue('40');await editor.getByLabel('단가 1',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'.artifacts/manual-price-order-flow-20261021/synthetic-saved-order.png',fullPage:true});
});
