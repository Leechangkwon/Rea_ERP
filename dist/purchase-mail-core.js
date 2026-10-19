(function(root){
  'use strict';
  const C=typeof module==='object'&&module.exports?require('./inventory-core.js'):root.InventoryCore;
  function text(value,label,max=200,required=false,multiline=false){if(typeof value!=='string'||value.length>max||(!multiline&&/[\r\n\x00-\x1f\x7f]/.test(value))||(multiline&&/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)))throw Error(label+'을 확인하세요.');const out=value.trim();if(required&&!out)throw Error(label+'을 입력하세요.');return out;}
  function address(value,required=true){const out=text(value??'','수신 이메일',254,required);if(out&&!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(out))throw Error('수신 이메일 주소 한 개를 입력하세요.');return out;}
  function numeric(value,label,min=0,max=1e12){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+'을 확인하세요.');return value;}
  function normalizeDocument(raw){
    if(!raw||raw.type!=='purchaseorder'||!Array.isArray(raw.lines)||!raw.lines.length||raw.lines.length>500)throw Error('발주서 품목은 1~500행이어야 합니다.');
    const id=text(raw.id,'발주서 번호',100,true),date=text(raw.date,'발주일',10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('발주일을 확인하세요.');
    const vatRate=numeric(raw.vatRate??10,'부가세율',0,100),taxRounding=C.taxRounding(raw.taxRounding),supplyRounding=C.supplyRounding(raw.supplyRounding);
    const lines=raw.lines.map(l=>{if(!l||typeof l!=='object')throw Error('발주 품목을 확인하세요.');const row={item:text(l.item,'품목코드',100,true),name:text(l.name||l.item,'품목명',300,true),spec:text(l.spec||'','규격',300),unit:text(l.unit||'','단위',30),memo:text(l.memo||'','품목 적요',1000,false,true),qty:numeric(l.qty,'수량',0.000001),price:numeric(l.price??0,'단가'),discount:numeric(l.discount??0,'할인율',0,100)};return {...row,...C.lineTotals(row,vatRate,taxRounding,supplyRounding)};});
    const partner=text(raw.partner,'거래처코드',100,true),partnerName=text(raw.partnerName||partner,'거래처명',200,true),total=lines.reduce((sum,l)=>sum+l.total,0);if(!Number.isFinite(total)||total>1e16)throw Error('발주 금액 한도를 확인하세요.');
    return {id,type:'purchaseorder',date,partner,partnerName,partnerAddress:text(raw.partnerAddress||'','거래처 주소',300),partnerPhone:text(raw.partnerPhone||'','거래처 전화',80),currency:text(raw.currency||'KRW','통화코드',20),dueDate:text(raw.dueDate||'','납기일',20),reference:text(raw.reference||'','참조',300),memo:text(raw.memo||'','전표 적요',3000,false,true),vatRate,taxRounding,supplyRounding,lines};
  }
  function normalizeMessage(raw,{recipientRequired=true}={}){
    if(!raw||!Array.isArray(raw.documents)||!raw.documents.length||raw.documents.length>20)throw Error('발주서는 1~20건 선택하세요.');
    const documents=raw.documents.map(normalizeDocument);if(new Set(documents.map(d=>d.id)).size!==documents.length)throw Error('발주서를 중복 없이 선택하세요.');if(new Set(documents.map(d=>d.partner)).size!==1)throw Error('같은 거래처의 발주서만 선택하세요. 거래처마다 따로 발송합니다.');if(documents.reduce((n,d)=>n+d.lines.length,0)>1000)throw Error('메일 한 건의 품목은 1,000행 이하여야 합니다.');
    return {recipient:address(raw.recipient,recipientRequired),subject:text(raw.subject||'','메일 제목',200,true),body:text(raw.body||'','메일 본문',20000,false,true),documents};
  }
  function fromDocuments(db,ids){
    if(!Array.isArray(ids)||!ids.length)throw Error('발주서를 선택하세요.');const documents=ids.map(id=>{const d=db.documents.find(d=>d.id===id);if(!d||d.type!=='purchaseorder'||!C.active(d))throw Error('확인된 유효 발주서를 선택하세요.');const p=C.master(db,'partners',d.partner);return {...d,partnerName:p?.name||d.partner,partnerAddress:p?.address||'',partnerPhone:p?.phone||'',lines:d.lines.map(l=>{const i=C.master(db,'items',l.item);return {...l,name:l.description||i?.name||l.item,spec:l.spec||i?.spec||'',unit:l.unit||i?.unit||''};})};});
    const first=documents[0],recipient=C.master(db,'partners',first.partner)?.email||'';return normalizeMessage({documents,recipient,subject:'발주서 '+first.id+(documents.length>1?' 외 '+(documents.length-1)+'건':''),body:'안녕하세요.\n첨부한 발주서를 확인 부탁드립니다.\n감사합니다.'},{recipientRequired:false});
  }
  const filename=d=>'발주서_'+d.id.replace(/[^A-Za-z0-9가-힣._-]/g,'_').slice(0,80)+'.pdf';
  const statusLabel=status=>({accepted:'Gmail 접수',failed:'발송 실패',unknown:'결과 확인 필요',sending:'발송 중'})[status]||'미발송';
  const api={text,address,normalizeDocument,normalizeMessage,fromDocuments,filename,statusLabel};if(typeof module==='object'&&module.exports)module.exports=api;else root.PurchaseMailCore=api;
})(typeof globalThis==='object'?globalThis:this);
