/* autosync.js — keeps the app up to date without tapping Sync.
   - Every 60 seconds while the app is on screen, and straight away when you come back to it after 30+ seconds away.
   - Paused while the app is hidden (phone locked, another app in front) or offline.
   - Skipped while someone is busy: a form or sheet is open, the cursor is in a box, or the page holds unsaved
     work (Profile, Quote, Rates, Costs, Templates, Training, Register, Settings, a dog's feeding edit, the PIN screen).
     The next minute tries again.
   - Quiet: the Today list is not blanked to "Loading…", and cards do not replay their entrance animation.
   Each Sync is about 3 read requests (sync-fast.js), so 2 phones syncing every minute use ~6 of Google's ~60 per minute.
   Loaded after nav.js and motion.js. */
(function(){
  'use strict';
  const EVERY=60*1000,RETURN_AFTER=30*1000;
  const SAFE=['sc-board','sc-calendar','sc-bookings','sc-todo','sc-activities','sc-analysis','sc-pl','sc-feed','sc-checkdates'];
  let last=Date.now(),running=false;
  function busy(){
    if(document.visibilityState!=='visible'||navigator.onLine===false)return true;
    if(!localStorage.getItem('tcl_sid'))return true;
    const pin=document.getElementById('pinScreen');if(pin&&pin.classList.contains('active'))return true;
    if(document.querySelector('.modal.open,#tlScrim,#tlExtScrim'))return true;
    const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='button')return true;
    const sc=document.querySelector('.screen.active');if(!sc||!SAFE.includes(sc.id))return true;
    if(sc.id==='sc-feed'&&typeof _fvEdit!=='undefined'&&_fvEdit)return true;
    return false;
  }
  async function tick(force){
    if(running||typeof refreshBoard!=='function')return;
    if(busy())return;
    if(!force&&Date.now()-last<EVERY-2000)return;
    running=true;window.__tlQuiet=true;document.body.classList.add('tl-quiet');
    try{await refreshBoard();if(typeof window.tlExtRefresh==='function')window.tlExtRefresh(true);}catch(e){}
    finally{last=Date.now();running=false;window.__tlQuiet=false;setTimeout(()=>document.body.classList.remove('tl-quiet'),800);}
  }
  // a Sync the person starts (button) also counts as "synced", so the timer starts again from there
  const _rb=window.refreshBoard;
  if(typeof _rb==='function')window.refreshBoard=function(){const r=_rb.apply(this,arguments);Promise.resolve(r).finally(()=>{last=Date.now();});return r;};
  setInterval(()=>tick(false),5000);// checks every 5 s, syncs when a minute has passed
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-last>RETURN_AFTER)tick(true);});
  window.addEventListener('online',()=>tick(true));
  window.tlAutoSync={tick,busy,get last(){return last;}};
})();
