const api=Gateway.createGateway(),app=AppService.createService();
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',woff:'font/woff'};
const redirect=path=>new Response(null,{status:302,headers:{Location:path,'Cache-Control':'private, no-store'}});
export default {async fetch(request,env){
 try{
  env=Storage.resolveEnvironment(env);
  const u=new URL(request.url),path=u.pathname;
  if(/^\/api\/(auth|self|portal)\//.test(path))return app.handle(request,env);
  if(path.startsWith('/api/')){
    const ctx=await app.context(request,env),hasKey=!!request.headers.get('X-Api-Key');
    if(request.method!=='GET'&&request.method!=='HEAD'&&(!hasKey||path.startsWith('/api/admin/'))){if(!ctx)throw new AppService.AppError(401,'app_login_required','앱 ID로 로그인하세요.');if(request.headers.get('origin')!==u.origin)throw new AppService.AppError(403,'origin_rejected','같은 사이트에서 요청하세요.');app.csrf(request,ctx);}
    const settings=ctx?.settings||(await AppService.load(env.DB)).state.config;
    if(!settings.features.apiEnabled&&path.startsWith('/api/v1/'))throw new AppService.AppError(403,'api_disabled','기능설정에서 API 사용을 허용하세요.');
    return api(request,env,ctx||{settings});
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const key=path==='/'?'/index.html':['/login','/login/'].includes(path)?'/login.html':['/portal','/portal/'].includes(path)?'/portal.html':['/api-manual','/api-manual/'].includes(path)?'/api-manual.html':path,encoded=ASSETS[key];if(!encoded)return new Response('Not found',{status:404});
  const dynamic=['/index.html','/login.html','/portal.html'].includes(key);let auth;
  if(dynamic){const ctx=await app.context(request,env);if(key!=='/login.html'&&!ctx)return redirect(AuthCore.signInPath(path+u.search));if(ctx&&key==='/index.html'&&ctx.user.kind==='customer')return redirect('/portal');if(ctx&&key==='/portal.html'&&ctx.user.kind!=='customer')return redirect('/');const b=ctx?null:await AppService.load(env.DB);auth={user:app.publicContext(ctx),initialized:ctx?true:!!b.state.users.length,bootstrapAllowed:!ctx&&!b.state.users.length&&app.bootstrapAllowed(request,env),company:ctx?{code:ctx.state.company.code,name:ctx.state.company.name}:{code:b.state.company.code,name:b.state.company.name}};}
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),body=dynamic?AuthCore.render(new TextDecoder().decode(bytes),auth,key==='/login.html'?u.searchParams.get('return_to')||'/':path+u.search):bytes;
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime[key.split('.').pop()]||'application/octet-stream','Cache-Control':dynamic?'private, no-store':'no-cache',...(dynamic?{Vary:'Cookie'}:{}),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"}});
 }catch(e){return new Response(JSON.stringify({error:{code:e.code||'service_unavailable',message:e.code?e.message:'저장소 연결 상태를 확인하세요.'}}),{status:e.status||503,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}
}};
