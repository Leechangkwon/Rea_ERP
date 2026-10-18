const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../dist/inventory-core.js'),I=require('../dist/item-core.js');
const {createGateway}=require('../worker/gateway.cjs'),{sqliteD1}=require('../scripts/sqlite-d1.cjs');
test('item batch is atomic on invalid second row and rejects missing updates',()=>{
 const db=C.seed(),before=JSON.stringify(db);assert.throws(()=>C.command(db,'itemBatch',{records:[{record:{code:'NEW1',name:'성공 후보'}},{record:{code:'NEW2',name:'오류',extraQtyDenominator:0}}]}));assert.equal(JSON.stringify(db),before);
 assert.throws(()=>C.command(db,'itemBatch',{records:[{record:{code:'NEW1',name:'누락'},originalCode:'NEW1'}]}),/수정할/);
 assert.throws(()=>C.command(db,'itemBatch',{records:[{record:{code:'NEW1',name:'하나'}},{record:{code:'NEW1',name:'중복'}}]}),/중복/);
});
test('item configuration, extra fields and creation date survive validated backup',()=>{
 let db=C.command(C.seed(),'itemConfig',{config:{features:{sortBy:'name',sortDirection:'desc'}}}).db;
 db=C.command(db,'master',{key:'items',record:{code:'NEW',name:'신규',barcode:'123',hierarchyGroups:['분류'],group2:'중',priceB:300,standardLaborCost:50,serialLotMode:'required',relatedItems:['P001']}}).db;
 const saved=C.master(db,'items','NEW');assert.ok(saved.createdAt);assert.equal(saved.standardLaborCost,50);assert.equal(saved.serialLotMode,'required');
 const restored=C.validateBackup(JSON.parse(JSON.stringify(db)));assert.equal(restored.settings.itemRegistration.features.sortDirection,'desc');assert.deepEqual(C.master(restored,'items','NEW'),saved);
 const changed=C.command(db,'master',{key:'items',originalCode:'NEW',record:{...saved,name:'수정',createdAt:'invalid'}});assert.equal(changed.result.createdAt,saved.createdAt);
});
test('item configuration invalid values never replace existing settings',()=>{
 const db=C.seed();assert.throws(()=>C.command(db,'itemConfig',{config:{fields:[{id:'code',visible:false}]}}));assert.equal(db.settings.itemRegistration,undefined);
 const bad=C.seed();bad.settings.itemRegistration={features:{sortBy:'malformed'}};assert.throws(()=>C.validateBackup(bad));
});
test('VAT inclusive item price conversion respects special-price precedence and selected VAT',()=>{
 const db=C.seed(),i=C.master(db,'items','P001');i.buyPrice=110;i.buyVatIncluded=true;i.sellPrice=120;i.sellVatIncluded=true;db.settings.priceOrder=['품목단가','특별단가'];assert.equal(C.priceFor(db,'P001','',true,10),100);assert.equal(C.priceFor(db,'P001','',false,20),100);
 i.buyPrice=105;i.purchaseVatRate=5;assert.equal(C.priceFor(db,'P001','',true),100);
 db.settings.priceOrder=['특별단가','품목단가'];db.prices=[{item:'P001',partner:'C001',buy:true,price:77}];assert.equal(C.priceFor(db,'P001','C001',true,10),77);
});
test('code changes update expanded references and item defaults atomically',()=>{
 let db=C.seed();const item=C.master(db,'items','P001');Object.assign(item,{relatedPartner:'V001',productionProcess:'OP01',warehouseSafety:[{warehouse:'W001',qty:8}],relatedItems:['M001']});
 db=C.command(db,'itemConfig',{config:{features:{supplier:'V001'},fields:[{id:'supplier',defaultValue:'V001'},{id:'relatedPartner',defaultValue:'V001'},{id:'productionProcess',defaultValue:'OP01'},{id:'warehouseSafety',defaultValue:[{warehouse:'W001',qty:5}]}]}}).db;
 for(const [key,from,to]of [['partners','V001','V002'],['warehouses','W001','W003'],['processes','OP01','OP02'],['items','M001','M002']])db=C.command(db,'rename',{key,from,to}).db;
 const saved=C.master(db,'items','P001');assert.equal(saved.relatedPartner,'V002');assert.equal(saved.productionProcess,'OP02');assert.equal(saved.warehouseSafety[0].warehouse,'W003');assert.deepEqual(saved.relatedItems,['M002']);assert.equal(db.settings.itemRegistration.features.supplier,'V002');assert.equal(db.settings.itemRegistration.fields.find(f=>f.id==='supplier').defaultValue,'V002');assert.doesNotThrow(()=>C.validateBackup(db));
});
test('non-stock item sales affect money, not inventory; historical tracking cannot silently change',()=>{
 let db=C.command(C.seed(),'master',{key:'items',record:{code:'SERVICE',name:'가상 서비스',trackInventory:false,sellPrice:100}}).db;
 const out=C.command(db,'document',{type:'sale',date:C.today(),warehouse:'W001',partner:'C001',vatRate:10,lines:[{item:'SERVICE',qty:10,price:100}]});assert.equal(out.result.lines[0].total,1100);assert.equal(C.stock(out.db,'SERVICE','W001'),0);assert.ok(!C.movements(out.db).some(x=>x.item==='SERVICE'));
 assert.throws(()=>C.command(db,'master',{key:'items',originalCode:'P001',record:{...C.master(db,'items','P001'),trackInventory:false}}),/재고 이력/);
});
test('relations reject missing/self references and compact defaults preserve storage capacity',()=>{
 const db=C.seed();assert.throws(()=>C.command(db,'master',{key:'items',record:{code:'NEW',name:'관계',relatedItems:['MISSING']}}),/관계/);
 assert.throws(()=>C.command(db,'master',{key:'items',originalCode:'P001',record:{...C.master(db,'items','P001'),relatedItems:['P001']}}),/관계/);
 const compact=I.compact({code:'NEW',name:'기본'});assert.ok(JSON.stringify(compact).length<600);assert.equal(I.normalize(compact).trackInventory,true);
});
test('server item API accepts expanded metadata, validates it and documents the same fields',async()=>{
 const DB=sqliteD1(),handler=createGateway(),principal={user:{id:'fixture'},permissions:['*']};
 const post=body=>handler(new Request('https://erp.test/api/v1/items',{method:'POST',headers:{'content-type':'application/json','origin':'https://erp.test','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)}),{DB},principal);
 try{let r=await post({code:'API1',name:'가상 API 품목',barcode:'ABC123',priceB:100,priceBVatIncluded:true,standardMaterialCost:50,hierarchyGroups:['대분류'],trackInventory:false});assert.equal(r.status,200);const saved=(await r.json()).data;assert.equal(saved.priceB,100);assert.equal(saved.priceBVatIncluded,true);assert.equal(saved.trackInventory,false);
 r=await post({code:'API2',name:'유효성',extraQtyDenominator:0});assert.equal(r.status,400);
 const M=require('../dist/api-manual-data.js');const fields=M.endpoints.find(e=>e.path==='/api/v1/items'&&e.method==='POST').request;for(const f of I.defaultFields)assert.ok(fields.some(x=>x.name===f.id),f.id);
 }finally{DB.close();}
});
