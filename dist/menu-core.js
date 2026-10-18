(function(root){
  'use strict';
  function indexMenus(tree){
    const rows=[],seen=new Set();
    if(!Array.isArray(tree))throw Error('업무 메뉴 구조를 확인하세요.');
    function add(id,name,path,meta){if(seen.has(id)||typeof name!=='string'||!name.trim())throw Error('중복 또는 빈 메뉴입니다.');seen.add(id);rows.push({id,name,path,...meta});}
    for(const [top,t] of tree.entries())for(const [group,g] of t.groups.entries())for(const [item,m] of g.items.entries()){
      const id=[top,group,item].join('-'),path=[t.name,g.name,m.name],meta={top,group,item};add(id,m.name,path,{...meta,branch:m.children.length>0});
      m.children.forEach((name,leaf)=>add(id+'-'+leaf,name,[...path,name],{...meta,leaf,branch:false}));
    }
    return rows;
  }
  function canOpen(row,user){if(!user)return false;const permissions=user.permissions||[],can=p=>permissions.includes('*')||permissions.includes(p);if(row.top===1)return can(row.id==='1-0-2'?'integrations.manage':'config.read');if(row.top===2||row.top===0)return can('inventory.read');return user.kind!=='customer';}
  const normalize=s=>s.toLocaleLowerCase('ko-KR').replace(/\s+/g,'');
  function search(rows,query){const q=normalize(query.trim());if(!q)return [];return rows.filter(row=>normalize(row.path.join(' ')).includes(q)).sort((a,b)=>(normalize(a.name)===q?-1:normalize(b.name)===q?1:0));}
  function cleanState(value,rows){
    const ids=new Set(rows.map(row=>row.id));if(!value||typeof value!=='object')return {};
    const clean=key=>Array.isArray(value[key])?[...new Set(value[key].filter(id=>typeof id==='string'&&ids.has(id)))].slice(0,50):undefined;
    return {favorites:clean('favorites'),recent:clean('recent'),widgets:Array.isArray(value.widgets)?[...new Set(value.widgets.filter(id=>['calendar','approval','todo','updates'].includes(id)))]:undefined};
  }
  function calendar(year,month){
    const first=new Date(year,month,1).getDay(),length=new Date(year,month+1,0).getDate(),size=Math.ceil((first+length)/7)*7;
    return Array.from({length:size},(_,i)=>i>=first&&i<first+length?i-first+1:null);
  }
  const api={indexMenus,search,cleanState,calendar,canOpen};if(typeof module==='object'&&module.exports)module.exports=api;else root.MenuCore=api;
})(typeof globalThis==='object'?globalThis:this);
