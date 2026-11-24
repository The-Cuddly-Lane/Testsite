/* motion.js — the component-wall micro-interactions, applied to the app's real controls.
   Loaded last. Nothing here changes data or what a button does; it only adds movement:
   1. sliding indicators on segmented controls and tab rows (section chips, Settings, profile tabs,
      booking tabs, calendar view);
   2. a spring "pop" on the chip, tile or tick you just tapped (survives the list re-rendering);
   3. save buttons morph: spinner while saving → ✓ on success → shake if it failed;
   4. copy buttons flip to ✓;
   5. the Today numbers count up/down, the To-do badge bumps when it changes.
   Page, sheet, modal, toast and progress-bar entrances are pure CSS (polish.css). */
(function(){
  'use strict';
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. sliding indicators ---------- */
  const SEGS=[
    {sel:'#subTabs',active:'.subtab.active',kind:'pill'},
    {sel:'.tl-seg',active:'button[aria-pressed=true]',kind:'ink'},
    {sel:'.ptabs',active:'.ptab.active',kind:'line'},
    {sel:'.bk-tabs-row',active:'.bk-tab-active',kind:'line'},
    {sel:'.cal-views-row',active:'.cal-view-btn.active',kind:'ink'}
  ];
  // give the booking-tab and calendar-view rows a hook class (their markup has none)
  function tagRows(){
    const b=document.getElementById('bkTabBtn1');if(b&&b.parentElement)b.parentElement.classList.add('bk-tabs-row');
    const c=document.querySelector('.cal-view-btn');if(c&&c.parentElement)c.parentElement.classList.add('cal-views-row');
  }
  const last=new Map();// key -> {x,y,w,h}
  function place(ind,r){ind.style.width=r.w+'px';ind.style.height=r.h+'px';ind.style.transform='translate('+r.x+'px,'+r.y+'px)';}
  function syncAll(animate){
    tagRows();
    SEGS.forEach((cfg,ci)=>document.querySelectorAll(cfg.sel).forEach((c,k)=>{
      const a=c.querySelector(cfg.active);let ind=c.querySelector(':scope>.tl-ind');
      if(!a||!a.offsetWidth){if(ind)ind.style.opacity='0';return;}
      if(getComputedStyle(c).position==='static')c.style.position='relative';
      const key=ci+':'+(c.id||c.getAttribute('aria-label')||k);
      let r={x:a.offsetLeft,y:a.offsetTop,w:a.offsetWidth,h:a.offsetHeight};
      if(cfg.kind==='line')r={x:r.x,y:r.y+r.h-3,w:r.w,h:3};
      const prev=last.get(key);
      if(!ind){ind=document.createElement('i');ind.className='tl-ind tl-ind-'+cfg.kind;ind.setAttribute('aria-hidden','true');c.insertBefore(ind,c.firstChild);
        ind.style.transition='none';place(ind,prev||r);void ind.offsetWidth;ind.style.transition='';}
      c.classList.add('tl-has-ind');ind.style.opacity='1';
      if(c.scrollWidth>c.clientWidth+2){const L=a.offsetLeft,R=L+a.offsetWidth;if(L<c.scrollLeft||R>c.scrollLeft+c.clientWidth)c.scrollTo({left:Math.max(0,L-24),behavior:animate&&!reduce?'smooth':'auto'});}
      if(!animate||reduce){ind.style.transition='none';place(ind,r);void ind.offsetWidth;ind.style.transition='';}
      else place(ind,r);
      last.set(key,r);
    }));
  }
  const later=fn=>requestAnimationFrame(()=>requestAnimationFrame(fn));
  ['renderSubTabs','setCalView','switchBkTab','swPTab','showScreen','goToTab'].forEach(n=>{const f=window[n];if(typeof f!=='function')return;
    window[n]=function(){const r=f.apply(this,arguments);later(()=>syncAll(true));return r;};});
  window.addEventListener('resize',()=>syncAll(false));
  document.addEventListener('DOMContentLoaded',()=>later(()=>syncAll(false)));
  later(()=>syncAll(false));

  /* ---------- 2. pop on the thing you tapped ---------- */
  const POP='.af-chip,.hfb,.tpl-cat-btn,.tlc-chip,.tl-seg button,.subtab,.cal-view-btn,.ptab,.bk-tab-btn,#feedPageHost button,#pending_results [onclick],.cok,.ccan,.tlb-stat,.pin-key';
  function pop(el){if(!el||reduce)return;el.classList.remove('tl-pop');void el.offsetWidth;el.classList.add('tl-pop');el.addEventListener('animationend',()=>el.classList.remove('tl-pop'),{once:true});}
  document.addEventListener('click',e=>{
    const el=e.target.closest&&e.target.closest(POP);if(!el)return;
    const oc=el.getAttribute('onclick'),txt=el.textContent.trim().slice(0,40),cls=el.className;
    pop(el);
    // the list may re-render right after the click: find the new copy of the same control and pop that
    setTimeout(()=>{if(document.contains(el))return;let n=null;
      if(oc)n=[...document.querySelectorAll('[onclick]')].find(x=>x.getAttribute('onclick')===oc);
      if(!n)n=[...document.querySelectorAll(POP)].find(x=>x.className===cls&&x.textContent.trim().slice(0,40)===txt);
      pop(n);},0);
    later(()=>syncAll(true));
  });

  /* ---------- 3. save buttons: spinner → ✓ / shake ---------- */
  let lastBtn=null,lastAt=0;
  document.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('.sbtn2,.sbtn,.add-btn,.cok,.ebtn,.hbtn,.tl-act,button[onclick*="save"],button[onclick*="Save"],button[onclick*="submit"]');if(b){lastBtn=b;lastAt=Date.now();}},true);
  const SAVE=Object.keys(window).filter(k=>/^(save|submit|doAdd|doEdit|doCreateSheet|doDeleteBk|doCancelMG)/.test(k)&&typeof window[k]==='function');
  // a save that ends with an error toast (validation, "Nothing was saved") counts as failed, not ✓
  let lastErr=0;
  if(typeof window.toast==='function'){const t=window.toast;window.toast=function(msg,type){if(type==='err')lastErr=Date.now();return t.apply(this,arguments);};}
  SAVE.forEach(n=>{const f=window[n];window[n]=function(){
    const b=(Date.now()-lastAt<1500&&lastBtn&&document.contains(lastBtn)&&!lastBtn.classList.contains('tl-busy'))?lastBtn:null;
    const t0=Date.now();let r;try{r=f.apply(this,arguments);}catch(e){if(b)fail(b);throw e;}
    if(b&&r&&typeof r.then==='function'){b.classList.add('tl-busy');
      r.then(v=>{b.classList.remove('tl-busy');if(lastErr>=t0){fail(b);return;}if(v===false)return;done(b);},()=>{b.classList.remove('tl-busy');fail(b);});}
    else if(b){if(lastErr>=t0)fail(b);else done(b);}
    return r;};});
  function done(b){if(!document.contains(b))return;b.classList.add('tl-done');setTimeout(()=>b.classList.remove('tl-done'),1300);}
  function fail(b){if(!document.contains(b))return;b.classList.add('tl-fail');setTimeout(()=>b.classList.remove('tl-fail'),600);}

  /* ---------- 4. copy buttons ---------- */
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.cpbtn,.tpl-copy-btn');if(!b)return;
    b.classList.add('tl-copied');setTimeout(()=>b.classList.remove('tl-copied'),1400);});

  /* ---------- 5. numbers count, badge bumps ---------- */
  function countTo(el,from,to){if(reduce||from===to||!isFinite(from)){return;}
    const tn=[...el.childNodes].find(n=>n.nodeType===3);if(!tn)return;const t0=performance.now(),D=520;
    const step=t=>{const p=Math.min(1,(t-t0)/D),e=1-Math.pow(1-p,3);tn.nodeValue=String(Math.round(from+(to-from)*e));if(p<1)requestAnimationFrame(step);};
    tn.nodeValue=String(from);requestAnimationFrame(step);el.classList.remove('tl-pop');void el.offsetWidth;el.classList.add('tl-pop');}
  if(typeof window.renderBoardTop==='function'){const f=window.renderBoardTop;window.renderBoardTop=function(){
    const old=[...document.querySelectorAll('.tlb-stat b')].map(b=>parseInt(b.textContent,10));
    const r=f.apply(this,arguments);
    document.querySelectorAll('.tlb-stat b').forEach((b,i)=>{const n=parseInt(b.textContent,10);if(old.length&&isFinite(old[i])&&isFinite(n)&&old[i]!==n)countTo(b,old[i],n);});
    return r;};}
  let lastBadge=null;
  if(typeof window.updatePendingBadge==='function'){const f=window.updatePendingBadge;window.updatePendingBadge=function(){const r=f.apply(this,arguments);
    later(()=>{const b=document.querySelector('.tl-badge');const v=b?b.textContent:null;if(lastBadge!==null&&v!==lastBadge)document.querySelectorAll('.tl-badge').forEach(pop);lastBadge=v;});return r;};}
})();
