(async()=>{
 'use strict';
 const host=document.getElementById('portal-data'),types={quote:'견적',order:'주문',sale:'판매',shoporder:'쇼핑몰 주문'};
 try{
  const data=await AuthUI.request('/api/portal/data');
  document.getElementById('portal-title').textContent=data.company+' · '+data.title;
  document.getElementById('portal-welcome').textContent=data.welcome;
  host.replaceChildren();
  const t=document.createElement('table'),head=document.createElement('tr'),thead=document.createElement('thead'),body=document.createElement('tbody');
  for(const v of ['일자','번호','전표','상태','금액']){const x=document.createElement('th');x.textContent=v;x.scope='col';head.append(x);}thead.append(head);t.append(thead,body);
  for(const row of data.documents){const tr=document.createElement('tr');for(const k of ['date','id','type','status','total']){const td=document.createElement('td');td.textContent=k==='type'?(types[row[k]]||row[k]):k==='total'?Number(row[k]).toLocaleString('ko-KR',{maximumFractionDigits:6}):row[k];tr.append(td);}body.append(tr);}host.append(t);
  if(!data.documents.length)host.append(document.createTextNode('조회할 거래 전표가 없습니다.'));
 }catch(e){host.textContent=e.message;if(e.status===401){const a=document.createElement('a');a.href=AuthCore.signInPath('/portal');a.textContent='앱 ID로 다시 로그인';a.className='portal-relogin';host.append(a);}}
})();
