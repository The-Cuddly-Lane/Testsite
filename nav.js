/* ============================================================================
   The Cuddly Lane: new navigation shell (option A).
   Adds a bottom tab bar (phone), a sidebar (desktop), a "+" action sheet and
   Appearance / "I am" settings. It only CALLS the app's existing functions
   (goToTab, showScreen, startReg, openBkModal, openFeedAll, toggleSetup, ...):
   no data logic is changed and every v85 screen stays reachable.
   ============================================================================ */
(function(){
  const ICON={
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    book:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    check:'<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="m8 12 3 3 5-6"/>',
    more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    dog:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    bowl:'<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    quote:'<path d="M5 4h14v16l-3-2-3 2-3-2-3 2-2-1V4Z"/><path d="M9 9h6M9 13h6"/>',
    pound:'<path d="M17 20H7c2-1.5 2.5-3.5 2-6H6m3 0h6M9 14c-.7-3-1-5 .5-7.2C11 4.6 14 4.8 16 6.5"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    grad:'<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    sync:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/>'
  };
  const ic=(n,s)=>`<svg aria-hidden="true" width="${s||22}" height="${s||22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[n]||''}</svg>`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};

  // ---------- every place in the app, grouped (same entries as the old SECTIONS + the screens reached by buttons) ----------
  const go=(sec,k)=>()=>{closeSheet();if(typeof goToTab==='function')goToTab(sec,k);};
  const DEST=[
    {grp:'Dogs',items:[
      {id:'dogs',label:'Today & dogs',icon:'home',sc:'sc-board',run:go('dogs','dogs')},
      {id:'cal',label:'Calendar',icon:'cal',sc:'sc-calendar',run:go('dogs','cal')},
      {id:'bk',label:'Bookings',icon:'book',sc:'sc-bookings',run:go('dogs','bk')},
      {id:'act',label:'Activities',icon:'star',sc:'sc-activities',run:go('dogs','act')},
      {id:'feed',label:'Feeding board',icon:'bowl',sc:null,run:()=>{closeSheet();if(typeof openFeedAll==='function')openFeedAll();}},
      {id:'check',label:'Check dates',icon:'search',sc:'sc-checkdates',run:()=>{closeSheet();if(typeof goToTab==='function')goToTab('dogs','cal');if(typeof showScreen==='function')showScreen('sc-checkdates');}}]},
    {grp:'Customers',items:[
      {id:'todo',label:'To-do',icon:'check',sc:'sc-todo',run:go('customers','todo'),badge:true},
      {id:'tpl',label:'Templates',icon:'mail',sc:'sc-templates',run:go('customers','tpl')},
      {id:'quote',label:'Quote',icon:'quote',sc:'sc-quote',run:go('customers','quote')},
      {id:'rates',label:'Rates',icon:'pound',sc:'sc-rates',run:go('customers','rates')}]},
    {grp:'Business',items:[
      {id:'an',label:'Analysis',icon:'search',sc:'sc-analysis',run:go('business','an')},
      {id:'cost',label:'Costs',icon:'pound',sc:'sc-costs',run:go('business','cost')},
      {id:'pl',label:'P&L',icon:'chart',sc:'sc-pl',run:go('business','pl')},
      {id:'train',label:'Training',icon:'grad',sc:'sc-training',run:go('business','train')}]},
    {grp:'App',items:[
      {id:'settings',label:'Settings',icon:'gear',sc:null,run:()=>{closeSheet();openSettings();}},
      {id:'sync',label:'Sync with Google Sheet',icon:'sync',sc:null,run:()=>{closeSheet();if(typeof refreshBoard==='function')refreshBoard();}}]}
  ];
  const ALL=DEST.flatMap(g=>g.items);
  const byId=id=>ALL.find(x=>x.id===id);
  const TABS=[['dogs','Today'],['cal','Calendar'],['bk','Bookings'],['todo','To-do'],['more','More']];

  // which destination is showing now (profile/register count as Dogs, check dates as Calendar)
  function currentId(){
    const a=document.querySelector('.screen.active');const sc=a?a.id:'sc-board';
    const hit=ALL.find(x=>x.sc===sc);if(hit)return hit.id;
    if(sc==='sc-profile'||sc==='sc-register')return 'dogs';
    if(sc==='sc-business')return 'an';
    return 'dogs';
  }
  function pendingCount(){const b=document.getElementById('pendingBadge');if(!b||b.style.display==='none')return 0;const n=parseInt((b.textContent||'').replace(/\D/g,''),10);return isNaN(n)?0:n;}

  function render(){
    try{if(typeof renderBoardTop==='function')renderBoardTop();}catch(e){}
    const cur=currentId();const n=pendingCount();
    const moreIds=ALL.map(x=>x.id).filter(id=>!TABS.some(t=>t[0]===id));
    const tabs=document.getElementById('tlTabs');
    if(tabs)tabs.innerHTML=TABS.map(([id,l])=>{const on=id==='more'?moreIds.includes(cur):cur===id;const it=byId(id);
      return `<button class="tl-tab" data-tl="${id}"${on?' aria-current="page"':''}>${ic(id==='more'?'more':it.icon)}<span>${l}</span>${id==='todo'?`<span class="tl-badge" style="display:${n?'flex':'none'}">${n}</span>`:''}</button>`;}).join('');
    const side=document.getElementById('tlSide');
    if(side){const me=store.get('tcl_me');
      side.innerHTML=`<div class="tl-brand">The Cuddly Lane<small>${me?'Staff · '+esc(me):'Staff portal'}</small></div>`+DEST.map(g=>`<div class="tl-grp">${g.grp}</div>`+g.items.map(it=>`<button class="tl-item" data-tl="${it.id}"${cur===it.id?' aria-current="page"':''}>${ic(it.icon,19)}<span>${esc(it.label)}</span>${it.badge?`<span class="tl-badge" style="display:${n?'inline-flex':'none'}">${n}</span>`:''}</button>`).join('')).join('');}
  }

  // ---------- sheets ----------
  function openSheet(html){closeSheet();const s=document.createElement('div');s.className='tl-scrim';s.id='tlScrim';s.innerHTML=`<div class="tl-sheet" role="dialog" aria-modal="true">${html}</div>`;
    s.addEventListener('click',e=>{if(e.target===s)closeSheet();});document.body.appendChild(s);const f=s.querySelector('button');if(f)f.focus();}
  function closeSheet(){const s=document.getElementById('tlScrim');if(s)s.remove();}
  function moreSheet(){
    openSheet(`<h2>More</h2>`+DEST.map(g=>`<div class="tl-grp-s">${g.grp}</div>`+g.items.filter(it=>!TABS.some(t=>t[0]===it.id)).map(it=>`<button class="tl-act" data-tl="${it.id}"><i>${ic(it.icon,20)}</i><span>${esc(it.label)}</span></button>`).join('')).join(''));
  }
  const ACTIONS=[
    {label:'Meet & greet',sub:'New enquiry or existing dog',icon:'dog',run:()=>{if(typeof openMG==='function')openMG();}},
    {label:'Register a new dog',sub:'Full profile',icon:'dog',run:()=>{if(typeof startReg==='function')startReg();}},
    {label:'New booking',sub:'Boarding, daycare, walks',icon:'book',run:()=>{if(typeof openBkModal==='function')openBkModal();}},
    {label:'Quote',sub:'Price a stay for WhatsApp',icon:'quote',run:()=>{if(typeof goToTab==='function')goToTab('customers','quote');}},
    {label:'Check dates',sub:'Space and overlaps',icon:'search',run:()=>byId('check').run()},
    {label:'Feeding board',sub:'Meals, walks and meds',icon:'bowl',run:()=>{if(typeof openFeedAll==='function')openFeedAll();}}];
  function addSheet(){openSheet(`<h2>Add</h2>`+ACTIONS.map((a,i)=>(i===0&&typeof openMG!=='function')?'':`<button class="tl-act" data-tlact="${i}"><i>${ic(a.icon,20)}</i><span>${esc(a.label)}<small>${esc(a.sub)}</small></span></button>`).join(''));}

  // ---------- settings: appearance + I am ----------
  function applyTheme(){const t=store.get('tcl_theme')||'auto';const dark=t==='dark'||(t==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';const m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',dark?'#1A1716':'#F7F5F2');}
  const STAFF=['Katie','Osbert'];
  function settingsExtras(){
    const bar=document.getElementById('setupBar');if(!bar)return;let box=document.getElementById('tlSettings');
    if(!box){box=document.createElement('div');box.id='tlSettings';box.style.cssText='margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--gr4);display:flex;flex-wrap:wrap;gap:4px 24px;';bar.insertBefore(box,bar.firstChild);}
    const t=store.get('tcl_theme')||'auto';const me=store.get('tcl_me')||'';
    box.innerHTML=`<div><div class="tl-lbl">Appearance</div><div class="tl-seg" role="group" aria-label="Appearance">${[['light','Light'],['dark','Dark'],['auto','Auto']].map(([k,l])=>`<button data-tltheme="${k}" aria-pressed="${t===k}">${l}</button>`).join('')}</div></div>
      <div><div class="tl-lbl">I am <span style="font-weight:400;color:var(--gr2)">(this device)</span></div><div class="tl-seg" role="group" aria-label="I am">${STAFF.map(n=>`<button data-tlme="${n}" aria-pressed="${me===n}">${n}</button>`).join('')}</div></div>`;
  }
  function openSettings(){const bar=document.getElementById('setupBar');if(bar&&!bar.classList.contains('open')&&typeof toggleSetup==='function')toggleSetup();settingsExtras();const m=document.getElementById('mainScroll');if(bar)bar.scrollIntoView({block:'start'});}

  // ---------- events ----------
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-tl],[data-tlact],[data-tltheme],[data-tlme],#tlFab');if(!t)return;
    if(t.id==='tlFab'){addSheet();return;}
    if(t.dataset.tlact!==undefined){closeSheet();ACTIONS[+t.dataset.tlact].run();return;}
    if(t.dataset.tltheme){store.set('tcl_theme',t.dataset.tltheme);applyTheme();settingsExtras();return;}
    if(t.dataset.tlme){store.set('tcl_me',t.dataset.tlme);settingsExtras();render();return;}
    const id=t.dataset.tl;if(id==='more'){moreSheet();return;}const it=byId(id);if(it)it.run();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});

  // keep the tabs in step with the app: after any screen change, and when the to-do badge changes
  function wrap(name){const f=window[name];if(typeof f!=='function'||f._tlWrapped)return;const w=function(){const r=f.apply(this,arguments);try{render();}catch(e){}return r;};w._tlWrapped=true;window[name]=w;}
  ['showScreen','goToTab','switchSection','goSub','goBack','updatePendingBadge','toggleSetup'].forEach(wrap);
  const _ts=window.toggleSetup;window.toggleSetup=function(){const r=_ts.apply(this,arguments);settingsExtras();return r;};

  // ---------- which spreadsheet is this device connected to? ----------
  // Reads the sheet's own title from Google. A title containing "test" is treated as the test copy;
  // anything else is shown as LIVE DATA in red, so nobody tests against Katie and Osbert's real sheet by accident.
  let _sheetSeq=0;
  function sheetBar(state,title){
    let bar=document.getElementById('tlSheetBar');
    if(!bar){bar=document.createElement('div');bar.id='tlSheetBar';bar.setAttribute('role','status');const h=document.querySelector('.hdr');if(h&&h.parentNode)h.parentNode.insertBefore(bar,h.nextSibling);else document.body.prepend(bar);}
    bar.className='tl-sheet-bar tl-sheet-'+state;
    const txt={test:'Test sheet',live:'LIVE DATA',none:'Not connected',unknown:'Sheet not checked'}[state];
    const tail={live:' · changes here affect the real customer records',none:' · add the Spreadsheet ID in Settings',unknown:' · tap Sync to check'}[state]||'';
    bar.innerHTML=`<strong>${txt}</strong>${title?' · '+esc(title):''}<span class="tl-sheet-tail">${tail}</span>`;
    const side=document.getElementById('tlSide');if(side){const b=side.querySelector('.tl-brand small');if(b)b.dataset.sheet=state;}
  }
  async function checkSheet(){
    const seq=++_sheetSeq;const sid=typeof getSID==='function'?getSID():'';
    if(!sid){sheetBar('none','');return;}
    try{
      const t=await getToken();
      const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sid)+'?fields=properties.title',{headers:{Authorization:'Bearer '+t}});
      const d=await r.json();if(seq!==_sheetSeq)return;
      const title=d&&d.properties&&d.properties.title;
      if(!title){sheetBar('unknown','');return;}
      sheetBar(/test/i.test(title)?'test':'live',title);
    }catch(e){if(seq===_sheetSeq)sheetBar('unknown','');}
  }
  // Text size buttons in Settings: show which one is in use
  function markZoom(){const z=parseFloat(localStorage.getItem('tcl_zoom')||'')||(typeof getZoom==='function'?getZoom():1);document.querySelectorAll('#setupBar button[onclick^="setZoom"]').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/setZoom\(([\d.]+)\)/);b.classList.toggle('tl-on',!!m&&Math.abs(parseFloat(m[1])-z)<0.01);});}
  if(typeof window.setZoom==='function'){const _sz=window.setZoom;window.setZoom=function(){const r=_sz.apply(this,arguments);markZoom();return r;};}
  markZoom();
  ['refreshBoard','saveConfig'].forEach(name=>{const f=window[name];if(typeof f!=='function')return;const seen=new WeakSet();window[name]=function(){const r=f.apply(this,arguments);if(r&&typeof r==='object'){if(seen.has(r))return r;seen.add(r);}Promise.resolve(r).finally(()=>checkSheet());return r;};});

  function boot(){
    applyTheme();
    if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);
    if(!document.getElementById('tlTabs')){
      const nav=document.createElement('nav');nav.className='tl-tabs';nav.id='tlTabs';nav.setAttribute('aria-label','Main');document.body.appendChild(nav);
      const side=document.createElement('nav');side.className='tl-side';side.id='tlSide';side.setAttribute('aria-label','Main');document.body.appendChild(side);
      const fab=document.createElement('button');fab.className='tl-fab';fab.id='tlFab';fab.setAttribute('aria-label','Add');fab.innerHTML=ic('plus',26);document.body.appendChild(fab);
    }
    // v85 counts to-dos into #pendingBadge but has no such element on the page; add a hidden one so the tab badge can show the count.
    if(!document.getElementById('pendingBadge')){const h=document.createElement('div');h.hidden=true;h.innerHTML='<span id="pendingBadge" style="display:none"></span>';document.body.appendChild(h);}
    settingsExtras();render();checkSheet();
    try{if(typeof updatePendingBadge==='function')updatePendingBadge();}catch(e){}
    const pb=document.getElementById('pendingBadge');if(pb&&window.MutationObserver)new MutationObserver(render).observe(pb,{childList:true,characterData:true,subtree:true,attributes:true});
  }
  applyTheme();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
