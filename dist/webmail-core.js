(function(root){
'use strict';
class InputError extends Error{constructor(message){super(message);this.name='WebmailInputError';}}
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_FILE=3*1024*1024,MAX_BODY=64000;
function text(value,label,max,required=false){if(typeof value!=='string'||value.length>max||/[\x00\x08\x0b\x0c]/.test(value))throw new InputError(label+'을 확인하세요.');const out=value.trim();if(required&&!out)throw new InputError(label+'을 입력하세요.');return out;}
function header(value,label,max=254,required=false){const out=text(value,label,max,required);if(/[\r\n\x00-\x1f\x7f]/.test(out))throw new InputError(label+' 형식을 확인하세요.');return out;}
function address(value){const out=header(value,'이메일 주소',254,true).toLowerCase();if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(out)||out.includes('..'))throw new InputError('이메일 주소를 확인하세요.');return out;}
function addresses(value){if(typeof value==='string')value=value.split(/[,;]/).map(x=>x.trim()).filter(Boolean);if(!Array.isArray(value)||value.length>20)throw new InputError('수신 주소는 20개 이하로 입력하세요.');return [...new Set(value.map(address))];}
function id(value){if(typeof value!=='string'||!UUID.test(value))throw new InputError('메일 식별자를 확인하세요.');return value;}
function filename(value){const s=header(String(value||'attachment'),'첨부 이름',180,true).replace(/[\\/<>:"|?*]/g,'_');return s==='.'||s==='..'?'attachment':s;}
function draft(raw,{complete=false}={}){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new InputError('메일 내용을 확인하세요.');const out={to:addresses(raw.to||[]),cc:addresses(raw.cc||[]),bcc:addresses(raw.bcc||[]),subject:header(raw.subject||'','메일 제목',200),body:text(raw.body||'','메일 본문',MAX_BODY),attachment_ids:(raw.attachment_ids||[]).map(id)};if(out.to.length+out.cc.length+out.bcc.length>20||complete&&!out.to.length)throw new InputError('받는 사람을 입력하고 전체 수신자를 20명 이하로 지정하세요.');if(out.attachment_ids.length>10||new Set(out.attachment_ids).size!==out.attachment_ids.length)throw new InputError('첨부 파일을 확인하세요.');return out;}
function mailbox(raw){const out={address:address(raw.address),name:header(raw.name||'','메일함 이름',80,true),provider:raw.provider,members:raw.members,enabled:raw.enabled===true};if(!['gmail','cloudflare'].includes(out.provider)||!Array.isArray(out.members)||!out.members.length||out.members.length>50||out.members.some(x=>typeof x!=='string'||x.length>100||!x))throw new InputError('메일함 제공자와 구성원을 확인하세요.');out.members=[...new Set(out.members)];return out;}
function canRead(user,box){return !!user&&user.kind==='staff'&&box.enabled===true&&box.members.includes(user.id);}
function statusLabel(status){return {draft:'작성 중',sending:'발송 중',accepted:'서버 접수',delivered:'수신 서버 전달',failed:'발송 실패',unknown:'결과 확인 필요',received:'수신'}[status]||'확인 필요';}
const api={InputError,UUID,MAX_FILE,MAX_BODY,text,header,address,addresses,id,filename,draft,mailbox,canRead,statusLabel};
if(typeof module==='object'&&module.exports)module.exports=api;else root.WebmailCore=api;
})(typeof globalThis==='object'?globalThis:this);
