(function(root){
  'use strict';
  const manual=typeof module==='object'&&module.exports?require('./api-manual-data.js'):root.ApiManualData;
  const source=manual.officialManual;
  const catalog=manual.providers.map(provider=>{
    const peer=provider.ours.map(id=>manual.endpoints.find(e=>e.id===id)).filter(Boolean);
    return {name:provider.title,direction:provider.group.includes('출력')||provider.title.includes('조회')?'조회':provider.status==='인증 개념 참조'?'인증':'입력',resource:provider.id,endpoint:peer.map(e=>e.method+' '+e.path).join(' / '),local:provider.status,compatibility:provider.note+' · 실제 규격 호환 미확정',source,checkedAt:manual.checkedAt,providerPath:provider.path,manualId:provider.id};
  });
  const forbidden=new Set(['__proto__','prototype','constructor']);
  function object(v){if(!v||typeof v!=='object'||Array.isArray(v))throw Error('JSON 객체를 입력하세요.');return v;}
  function text(v,label,max=160){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+' 값을 확인하세요.');return v.trim();}
  const targets=['type','date','partner','warehouse','targetWarehouse','employee','project','currency','vatRate','taxRounding','sourceId','settlementMode','memo','autoConsume','materialWarehouse','custom','lines'];
  function mapping(value){if(!Array.isArray(value)||value.length>30)throw Error('필드 대응은 30개 이하의 배열이어야 합니다.');const used=new Set();return value.map(x=>{object(x);const from=text(x.from,'원본 필드',100),to=text(x.to,'대상 필드',50);if(!targets.includes(to)||used.has(to)||from.split('.').some(k=>forbidden.has(k)||!/^\w+$/.test(k)))throw Error('필드 경로나 중복 대상을 확인하세요.');used.add(to);return {from,to};});}
  function transform(data,rules){object(data);if(!rules?.length)return data;const out={};for(const r of mapping(rules)){let v=data;for(const k of r.from.split('.'))v=v&&Object.hasOwn(v,k)?v[k]:undefined;if(v!==undefined)out[r.to]=v;}return out;}
  function documentInput(input){object(input);const d={};for(const k of targets)if(Object.hasOwn(input,k))d[k]=input[k];if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>100)throw Error('품목 행은 1~100개여야 합니다.');d.lines=d.lines.map(l=>{object(l);const o={};for(const k of ['item','qty','price','discount','memo','custom','lineId','sourceLineId'])if(Object.hasOwn(l,k))o[k]=l[k];return o;});d.status='진행';return d;}
  function conversionInput(input){object(input);const d={};for(const k of ['id','type','quantities','partner','warehouse','targetWarehouse','date','settlementMode'])if(Object.hasOwn(input,k))d[k]=input[k];d.id=text(d.id,'원본 전표번호',200);d.type=text(d.type,'생성 종류',40);if(d.quantities!==undefined)object(d.quantities);return d;}
  function reconcile(internal,external){if(!Array.isArray(external)||external.length>10000)throw Error('비교 자료 배열을 확인하세요.');const a=new Map(internal.map(x=>[x.item+'|'+x.warehouse,x])),b=new Map();for(const x of external){object(x);const item=text(x.item,'품목'),warehouse=text(x.warehouse,'창고'),qty=Number(x.qty),k=item+'|'+warehouse;if(!Number.isFinite(qty)||b.has(k))throw Error('수량 또는 중복 품목·창고를 확인하세요.');b.set(k,{item,warehouse,qty});}return [...new Set([...a.keys(),...b.keys()])].sort().map(k=>{const l=a.get(k),r=b.get(k),difference=l&&r?Math.round((l.qty-r.qty)*1e6)/1e6:null;return {item:(l||r).item,warehouse:(l||r).warehouse,ours:l?.qty??null,theirs:r?.qty??null,difference,status:!l?'우리 자료 없음':!r?'상대 자료 없음':difference===0?'일치':'차이'};});}
  function openapi(origin){return manual.openapi(origin);}
  const api={catalog,source,object,text,mapping,transform,documentInput,conversionInput,reconcile,openapi};if(typeof module==='object'&&module.exports)module.exports=api;else root.ApiCore=api;
})(typeof globalThis==='object'?globalThis:this);
