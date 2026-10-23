(function(root){
 'use strict';
 let active=null;
 const clone=value=>JSON.parse(JSON.stringify(value));
 function open(options){
  active?.destroy();
  const auth=root.AuthUI,user=()=>auth?.state?.().user;
  const identity=()=>JSON.stringify([user()?.id,user()?.company?.code,user()?.roleId]);
  const openedIdentity=identity();
  let disposed=false,state=null,view=null,anchor=null;
  let settings=JSON.stringify(auth?.settings?.()||{}),revision=user()?.settingsRevision;
  const controller={destroy(){if(disposed)return;disposed=true;view?.destroy();anchor?.remove();if(active===controller)active=null;options.onClose?.();}};
  active=controller;
  function guard(){
   if(disposed||!options.host?.isConnected||options.isCurrent?.()===false)throw Error('발주서 입력 화면이나 초안이 변경됐습니다. 설정을 다시 열어 주세요.');
   if(!user()?.id||identity()!==openedIdentity||!auth.can('inventory.read')||!auth.can('config.write'))throw Error('설정 변경 권한 또는 계정·회사가 변경됐습니다.');
   if(JSON.stringify(auth.settings?.()||{})!==settings||user()?.settingsRevision!==revision)throw Error('다른 화면에서 설정이 변경됐습니다. 설정을 다시 열어 주세요.');
   if(state&&!state.permissions?.some(p=>p==='*'||p==='config.write'))throw Error('설정 변경 권한이 없습니다.');
  }
  function allowed(){try{guard();return true;}catch{return false;}}
  function validateState(value){
   if(value?.company?.code&&value.company.code!==user()?.company?.code)throw Error('설정의 회사가 변경됐습니다. 다시 열어 주세요.');
   if(!value||!Number.isSafeInteger(value.revision)||!Array.isArray(value.permissions)||!value.config||!Array.isArray(value.config.inventoryFeatures?.progressRules))throw Error('진행상태 설정을 읽지 못했습니다.');
   return value;
  }
  controller.ready=(async()=>{
   try{
    guard();if(!root.SelfSettingsUI)throw Error('진행상태 설정 화면을 사용할 수 없습니다.');
    state=validateState(await auth.request('/api/self/state'));guard();
    anchor=document.createElement('section');anchor.hidden=true;options.host.append(anchor);
    view=root.SelfSettingsUI.render(anchor,{page:'features',headless:true,progressPairs:[{from:'plan',to:'purchaseorder'}],getState:()=>state,can:allowed,
     onSave:async(key,value)=>{
      guard();if(key!=='inventoryFeatures')throw Error('지원하지 않는 설정입니다.');
      const requested=clone(value);
      await auth.request('/api/self/action',{action:'config.save',payload:{key,value:requested},revision:state.revision});
      if(disposed)return true;
      guard();const fresh=validateState(await auth.request('/api/self/state'));guard();
      if(JSON.stringify(fresh.config.inventoryFeatures)!==JSON.stringify(requested))throw Error('설정 저장 후 다른 변경이 확인됐습니다. 다시 조회해 주세요.');
      state=fresh;
      auth.refresh({...user(),company:fresh.company||user().company,permissions:fresh.permissions,settingsRevision:fresh.revision,settings:{...auth.settings(),...Object.fromEntries(['requestUploadRules','purchasePrecision','defaults','features','conveniences','commonDefaults','inventoryFeatures','menuMappings'].filter(key=>Object.hasOwn(fresh.config,key)).map(key=>[key,fresh.config[key]]))}});
      settings=JSON.stringify(auth.settings());revision=user().settingsRevision;
      return true;
     }});
    const dialog=view.openProgress();dialog.d.addEventListener('close',()=>controller.destroy(),{once:true});
    return true;
   }catch(error){if(!disposed)options.onError?.(error);controller.destroy();return false;}
  })();
  return controller;
 }
 root.PurchasingProgressSettingsUI={open};
})(typeof globalThis==='object'?globalThis:this);
