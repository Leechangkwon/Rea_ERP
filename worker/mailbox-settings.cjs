// Durable two-system save: reserve with CAS, reconcile, then confirm. Never touches messages.
'use strict';
const App=require('./app-service.cjs');
const fail=(status,code,message)=>{throw new App.AppError(status,code,message);};
const explanations={routing_auth:'Cloudflare 인증을 확인한 뒤 수신 연결을 다시 시도하세요.',routing_not_configured:'서버의 Cloudflare 수신 자동 연결 설정이 필요합니다.',routing_conflict:'같은 주소의 다른 수신 규칙이 있어 변경하지 않았습니다.',routing_domain:'서버에 연결된 회사 도메인 주소를 입력하세요.'};
async function saveSettings({store,row,old,routing,authorize=async()=>{}}){
 const needsRouting=row.provider==='cloudflare'||old?.provider==='cloudflare'||old?.route_sync?.rule_id;
 if(old?.route_sync?.status==='syncing'&&Date.parse(old.route_sync.lease_until)>Date.now())fail(409,'routing_busy','수신 연결 처리 중입니다. 잠시 후 다시 조회하세요.');
 if(!needsRouting||!routing){const saved=await store.saveBox(row,old?old.revision:null);if(!saved)fail(409,'mailbox_conflict','메일함 설정이 바뀌었습니다. 다시 불러오세요.');return {box:saved,routeSynced:!needsRouting,routeMessage:needsRouting?'수신 자동 연결이 설정되지 않은 실행 환경입니다.':''};}
 const previous=old?.route_sync?.previous_address||old?.route_sync?.address||old?.address||row.address;
 let plan;try{plan=await routing.prepare(row,previous);}catch(e){fail(e.code==='routing_conflict'?409:503,e.code||'routing_unavailable',explanations[e.code]||'수신 연결을 확인하지 못해 메일함을 변경하지 않았습니다.');}
 const operation=crypto.randomUUID(),reserved=await store.saveBox({...row,route_sync:{...old?.route_sync,status:'syncing',operation_id:operation,previous_address:previous,target_address:row.address,lease_until:new Date(Date.now()+120000).toISOString()}},old?old.revision:null);
 if(!reserved)fail(409,'mailbox_conflict','메일함 설정이 바뀌었습니다. 다시 불러오세요.');
 let result,routeMessage='';try{await authorize();result=await plan.apply();result={...result,checked_at:new Date().toISOString()};}catch(e){result={...reserved.route_sync,status:'error',error_code:explanations[e.code]?e.code:'routing_unavailable'};routeMessage=explanations[e.code]||'메일함은 저장됐지만 수신 연결을 확인하지 못했습니다. 수신 연결 다시 시도를 누르세요.';}
 const saved=await store.saveBox({...reserved,route_sync:{...result,operation_id:operation}},reserved.revision);if(!saved)fail(503,'routing_unconfirmed','메일함과 수신 규칙의 저장 결과를 다시 조회하세요.');
 return {box:saved,routeSynced:result.status!=='error',routeMessage};
}
module.exports={saveSettings};
