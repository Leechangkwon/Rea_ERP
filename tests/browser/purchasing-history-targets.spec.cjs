'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs');
for(const [type,label,historyLabel] of [['pricerequest','단가요청','단가요청'],['purchaseorder','발주서','발주']]){
  test(label+' history preserves recipients and distinct copied prices through cancel, save and reload',async({page})=>{
    await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4179'?route.continue():route.abort());
    await page.goto('/');await expect(page.getByLabel('발주요청 빠른검색')).toBeVisible();
    await page.evaluate(()=>{
      const C=InventoryCore;let db=C.empty();db.masters=C.clone(C.seed().masters);
      db=C.command(db,'master',{key:'partners',record:{code:'V002',name:'다른 구매처',kind:'매입'}}).db;
      const source=C.command(db,'priceRequestCreate',{document:{type:'pricerequest',date:'2026-10-21',warehouse:'W001',lines:[{lineId:'REQ',item:'M001',qty:2,price:90,memo:'요청가격',custom:{lot:'REQ'}}]},vendorCodes:['V001','V002']});db=source.db;
      db=C.command(db,'priceRequest',{action:'reply',documentId:source.result.id,expectedRevision:0,vendorCode:'V002',lineKey:'id:REQ',price:'80'}).db;
      db=C.command(db,'priceRequest',{action:'select',documentId:source.result.id,expectedRevision:1,source:'vendor',vendorCode:'V002',lineKey:'id:REQ'}).db;
      db=C.command(db,'convert',{id:source.result.id,type:'purchaseorder',date:'2026-10-21',quantities:{REQ:1}}).db;
      db=C.command(db,'document',{type:'purchase',date:'2026-10-21',warehouse:'W001',partner:'V001',lines:[{lineId:'HIS',item:'M001',qty:2,price:200,memo:'구매가격',custom:{lot:'HIS'}}]}).db;
      db=C.command(db,'document',{type:'quote',date:'2026-10-21',warehouse:'W001',partner:'C001',lines:[{item:'M001',qty:1,price:500}]}).db;
      InventoryUI.replace(db);
    });
    const baseline=await page.evaluate(()=>InventoryUI.snapshot()),source=baseline.documents.find(d=>d.type==='pricerequest'),order=baseline.documents.find(d=>d.type==='purchaseorder'),purchase=baseline.documents.find(d=>d.type==='purchase');
    await page.getByRole('button',{name:label+'조회',exact:true}).click();await page.getByRole('button',{name:'신규(F2)',exact:true}).click();
    const editor=page.locator('#inventory-dialog'),picker=page.locator('#entry-helper-dialog');
    if(type==='pricerequest'){
      await editor.getByRole('button',{name:'거래처 다중 선택',exact:true}).click();const partners=page.getByRole('dialog',{name:'거래처 다중 선택',exact:true});
      await partners.getByLabel('거래처 V001 선택',{exact:true}).check();await partners.getByLabel('거래처 V002 선택',{exact:true}).check();await partners.getByRole('button',{name:'적용(F8)',exact:true}).click();
    }else await editor.getByLabel('거래처',{exact:true}).selectOption('V001');
    await editor.getByLabel('품목 1',{exact:true}).selectOption('M001');await editor.getByLabel('수량 1',{exact:true}).fill('1');await editor.getByLabel('단가 1',{exact:true}).fill('300');await editor.getByLabel('적요 1',{exact:true}).fill('기존 행');
    async function choose(){
      await editor.getByRole('button',{name:'거래내역보기('+historyLabel+')',exact:true}).click();
      await expect(picker).toHaveAttribute('aria-label','거래내역보기('+historyLabel+')');
      await expect(picker.getByLabel('집계조건',{exact:true})).toBeDisabled();await expect(picker.getByLabel('불러오기 방식',{exact:true})).toBeDisabled();await expect(picker.locator('fieldset')).toHaveCount(0);
      expect(await picker.getByLabel('원본 전표 종류',{exact:true}).locator('option').evaluateAll(xs=>xs.map(x=>x.value))).toEqual(['','pricerequest','purchaseorder','purchase']);
      await picker.getByLabel('원본 전표 종류',{exact:true}).selectOption('');
      for(const doc of [source,order,purchase])await picker.getByLabel('행 선택 '+doc.id+'|'+(doc.lines[0].lineId||doc.lines[0].item),{exact:true}).check();
    }
    await choose();await picker.getByRole('button',{name:'취소',exact:true}).click();await expect(editor.locator('.inv-entry-grid tbody tr')).toHaveCount(1);expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(baseline);
    await choose();await picker.getByRole('button',{name:'선택 적용',exact:true}).click();await expect(editor.locator('.inv-entry-grid tbody tr')).toHaveCount(4);
    for(const [i,price]of [[1,300],[2,90],[3,80],[4,200]])await expect(editor.getByLabel('단가 '+i,{exact:true})).toHaveValue(String(price));
    if(type==='purchaseorder')await expect(editor.getByLabel('거래처',{exact:true})).toHaveValue('V001');
    await editor.getByRole('button',{name:'저장(F8)',exact:true}).click();await expect(editor).toHaveCount(0);await page.reload();
    const result=await page.evaluate(ids=>{const db=InventoryUI.snapshot(),value=db.documents.find(d=>!ids.includes(d.id));return {db,value,requestRemaining:InventoryCore.remaining(db,db.documents.find(d=>d.id===ids[0]),'purchaseorder').map(l=>l.qty),orderRemaining:InventoryCore.remaining(db,db.documents.find(d=>d.type==='purchaseorder'&&ids.includes(d.id)),'purchase').map(l=>l.qty),stock:InventoryCore.stock(db,'M001','W001')};},baseline.documents.map(d=>d.id));
    expect(result.value.lines.map(l=>l.price)).toEqual([300,90,80,200]);expect(result.value.lines.every(l=>!l.sourceLineId&&!l.priceRequestBasis)).toBe(true);
    expect(result.value.lines[2].importedFrom[0].priceRequestBasisSnapshot).toEqual(order.lines[0].priceRequestBasis);
    expect(result.value.sourceId).toBeUndefined();expect(new Set(result.value.lines.map(l=>l.lineId)).size).toBe(4);
    expect(result.db.documents.slice(0,-1)).toEqual(baseline.documents);expect(result.db.settings.customization).toEqual(baseline.settings.customization);expect(result.db.settings.priceRequests.records[0]).toEqual(baseline.settings.priceRequests.records[0]);expect([result.requestRemaining,result.orderRemaining,result.stock]).toEqual([[1],[1],2]);
    if(type==='pricerequest')expect(result.db.settings.priceRequests.records.find(r=>r.documentId===result.value.id).comparison.vendors.map(v=>v.code)).toEqual(['V001','V002']);
    else expect(result.value.partner).toBe('V001');
    await page.getByRole('button',{name:label+'조회',exact:true}).click();await page.getByRole('button',{name:result.value.date+' / '+result.value.id,exact:true}).click();
    fs.mkdirSync('.artifacts/manual-history-targets-20261022',{recursive:true});
    for(const width of [1280,390]){
      await page.setViewportSize({width,height:900});await editor.getByRole('button',{name:'거래내역보기('+historyLabel+')',exact:true}).click();await picker.getByLabel('원본 전표 종류',{exact:true}).selectOption('');
      await page.screenshot({path:'.artifacts/manual-history-targets-20261022/'+type+'-'+width+'.png',fullPage:true});await picker.getByRole('button',{name:'취소',exact:true}).click();
    }
    expect(await page.evaluate(()=>InventoryUI.snapshot())).toEqual(result.db);await editor.getByRole('button',{name:'상세 창 닫기',exact:true}).click();
  });
}
