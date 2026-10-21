const {test,expect}=require('@playwright/test');
test('saved credit returns print through the existing purchase form with exact allocated tax and preserve records after close/reload',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4179'?r.continue():r.abort());
 await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
 await page.evaluate(()=>{
  let db=InventoryCore.empty();db.masters=InventoryCore.clone(InventoryCore.seed().masters);
  let result=InventoryCore.command(db,'document',{type:'purchase',date:'2026-10-21',partner:'V001',warehouse:'W001',vatRate:10,lines:[{item:'M001',qty:3,price:5,custom:{x_lot:'LOT-A',tax:999}}],memo:'원구매 보존'});db=result.db;const source=result.result.id;
  for(const qty of [1,2])db=InventoryCore.command(db,'convert',{id:source,type:'purchasereturn',date:'2026-10-22',settlementMode:'credit',quantities:{M001:qty}}).db;
  db=InventoryCore.command(db,'formSave',{key:'doc:purchase',context:'print',form:{id:'saved',name:'기존 구매 양식',fields:[FormCore.field('tax','세액','number'),FormCore.field('qty','반품량','number'),FormCore.field('total','환산액','number'),FormCore.field('x_double','검토금액','number',{custom:true,formula:'total*2'}),FormCore.field('x_lot','제조번호','text',{custom:true})],page:{...FormCore.pageDefaults,title:'반품 내역 확인',company:'가상 회사',orientation:'landscape',footer:'기존 양식 보존'}}}).db;
  const settings=AuthUI.settings();settings.conveniences.numberDecimals=0;settings.commonDefaults.amountDigits=2;settings.commonDefaults.trailingZeros=false;localStorage.setItem('synthetic-self-settings',JSON.stringify(settings));
  InventoryUI.replace(db);
 });
 const baseline=await page.evaluate(()=>InventoryUI.snapshot()),returns=baseline.documents.filter(d=>d.type==='purchasereturn');
 await page.reload();await page.evaluate(()=>{window.syntheticPrintCount=0;window.print=()=>window.syntheticPrintCount++;});
 await page.getByRole('button',{name:'구매조회',exact:true}).click();const print=page.locator('#inventory-dialog');
 for(let i=0;i<returns.length;i++){
  const doc=returns[i];await page.getByLabel('전표 선택 '+doc.id,{exact:true}).check();
  await page.locator('#target').getByRole('button',{name:'인쇄',exact:true}).filter({visible:true}).all().then(async buttons=>{const enabled=[];for(const b of buttons)if(await b.isEnabled())enabled.push(b);expect(enabled).toHaveLength(1);await enabled[0].click();});
  await expect(print).toBeVisible();await expect(print.getByRole('heading',{name:'반품 내역 확인',exact:true})).toBeVisible();await expect(print.locator('.inv-print-sheet')).toHaveAttribute('data-orientation','landscape');await expect(print).toContainText('일반 구매 출력에도 적용');await expect(print).toContainText('기존 양식 보존');
  const cells=await print.locator('tbody tr').first().locator('td').allTextContents();expect(cells.slice(0,5)).toEqual(i===0?['-0.67','-1','-5.67','-11.34','LOT-A']:['-1.33','-2','-11.33','-22.66','LOT-A']);
  await expect(print.getByRole('heading',{name:'합계 '+(i===0?'-5.67':'-11.33')+' 원',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.syntheticPrintCount)).toBe(i);
  await print.getByRole('button',{name:'인쇄',exact:true}).click();expect(await page.evaluate(()=>window.syntheticPrintCount)).toBe(i+1);
  if(i===0)await page.screenshot({path:'.artifacts/manual-return-print-20261022/synthetic-saved-return-print.png',fullPage:true});
  await print.getByRole('button',{name:'×',exact:true}).click();await expect(print).toHaveCount(0);expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(baseline);await page.getByLabel('전표 선택 '+doc.id,{exact:true}).uncheck();
 }
 await page.reload();expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(baseline);expect(await page.evaluate(()=>{const d=InventoryUI.snapshot();return[InventoryCore.stock(d,'M001','W001'),InventoryCore.outstanding(d,'payable','V001')];})).toEqual([0,0]);
});
