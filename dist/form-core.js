(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const validKey=x=>typeof x==='string'&&/^[a-zA-Z0-9_:\-가-힣 ()/]{1,180}$/.test(x)&&!['__proto__','prototype','constructor'].includes(x);
  const fieldKey=x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(x)&&!['__proto__','prototype','constructor'].includes(x);
  const field=(id,label,type='text',extra={})=>({id,label,type,visible:true,required:false,readonly:false,width:140,align:type==='number'?'right':'left',defaultValue:'',options:[],formula:'',aggregate:false,...extra});
  function parse(expression){
    if(typeof expression!=='string'||expression.length>400)throw Error('계산식은 400자 이내로 입력하세요.');
    const tokens=[];let rest=expression.trim();while(rest){const m=/^(\d+(?:\.\d*)?|\.\d+|[A-Za-z][A-Za-z0-9_]*|[+\-*/(),])/.exec(rest);if(!m)throw Error('계산식에는 숫자·항목 ID·사칙연산·ROUND/MIN/MAX/ABS만 사용할 수 있습니다.');tokens.push(m[0]);rest=rest.slice(m[0].length).trimStart();if(tokens.length>150)throw Error('계산식이 너무 깁니다.');}
    let position=0;const identifiers=new Set();
    function atom(depth){
      if(depth>30)throw Error('계산식의 괄호가 너무 깊습니다.');const token=tokens[position++];if(!token)throw Error('계산식이 완성되지 않았습니다.');
      if(token==='+'||token==='-')return {op:token==='-'?'neg':'pos',arg:atom(depth+1)};
      if(token==='('){const value=expressionNode(0,depth+1);if(tokens[position++]!==')')throw Error('닫는 괄호를 확인하세요.');return value;}
      if(/^\d|^\./.test(token))return {value:Number(token)};
      if(/^[A-Za-z]/.test(token)){
        if(tokens[position]==='('){const name=token.toUpperCase();if(!['ROUND','MIN','MAX','ABS'].includes(name))throw Error('허용하지 않는 함수입니다.');position++;const args=[expressionNode(0,depth+1)];while(tokens[position]===','){position++;args.push(expressionNode(0,depth+1));}if(tokens[position++]!==')')throw Error('함수 괄호를 확인하세요.');if((name==='ABS'&&args.length!==1)||(name==='ROUND'&&args.length>2)||args.length>10)throw Error('함수 인수를 확인하세요.');return {call:name,args};}
        if(!fieldKey(token))throw Error('항목 ID를 확인하세요.');identifiers.add(token);return {identifier:token};
      }
      throw Error('계산식의 연산자를 확인하세요.');
    }
    function expressionNode(min,depth){let left=atom(depth);while(position<tokens.length){const op=tokens[position],p=op==='+'||op==='-'?1:op==='*'||op==='/'?2:0;if(!p||p<min)break;position++;left={op,left,right:expressionNode(p+1,depth+1)};}return left;}
    const tree=expressionNode(0,0);if(position!==tokens.length)throw Error('계산식의 끝을 확인하세요.');return {tree,identifiers:[...identifiers]};
  }
  function calculate(expression,values={}){
    const {tree}=typeof expression==='string'?parse(expression):expression;
    const finite=n=>{if(!Number.isFinite(n)||Math.abs(n)>1e15)throw Error('계산 결과의 범위를 확인하세요.');return Math.round(n*1e8)/1e8;};
    const walk=n=>{
      if('value'in n)return finite(n.value);
      if(n.identifier){if(!Object.hasOwn(values,n.identifier))throw Error('알 수 없는 계산 항목: '+n.identifier);const v=values[n.identifier];if(v===''||v===null||v===undefined)return 0;return finite(Number(v));}
      if(n.call){const a=n.args.map(walk);if(n.call==='ROUND'){const p=a[1]??0;if(!Number.isInteger(p)||p<0||p>8)throw Error('반올림 자릿수는 0~8입니다.');return finite(Math.round((a[0]+Number.EPSILON)*10**p)/10**p);}if(n.call==='MIN')return Math.min(...a);if(n.call==='MAX')return Math.max(...a);return Math.abs(a[0]);}
      if(n.op==='neg')return -walk(n.arg);if(n.op==='pos')return walk(n.arg);const a=walk(n.left),b=walk(n.right);if(n.op==='+')return finite(a+b);if(n.op==='-')return finite(a-b);if(n.op==='*')return finite(a*b);if(!b)throw Error('0으로 나눌 수 없습니다.');return finite(a/b);
    };return walk(tree);
  }
  const pageDefaults={title:'',company:'샘플회사',footer:'로컬 샘플 · 외부 발행 없음',paper:'A4',orientation:'portrait',margin:12,fontSize:11,showTotals:true};
  function validateForm(input){
    if(!input||!validKey(input.id)||input.id==='default'||!String(input.name||'').trim()||input.name.length>60||!Array.isArray(input.fields)||input.fields.length>100)throw Error('양식명과 항목 구성을 확인하세요.');
    const form=copy(input);form.name=form.name.trim();const seen=new Set();
    for(const f of form.fields){
      if(!fieldKey(f.id)||seen.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>60)throw Error('중복 항목 ID 또는 항목명을 확인하세요.');seen.add(f.id);
      if(!['text','number','date','select','checkbox','reference'].includes(f.type))throw Error('항목 유형을 확인하세요.');
      if(typeof f.visible!=='boolean'||typeof f.required!=='boolean'||typeof f.readonly!=='boolean'||!Number.isFinite(Number(f.width))||f.width<50||f.width>600)throw Error('항목 표시·폭 설정을 확인하세요.');
      if(!['left','center','right'].includes(f.align))throw Error('항목 정렬을 확인하세요.');
      f.width=Number(f.width);f.label=f.label.trim();f.formula=String(f.formula||'').trim();f.options=Array.isArray(f.options)?f.options.map(String).slice(0,50):[];
      if(f.custom&&!f.id.startsWith('x_'))throw Error('추가항목 ID는 x_로 시작해야 합니다.');
      if(f.protected&&!f.visible)throw Error(f.label+' 항목은 숨길 수 없습니다.');
      if(f.formula){if(!f.custom||f.type!=='number')throw Error('계산식은 숫자 추가항목에만 설정하세요.');parse(f.formula);f.readonly=true;}
      if(String(f.defaultValue??'').length>500)throw Error('기본값은 500자 이내입니다.');
      if(f.defaultValue!==''&&f.defaultValue!==undefined&&f.type==='number'&&!Number.isFinite(Number(f.defaultValue)))throw Error(f.label+' 기본값은 숫자여야 합니다.');
      if(f.type==='select'&&!f.options.length)throw Error(f.label+' 선택값을 입력하세요.');
    }
    if(!form.fields.some(f=>f.visible))throw Error('표시 항목을 하나 이상 선택하세요.');
    const byId=new Map(form.fields.map(f=>[f.id,f]));const visit=(f,path)=>{if(path.includes(f.id))throw Error('계산식 항목에 순환 참조가 있습니다.');if(f.formula)for(const id of parse(f.formula).identifiers){if(!byId.has(id))throw Error('계산식의 항목 ID를 확인하세요: '+id);const dep=byId.get(id);if(dep.formula)visit(dep,[...path,f.id]);}};for(const f of form.fields)visit(f,[]);
    form.page={...pageDefaults,...form.page};if(!['portrait','landscape'].includes(form.page.orientation)||!['A4','A5','Letter'].includes(form.page.paper)||!Number.isFinite(Number(form.page.margin))||form.page.margin<0||form.page.margin>40||!Number.isFinite(Number(form.page.fontSize))||form.page.fontSize<8||form.page.fontSize>20)throw Error('인쇄 페이지 설정을 확인하세요.');
    for(const k of ['title','company','footer'])if(typeof form.page[k]!=='string'||form.page[k].length>200)throw Error('인쇄 문구를 확인하세요.');if(typeof form.page.showTotals!=='boolean')throw Error('인쇄 합계 표시를 확인하세요.');return form;
  }
  function empty(){return {version:1,screens:{}};}
  function screen(store,key){if(!validKey(key))throw Error('화면 구분을 확인하세요.');return store?.screens?.[key]||{forms:[],active:{},rules:[]};}
  function merge(base,saved){
    const byId=new Map(base.map(f=>[f.id,f])),out=[];for(const s of saved||[]){const b=byId.get(s.id);if(b){out.push({...b,...s,type:b.type,custom:false,protected:b.protected,calculated:b.calculated});byId.delete(s.id);}else if(s.custom)out.push({...s});}
    out.push(...byId.values());return out.map(f=>({...f,visible:f.protected?true:f.visible,readonly:f.calculated?true:f.readonly}));
  }
  function matches(rule,values){const value=String(values[rule.field]??values.custom?.[rule.field]??''),target=String(rule.value??'');if(rule.operator==='eq')return value===target;if(rule.operator==='neq')return value!==target;if(rule.operator==='contains')return value.includes(target);if(rule.operator==='gt')return value!==''&&Number(value)>Number(target);if(rule.operator==='lt')return value!==''&&Number(value)<Number(target);return false;}
  function effective(store,key,context,base,values={}){
    const screenState=screen(store,key),forms=new Map(screenState.forms.filter(f=>f.context===context).map(f=>[f.id,f]));
    const ordered=screenState.rules.map((rule,index)=>({rule,index})).filter(({rule})=>rule.enabled&&rule.context===context&&forms.has(rule.formId)).sort((a,b)=>a.rule.priority-b.rule.priority||a.index-b.index);
    const selected=ordered.find(({rule})=>matches(rule,values))?.rule;
    const id=selected?.formId||screenState.active[context]||'default',chosen=forms.get(id);
    return {id:chosen?.id||'default',name:chosen?.name||'기본(수정불가)',context,conditional:!!selected,fields:merge(base,chosen?.fields),page:{...pageDefaults,...chosen?.page}};
  }
  function save(store,key,context,input){
    if(!validKey(context))throw Error('양식 종류를 확인하세요.');const next=copy(store||empty()),s=copy(screen(next,key)),f=validateForm({...input,context});const index=s.forms.findIndex(x=>x.id===f.id);if(index>=0&&s.forms[index].context!==context)throw Error('다른 종류의 양식 ID입니다.');if(index<0&&s.forms.length>=100)throw Error('화면별 최대 100개 양식입니다.');if(index<0)s.forms.push(f);else s.forms[index]=f;s.active[context]=f.id;next.screens[key]=s;return next;
  }
  function activate(store,key,context,id){const next=copy(store||empty()),s=copy(screen(next,key));if(id!=='default'&&!s.forms.some(f=>f.id===id&&f.context===context))throw Error('선택한 양식이 없습니다.');s.active[context]=id;next.screens[key]=s;return next;}
  function remove(store,key,id){const next=copy(store||empty()),s=copy(screen(next,key));s.forms=s.forms.filter(f=>f.id!==id);for(const k of Object.keys(s.active))if(s.active[k]===id)s.active[k]='default';s.rules=s.rules.filter(r=>r.formId!==id);next.screens[key]=s;return next;}
  function rules(store,key,input){
    if(!Array.isArray(input)||input.length>100)throw Error('조건양식은 100개 이하로 설정하세요.');const next=copy(store||empty()),s=copy(screen(next,key));s.rules=input.map((r,i)=>{if(!fieldKey(r.field)||!validKey(r.context)||!['eq','neq','contains','gt','lt'].includes(r.operator)||String(r.value??'').length>200||!s.forms.some(f=>f.id===r.formId&&f.context===r.context)||typeof r.enabled!=='boolean')throw Error('조건 항목과 적용 양식을 확인하세요.');return {...r,id:r.id||'rule_'+i,priority:Number.isFinite(Number(r.priority))?Number(r.priority):i};});next.screens[key]=s;return next;
  }
  function validateStore(value){
    if(value===undefined)return empty();if(!value||value.version!==1||!value.screens||Array.isArray(value.screens)||typeof value.screens!=='object'||Object.keys(value.screens).length>500)throw Error('양식 백업 구조를 확인하세요.');
    const out=empty();for(const [key,s] of Object.entries(value.screens)){if(!validKey(key)||!s||!Array.isArray(s.forms)||s.forms.length>100||!s.active||!Array.isArray(s.rules)||s.forms.some(f=>!validKey(f.context)))throw Error('양식 화면 구성을 확인하세요.');out.screens[key]={forms:s.forms.map(f=>({...validateForm(f),context:f.context})),active:{...s.active},rules:[]};if(new Set(s.forms.map(f=>f.id)).size!==s.forms.length)throw Error('중복 양식 ID입니다.');for(const [context,id] of Object.entries(s.active)){if(!validKey(context)||(id!=='default'&&!s.forms.some(f=>f.id===id&&f.context===context)))throw Error('활성 양식을 확인하세요.');}out.screens[key]=rules(out,key,s.rules).screens[key];}return out;
  }
  function compute(fields,raw={}){
    const result={...raw},byId=new Map(fields.map(f=>[f.id,f]));const done=new Set(),path=new Set();
    for(const f of fields)if(f.type==='number'&&!f.formula&&result[f.id]!==undefined&&result[f.id]!==null&&result[f.id]!==''&&Number.isFinite(Number(result[f.id])))result[f.id]=Number(result[f.id]);
    const read=id=>{if(done.has(id))return result[id];if(path.has(id))throw Error('계산식 순환 참조');path.add(id);const f=byId.get(id);if(f?.formula){const parsed=parse(f.formula);for(const ref of parsed.identifiers)if(byId.get(ref)?.formula)read(ref);result[id]=calculate(parsed,result);}path.delete(id);done.add(id);return result[id];};for(const f of fields)if(f.formula)read(f.id);return result;
  }
  function check(fields,values){for(const f of fields){const v=values[f.id];if(f.required&&(v===undefined||v===null||v===''||(f.type==='checkbox'&&v!==true)))throw Error(f.label+' 항목은 필수입니다.');if(v!==undefined&&v!==null&&v!==''){if(f.type==='number'&&!Number.isFinite(Number(v)))throw Error(f.label+' 숫자를 확인하세요.');if(f.type==='select'&&!f.options.includes(String(v)))throw Error(f.label+' 선택값을 확인하세요.');if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw Error(f.label+' 일자를 확인하세요.');}}return values;}
  function custom(store,key,context){const result=new Map();for(const f of screen(store,key).forms.filter(f=>f.context===context))for(const x of f.fields)if(x.custom)result.set(x.id,x);return [...result.values()];}
  function defaultValue(f,date){if(f.defaultValue==='@today')return date;return f.defaultValue??'';}
  const api={field,pageDefaults,parse,calculate,validateForm,empty,screen,merge,effective,save,activate,remove,rules,validateStore,compute,check,custom,defaultValue};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FormCore=api;
})(typeof globalThis==='object'?globalThis:this);
