(function(root){
  'use strict';
  function returnPath(value){if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//'))return '/';try{const u=new URL(value,'https://erp.local');if(u.origin!=='https://erp.local')return '/';const decoded=decodeURIComponent(u.pathname).replace(/\/$/,'');if(['/signin-with-chatgpt','/signout-with-chatgpt','/callback','/login','/login.html'].includes(decoded))return '/';return u.pathname+u.search+u.hash;}catch{return '/';}}
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const signInPath=value=>'/login?return_to='+encodeURIComponent(returnPath(value));
  function render(html,app,returnTo){return html.replace('<!--AUTH_CONTEXT-->','<div id="auth-context" hidden data-supported="true" data-authenticated="'+!!app?.user+'" data-return-to="'+escape(returnPath(returnTo))+'" data-app="'+escape(JSON.stringify(app||{}))+'"></div>');}
  const api={returnPath,signInPath,escape,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuthCore=api;
})(typeof globalThis==='object'?globalThis:this);
