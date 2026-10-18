'use strict';
(async function(){
  const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const userScope=typeof AuthUI!=='undefined'?AuthUI.state().user?.id||'preview':'preview';
  const key='ecount-menu-local-v1'+(userScope==='owner'?'':':'+userScope),mapDialog=el('sitemap'),utilityDialog=el('utility-dialog');
  const widgetNames={calendar:'일정관리',approval:'전자결재',todo:'To Do',updates:'업그레이드 내역'};
  let tree,rows,byId,state,activeTop=null,activeGroup=0,current=null,opened=[],expanded=new Set(),toastTimer;
  let calendarYear=2026,calendarMonth=9,chosenDay=null,searchIndex=0,searchMatches=[];
  const tabManager=el('tab-manager');
  let tabHoverTimer,tabHoverBlockedUntil=0,selectedTabs=new Set();
  function toast(message){clearTimeout(toastTimer);el('toast').textContent=message;el('toast').hidden=false;toastTimer=setTimeout(()=>{el('toast').hidden=true;},2300);}
  function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{toast('브라우저 저장소를 사용할 수 없어 이번 화면에서만 유지됩니다.');}}
  function link(row,cls=''){
    const a=node('a',row.name,cls);a.href='#menu='+row.id;a.dataset.menu=row.id;a.addEventListener('click',event=>{event.preventDefault();openMenu(row.id);});return a;
  }
  function closeSearch(){el('search-results').hidden=true;el('menu-search').setAttribute('aria-expanded','false');}
  function mobileMenu(open){open=Boolean(open&&(window.matchMedia?.('(max-width:700px)').matches??true));document.body.classList.toggle('mobile-menu-open',open);el('mobile-menu-toggle').setAttribute('aria-expanded',String(open));}
  function chooseTop(index){activeTop=index;activeGroup=index===2?1:0;const items=tree[index].groups[activeGroup].items;const first=index===2?2:items.findIndex(item=>item.children.length);if(first>=0)expanded.add(`${index}-${activeGroup}-${first}`);renderNav();renderSide();mobileMenu(true);}
  function renderNav(){
    document.body.classList.toggle('nav-open',activeTop!==null);
    el('global-nav').replaceChildren(...tree.map((top,index)=>{
      const button=node('button',top.name,index===activeTop?'active':'');button.dataset.top=index;button.setAttribute('aria-pressed',String(index===activeTop));button.addEventListener('click',()=>{closeSearch();chooseTop(index);});return button;
    }));
    el('group-nav').hidden=activeTop===null;
    if(activeTop!==null)el('group-nav').replaceChildren(...tree[activeTop].groups.map((group,index)=>{
      const button=node('button',group.name,index===activeGroup?'active':'');button.dataset.group=index;button.addEventListener('click',()=>{activeGroup=index;renderNav();renderSide();mobileMenu(true);});return button;
    }));
  }
  function renderSide(){
    const sidebar=el('local-nav'),toggle=el('mobile-menu-toggle');sidebar.hidden=toggle.hidden=activeTop===null;if(activeTop===null){mobileMenu(false);return;}
    const group=tree[activeTop].groups[activeGroup];
    toggle.textContent='☰ '+group.name+' 메뉴';
    sidebar.replaceChildren(...group.items.map((item,index)=>{
      const id=`${activeTop}-${activeGroup}-${index}`,row=byId.get(id),section=node('section',undefined,'tree-section');
      if(item.children.length){
        const isOpen=expanded.has(id);
        const button=node('button',undefined,isOpen?'active':'');button.setAttribute('aria-expanded',String(isOpen));button.setAttribute('aria-label',item.name+' '+(isOpen?'접기':'펼치기'));button.append(node('span',isOpen?'⌄':'›','chevron'),node('span',item.name));
        button.addEventListener('click',()=>{if(isOpen)expanded.delete(id);else expanded.add(id);renderSide();});section.append(button);
        const list=node('div',undefined,'tree-children');list.hidden=!isOpen;
        item.children.forEach((name,li)=>list.append(link(byId.get(id+'-'+li),current===id+'-'+li?'selected':'')));section.append(list);
      }else{
        const button=link(row,current===id?'selected':'');button.style.display='block';button.style.padding='8px 12px';section.append(button);
      }
      return section;
    }));
  }
  function renderBookmarks(){
    el('bookmarks').replaceChildren(...state.favorites.map(id=>{const row=byId.get(id),a=link(row);a.title=row.path.join(' › ');return a;}));
    if(!state.favorites.length)el('bookmarks').append(node('span','메뉴의 ☆을 눌러 즐겨찾기를 등록하세요.'));
  }
  function toggleFavorite(id){
    const index=state.favorites.indexOf(id);if(index>=0)state.favorites.splice(index,1);else state.favorites.push(id);
    persist();renderBookmarks();if(current)renderMenuPage();toast(index>=0?'즐겨찾기에서 해제했습니다.':'즐겨찾기에 추가했습니다.');
  }
  function renderTabs(){
    const host=el('work-tabs');host.hidden=!opened.length;
    clearTimeout(tabHoverTimer);
    const tools=node('div',undefined,'work-tab-tools'),home=node('button','⌂ 메인');home.setAttribute('aria-label','작업 탭 메인');home.addEventListener('click',()=>homePage());
    const manage=node('button',`열린 작업 탭 (${opened.length})`,'tabs-manage');manage.id='tabs-manage';manage.setAttribute('aria-haspopup','dialog');manage.setAttribute('aria-controls','tab-manager');manage.setAttribute('aria-expanded',String(tabManager.open));manage.title='마우스를 올리거나 클릭해 작업 탭 정리';
    manage.addEventListener('click',showTabManager);
    manage.addEventListener('pointerenter',event=>{if(event.pointerType==='touch'||Date.now()<tabHoverBlockedUntil)return;clearTimeout(tabHoverTimer);tabHoverTimer=setTimeout(showTabManager,350);});
    manage.addEventListener('pointerleave',()=>clearTimeout(tabHoverTimer));
    const all=node('button','모두 닫기','tabs-close-all');all.id='tabs-close-all';all.addEventListener('click',()=>closeTabs(opened));
    tools.append(home,manage,node('span','|','tab-tool-divider'),all);
    const list=node('div',undefined,'work-tab-list');list.id='work-tab-list';list.setAttribute('role','tablist');list.setAttribute('aria-label','열린 메뉴');
    list.replaceChildren(...opened.map(id=>{
      const row=byId.get(id),wrap=node('div',undefined,'tab'+(id===current?' active':'')),button=node('button',row.name),close=node('button','×','tab-close');
      button.setAttribute('role','tab');button.setAttribute('aria-selected',String(current===id));button.dataset.tab=id;button.title=row.path.join(' › ');button.addEventListener('click',()=>openMenu(id));
      close.setAttribute('aria-label',row.name+' 탭 닫기');close.addEventListener('click',()=>closeTabs([id]));wrap.append(button,close);return wrap;
    }));
    host.replaceChildren(tools,list);
  }
  function updateTabSelection(){
    const count=opened.filter(id=>selectedTabs.has(id)).length,all=el('tab-select-all');
    all.checked=count===opened.length&&count>0;all.indeterminate=count>0&&count<opened.length;
    el('tab-selection-count').textContent=`${opened.length}개 중 ${count}개 선택`;
    el('tabs-close-selected').textContent=`선택한 ${count}개 닫기`;el('tabs-close-selected').disabled=count===0;
  }
  function showTabManager(){
    clearTimeout(tabHoverTimer);
    if(!opened.length||tabManager.open||document.querySelector('dialog[open]'))return;
    closeSearch();selectedTabs=new Set(opened);
    el('tab-manager-list').replaceChildren(...opened.map(id=>{
      const row=byId.get(id),label=node('label',undefined,'tab-manager-item'),input=node('input'),detail=node('span',undefined,'tab-manager-detail'),name=node('span',row.name,'tab-manager-name');
      input.type='checkbox';input.checked=true;input.dataset.closeTab=id;input.setAttribute('aria-label',row.path.join(' › ')+' 닫기 선택');
      input.addEventListener('change',()=>{if(input.checked)selectedTabs.add(id);else selectedTabs.delete(id);updateTabSelection();});
      if(id===current)name.append(node('small','현재 작업','tab-current-badge'));
      detail.append(name,node('small',row.path.slice(0,-1).join(' › '),'tab-manager-path'));label.append(input,detail);return label;
    }));
    updateTabSelection();tabManager.showModal();el('tabs-manage')?.setAttribute('aria-expanded','true');el('tab-select-all').focus();
  }
  function dismissTabManager(restoreFocus=true){
    clearTimeout(tabHoverTimer);
    if(tabManager.open){tabHoverBlockedUntil=Date.now()+800;tabManager.close();}el('tabs-manage')?.setAttribute('aria-expanded','false');
    if(restoreFocus)el('tabs-manage')?.focus({preventScroll:true});
  }
  function closeTabs(ids){
    const closing=new Set(ids.filter(id=>opened.includes(id)));if(!closing.size)return;
    const closesCurrent=current!==null&&closing.has(current),previousIndex=opened.indexOf(current);
    // Ask before changing the tab list. Cancelling must preserve every tab and field.
    if(closesCurrent&&InventoryUI.canNavigate&&!InventoryUI.canNavigate())return;
    const remaining=opened.filter(id=>!closing.has(id));
    const next=opened.slice(0,previousIndex).reverse().find(id=>!closing.has(id))||remaining[0];
    dismissTabManager(false);opened=remaining;
    if(closesCurrent){if(next)openMenu(next,true,true);else homePage(true,true);}
    else {renderTabs();el('tabs-manage')?.focus({preventScroll:true});}
    toast(`${closing.size}개 작업 탭을 닫았습니다.`);
  }
  function renderMenuPage(){
    const row=byId.get(current);if(!row)return;
    InventoryUI.beforeNavigate();
    const section=el('menu-page'),heading=node('div',undefined,'page-heading'),star=node('button',state.favorites.includes(row.id)?'★':'☆','favorite-toggle'+(state.favorites.includes(row.id)?' saved':''));
    star.setAttribute('aria-label',state.favorites.includes(row.id)?'즐겨찾기 해제':'즐겨찾기 등록');star.addEventListener('click',()=>toggleFavorite(row.id));
    const label=node('div');label.append(node('div',row.path.join('  ›  '),'breadcrumb'),node('h1',row.name));heading.append(star,label);
    if(typeof AuthUI!=='undefined'&&!MenuCore.canOpen(row,AuthUI.state().user)){section.replaceChildren(heading,node('p','이 화면에 필요한 앱 권한이 없습니다.','scope-card'));return;}
    if(typeof SelfUI!=='undefined'&&SelfUI.has(row)){section.replaceChildren(heading);section.classList.remove('inventory-page');section.dataset.route=current;SelfUI.render(section,row,{toast,open:openMenu});return;}
    if(typeof ApiUI!=='undefined'&&ApiUI.has(row)){section.replaceChildren(heading);section.dataset.route=current;section.classList.remove('inventory-page');ApiUI.render(section,row,{toast});return;}
    const inventoryRow=row.top===2?row:row.top===0?rows.find(r=>r.top===2&&!r.branch&&r.name===row.name):null;
    if(inventoryRow){section.replaceChildren(heading);section.dataset.route=current;section.classList.add('inventory-page');InventoryUI.render(section,inventoryRow,{rows,open:openMenu,toast});return;}
    section.classList.remove('inventory-page');
    const card=node('div',undefined,'scope-card');card.append(node('span','메뉴 연결 확인','scope-tag'),node('h2',row.name+' 메뉴를 열었습니다.'),node('p','이 화면은 메인·메뉴 탐색을 재현한 로컬 샘플입니다. 재고 I에서는 로컬 업무 자료를 등록하고 전표를 저장할 수 있습니다.'));
    if(row.branch){
      const related=node('div',undefined,'related-links');for(const child of rows.filter(r=>r.path.length===4&&r.path.slice(0,3).join('/')===row.path.join('/')))related.append(link(child));card.append(related);
    }else card.append(node('p','좌측 메뉴, 상단 업무 영역 또는 메뉴검색으로 다른 화면을 탐색할 수 있습니다.'));
    section.replaceChildren(heading,card);section.dataset.route=current;
  }
  function openMenu(id,record=true,navigationApproved=false){
    const row=byId.get(id);if(!row)return;if(!navigationApproved&&current!==id&&InventoryUI.canNavigate&&!InventoryUI.canNavigate())return;
    dismissTabManager(false);
    if(mapDialog.open)mapDialog.close();if(utilityDialog.open)utilityDialog.close();closeSearch();
    mobileMenu(false);current=id;activeTop=row.top;activeGroup=row.group;expanded.add(`${row.top}-${row.group}-${row.item}`);
    if(!opened.includes(id))opened.push(id);state.recent=[id,...state.recent.filter(x=>x!==id)].slice(0,20);persist();
    el('dashboard').hidden=true;el('menu-page').hidden=false;renderNav();renderSide();renderTabs();renderMenuPage();
    if(record)history.pushState(null,'','#menu='+id);el('main-content').focus({preventScroll:true});
  }
  function homePage(record=true,navigationApproved=false){
    if(!navigationApproved&&InventoryUI.canNavigate&&!InventoryUI.canNavigate())return;InventoryUI.beforeNavigate();dismissTabManager(false);
    current=null;activeTop=null;closeSearch();el('dashboard').hidden=false;el('menu-page').hidden=true;renderNav();renderSide();renderTabs();
    if(record)history.pushState(null,'',location.pathname);el('main-content').focus({preventScroll:true});
  }
  function searchMenus(){
    const query=el('menu-search').value;searchMatches=MenuCore.search(rows,query);searchIndex=0;
    const panel=el('search-results');panel.hidden=!query.trim();el('menu-search').setAttribute('aria-expanded',String(!panel.hidden));
    if(!query.trim())return;
    panel.replaceChildren(...searchMatches.slice(0,80).map((row,index)=>{const a=link(row,'search-result'+(index===searchIndex?' active':''));a.setAttribute('role','option');a.append(node('small',row.path.join(' › ')));return a;}));
    if(!searchMatches.length)panel.append(node('div','검색 결과가 없습니다.','search-empty'));
  }
  function renderMap(){
    el('sitemap-nav').replaceChildren(...tree.map((top,index)=>{const button=node('button',top.name,index===(activeTop??0)?'active':'');button.addEventListener('click',()=>{
      const target=el('map-section-'+index);el('sitemap-content').scrollTop=target.offsetTop;
      for(const btn of el('sitemap-nav').children)btn.classList.remove('active');button.classList.add('active');
    });return button;}));
    el('sitemap-content').replaceChildren(...tree.map((top,ti)=>{
      const section=node('section',undefined,'map-section');section.id='map-section-'+ti;section.append(node('h2',top.name));const columns=node('div',undefined,'map-columns');
      top.groups.forEach((group,gi)=>{const column=node('section',undefined,'map-group');column.append(node('h3',group.name));const items=node('div',undefined,'map-items');
        group.items.forEach((item,ii)=>{const id=`${ti}-${gi}-${ii}`;items.append(link(byId.get(id)));item.children.forEach((name,li)=>items.append(link(byId.get(id+'-'+li),'map-leaf')));});column.append(items);columns.append(column);
      });section.append(columns);return section;
    }));
  }
  function openMap(){closeSearch();renderMap();mapDialog.showModal();el('sitemap-content').scrollTop=0;}
  function showUtility(title,content){
    closeSearch();el('utility-title').textContent=title;el('utility-content').replaceChildren(...(Array.isArray(content)?content:[node('p',content)]));utilityDialog.showModal();
  }
  function recentMenus(){showUtility('최근 메뉴',state.recent.length?state.recent.map(id=>{const row=byId.get(id),a=link(row);a.append(node('small','  '+row.path.slice(0,-1).join(' › ')));return a;}):'최근에 연 메뉴가 없습니다.');}
  function renderCalendar(host){
    const table=node('table',undefined,'calendar');table.setAttribute('aria-label',`${calendarYear}년 ${calendarMonth+1}월 일정`);
    const header=node('tr');['일','월','화','수','목','금','토'].forEach((day,index)=>header.append(node('th',day,index===0?'sun':index===6?'sat':'')));const thead=node('thead');thead.append(header);table.append(thead);const body=node('tbody');
    const days=MenuCore.calendar(calendarYear,calendarMonth);
    for(let start=0;start<days.length;start+=7){const tr=node('tr');days.slice(start,start+7).forEach(day=>{
      const td=node('td',undefined,day===null?'blank':calendarYear===2026&&calendarMonth===9&&day===15?'today':'');
      if(day!==null){const button=node('button',String(day));button.setAttribute('aria-label',`${calendarMonth+1}월 ${day}일`);button.addEventListener('click',()=>{chosenDay=day;for(const cell of table.querySelectorAll('td'))cell.classList.remove('chosen');td.classList.add('chosen');toast(`${calendarYear}/${String(calendarMonth+1).padStart(2,'0')}/${String(day).padStart(2,'0')} · 등록된 일정이 없습니다.`);});if(chosenDay===day)td.classList.add('chosen');td.append(button);}tr.append(td);
    });body.append(tr);}table.append(body);host.append(table);
  }
  function moveWidget(id,delta){const before=state.widgets.indexOf(id),after=before+delta;if(before<0||after<0||after>=state.widgets.length)return;[state.widgets[before],state.widgets[after]]=[state.widgets[after],state.widgets[before]];persist();renderWidgets();}
  function renderWidgetPicker(){
    el('widget-options').replaceChildren(...Object.entries(widgetNames).map(([id,name])=>{const label=node('label'),input=document.createElement('input');input.type='checkbox';input.checked=state.widgets.includes(id);input.setAttribute('aria-label',name+' 위젯 표시');input.addEventListener('change',()=>{if(input.checked)state.widgets.push(id);else state.widgets=state.widgets.filter(x=>x!==id);persist();renderWidgets();});label.append(input,node('span',name));return label;}));
  }
  function renderWidgets(){
    renderWidgetPicker();
    el('widget-board').replaceChildren(...state.widgets.map(id=>{
      const widget=node('section',undefined,'widget');widget.dataset.widget=id;const header=node('div',undefined,'widget-head');
      if(id==='calendar'){
        const nav=node('div',undefined,'calendar-nav'),prev=node('button','‹'),next=node('button','›');prev.setAttribute('aria-label','이전 달');next.setAttribute('aria-label','다음 달');
        const change=amount=>{calendarMonth+=amount;if(calendarMonth<0){calendarMonth=11;calendarYear--;}if(calendarMonth>11){calendarMonth=0;calendarYear++;}chosenDay=null;renderWidgets();};prev.addEventListener('click',()=>change(-1));next.addEventListener('click',()=>change(1));
        nav.append(prev,node('strong',`${calendarYear}/${String(calendarMonth+1).padStart(2,'0')}`),next);header.append(nav);
      }
      header.append(node('h2',id==='updates'?'2026/10/08 업그레이드 내역':widgetNames[id]));
      const actions=node('div',undefined,'widget-actions');
      for(const [symbol,label,action] of [ ['↗','위젯 크게 보기',()=>showUtility(widgetNames[id],id==='calendar'?'일정은 로컬 달력에서 날짜를 선택해 확인할 수 있습니다.':'등록된 데이터가 없습니다.')],['↻','위젯 새로고침',()=>toast(widgetNames[id]+' 위젯을 새로고침했습니다.')],['‹','위젯 앞으로 이동',()=>moveWidget(id,-1)],['›','위젯 뒤로 이동',()=>moveWidget(id,1)],['×','위젯 숨기기',()=>{state.widgets=state.widgets.filter(x=>x!==id);persist();renderWidgets();}]] ){
        const button=node('button',symbol);button.setAttribute('aria-label',widgetNames[id]+' '+label);button.title=label;button.addEventListener('click',action);actions.append(button);
      }header.append(actions);const body=node('div',undefined,'widget-body');
      if(id==='calendar')renderCalendar(body);
      else if(id==='updates'){
        const copy=node('div',undefined,'update-copy');for(const [title,text] of [['Ⅰ. 공통','PDF 변환에서 전표별 파일 분리 저장 기능이 추가되었습니다.'],['Ⅱ. 회계','입금보고서의 오픈 API 제공 메뉴가 추가되었습니다.'],['Ⅲ. 재고','판매 입력화면의 항목설정과 유효거래 확인 기능이 개선되었습니다.']]){copy.append(node('strong',title),node('p',text));}body.append(copy);
      }else body.append(node('div','등록된 데이터가 없습니다.','widget-empty'));
      widget.append(header,body);return widget;
    }));
    if(!state.widgets.length)el('widget-board').append(node('p','My위젯선택에서 표시할 위젯을 선택하세요.'));
  }
  try{
    const response=await fetch('menus.json');if(!response.ok)throw new Error('메뉴 목록을 읽을 수 없습니다.');tree=await response.json();rows=MenuCore.indexMenus(tree);byId=new Map(rows.map(row=>[row.id,row]));
    let saved={};try{saved=MenuCore.cleanState(JSON.parse(localStorage.getItem(key)||'null'),rows);}catch{}
    const defaults=['품목등록','거래처등록','구매입력','판매입력','거래처별채권','거래처별채무','입금보고서','지출결의서','(세금)계산서진행단계'];
    state={favorites:saved.favorites??defaults.map(name=>rows.find(row=>row.name===name&&!row.branch)?.id).filter(Boolean),recent:saved.recent??[],widgets:saved.widgets??Object.keys(widgetNames)};
    el('scope-count').textContent=`10개 업무 영역 · 59개 그룹 · ${rows.length}개 메뉴 항목`;
    renderNav();renderBookmarks();renderWidgets();
    el('home-logo').addEventListener('click',()=>homePage());el('sitemap-open').addEventListener('click',openMap);el('sitemap-close').addEventListener('click',()=>mapDialog.close());
    el('mobile-menu-toggle').addEventListener('click',()=>mobileMenu(!document.body.classList.contains('mobile-menu-open')));
    document.addEventListener('pointerdown',event=>{if(!event.target.closest('#local-nav,#mobile-menu-toggle'))mobileMenu(false);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('mobile-menu-open')){mobileMenu(false);el('mobile-menu-toggle').focus();}});
    mapDialog.addEventListener('click',event=>{if(event.target===mapDialog){const rect=mapDialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)mapDialog.close();}});
    el('utility-close').addEventListener('click',()=>utilityDialog.close());
    el('tab-manager-dismiss').addEventListener('click',()=>dismissTabManager());el('tab-manager-cancel').addEventListener('click',()=>dismissTabManager());
    tabManager.addEventListener('cancel',event=>{event.preventDefault();dismissTabManager();});
    tabManager.addEventListener('click',event=>{if(event.target===tabManager){const rect=tabManager.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dismissTabManager();}});
    el('tab-select-all').addEventListener('change',event=>{selectedTabs=event.target.checked?new Set(opened):new Set();for(const input of el('tab-manager-list').querySelectorAll('input'))input.checked=selectedTabs.has(input.dataset.closeTab);updateTabSelection();});
    el('tabs-close-selected').addEventListener('click',()=>closeTabs([...selectedTabs]));
    el('widget-toggle').addEventListener('click',()=>{el('widget-picker').hidden=!el('widget-picker').hidden;el('widget-toggle').setAttribute('aria-expanded',String(!el('widget-picker').hidden));});
    el('widget-reset').addEventListener('click',()=>{state.widgets=Object.keys(widgetNames);persist();renderWidgets();toast('샘플 위젯 구성을 초기화했습니다.');});
    el('bookmark-collapse').addEventListener('click',()=>{document.body.classList.toggle('compact-bookmarks');el('bookmark-collapse').setAttribute('aria-label',document.body.classList.contains('compact-bookmarks')?'즐겨찾기 펼치기':'즐겨찾기 접기');});
    el('profile').addEventListener('click',()=>showUtility('계정 정보',typeof AuthUI!=='undefined'?[AuthUI.accountContent()]:'로그인 화면에서 접속 계정을 확인하세요.'));
    const focusSearch=()=>{el('menu-search').focus();searchMenus();};el('search-focus').addEventListener('click',focusSearch);
    el('menu-search').setAttribute('aria-controls','search-results');el('menu-search').addEventListener('input',searchMenus);el('menu-search').addEventListener('focus',searchMenus);
    el('menu-search').addEventListener('keydown',event=>{
      if(event.key==='Escape'){closeSearch();event.stopPropagation();return;}
      if(!searchMatches.length)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();searchIndex=(searchIndex+(event.key==='ArrowDown'?1:-1)+Math.min(searchMatches.length,80))%Math.min(searchMatches.length,80);[...el('search-results').children].forEach((item,index)=>item.classList.toggle('active',index===searchIndex));el('search-results').children[searchIndex]?.scrollIntoView({block:'nearest'});}
      else if(event.key==='Enter'){event.preventDefault();openMenu(searchMatches[searchIndex].id);}
    });
    document.addEventListener('click',event=>{if(!event.target.closest('.search-box')&&!event.target.closest('#search-results'))closeSearch();});
    document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!mapDialog.open&&!utilityDialog.open)focusSearch();}else if(event.key==='Escape')closeSearch();});
    for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{
      const name=button.dataset.tool;
      if(name==='최근 메뉴')recentMenus();else if(name==='위젯 선택'){homePage();el('widget-picker').hidden=false;}
      else if(name==='일정관리'){homePage();if(!state.widgets.includes('calendar')){state.widgets.unshift('calendar');persist();renderWidgets();}el('widget-board').querySelector('[data-widget="calendar"]').scrollIntoView({block:'nearest'});}
      else if(name==='전자결재')showUtility(name,'등록된 데이터가 없습니다.');
      else showUtility(name,'메뉴검색(Ctrl+K), 사이트맵, 즐겨찾기(☆), 업무 탭과 위젯을 사용할 수 있습니다. 이 샘플의 범위는 메인 화면과 메뉴 탐색입니다.');
    });
    const restoreRoute=()=>{const id=location.hash.startsWith('#menu=')?location.hash.slice(6):null;if(id&&byId.has(id))openMenu(id,false);else homePage(false);};window.addEventListener('popstate',restoreRoute);restoreRoute();
    document.body.dataset.ready='true';
    // Read-only observations for local QA. No access to the source ERP session.
    window.__menuTest={snapshot:()=>({menuCount:rows.length,topCount:tree.length,groups:tree.reduce((n,t)=>n+t.groups.length,0),current,activeTop,activeGroup,opened:[...opened],favorites:[...state.favorites],widgets:[...state.widgets],recent:[...state.recent],calendarYear,calendarMonth}),find:name=>rows.filter(row=>row.name===name).map(row=>({id:row.id,path:[...row.path]}))};
  }catch(error){console.error(error);el('main-content').replaceChildren(node('p','로컬 메뉴를 읽지 못했습니다. 서버와 menus.json 준비 상태를 확인하세요.','fatal'));}
})();
