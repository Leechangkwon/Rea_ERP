const {test,expect}=require('@playwright/test');
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
