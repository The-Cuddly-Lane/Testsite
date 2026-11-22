/* sync-fast.js — fewer Google Sheets read requests per Sync.
   Google allows about 60 read requests per minute per user. A Sync used to send one request per tab
   (about 15), and the app started the Sync twice on every page load, so two or three reloads in a minute
   hit "Quota exceeded". This file:
   1. lets only one Sync run at a time (a second call joins the one already running);
   2. reads every tab the Sync needs in ONE batchGet request (plus one small request for the tab list),
      then hands each result to the existing code; anything not prefetched is read as before;
   3. turns Google's quota error into a plain message.
   Loaded after app.js and safe-write.js, before nav.js. */
(function(){
  'use strict';
  const SYNC_RANGES=[['Dogs','A1:CZ'],['Bookings','A1:BZ'],['Costs','A1:D'],['Activity-Log','A1:G'],['Trial-Log','A1:G'],
    ['Daily-Log','A1:R'],['Staff-Training','A2:K'],['Health-Log','A1:Z1'],['Fight-Log','A1:Z1'],['Transport-Log','A1:Z1'],
    ['Activities','A1:Z1'],['Activities','A2:K'],['Meet-Greets','A1:M'],['Targets','A2:C'],['Rates','A2:C']];
  const key=(tab,range)=>qTab(tab)+'!'+range;
  let cache=null; // Map key -> values, only while a Sync is running; each entry is used once
  const API='https://sheets.googleapis.com/v4/spreadsheets/';
  const friendly=e=>{const m=String(e&&e.message||e);return /quota/i.test(m)?new Error('Google is limiting how often the app can read the sheet. Wait a minute, then tap Sync.'):e;};

  const _read=window.readSheet;
  window.readSheet=async function(tab,range){
    if(cache){const k=key(tab,range);if(cache.has(k)){const v=cache.get(k);cache.delete(k);return v.map(r=>r.slice());}}
    try{return await _read.apply(this,arguments);}catch(e){throw friendly(e);}
  };
  // safe-write.js re-reads a tab right before writing; that read must always come from the sheet, never the Sync cache
  window.readSheet.fresh=async function(){try{return await _read.apply(this,arguments);}catch(e){throw friendly(e);}};

  async function prefetch(){
    const t=await getToken(),sid=getSID();if(!sid)return null;
    const meta=await (await fetch(API+sid+'?fields=sheets.properties.title',{headers:{Authorization:'Bearer '+t}})).json();
    if(meta.error)throw friendly(new Error(meta.error.message));
    const have=new Set((meta.sheets||[]).map(s=>s.properties&&s.properties.title));
    const want=SYNC_RANGES.filter(([tab])=>have.has(tab));if(!want.length)return null;
    const qs=want.map(([tab,r])=>'ranges='+encodeURIComponent(key(tab,r))).join('&');
    const d=await (await fetch(API+sid+'/values:batchGet?'+qs,{headers:{Authorization:'Bearer '+t}})).json();
    if(d.error)throw friendly(new Error(d.error.message));
    const m=new Map();(d.valueRanges||[]).forEach((vr,i)=>{if(want[i])m.set(key(want[i][0],want[i][1]),vr.values||[]);});
    return m;
  }

  const _refresh=window.refreshBoard;let running=null;
  window.refreshBoard=function(){
    if(running)return running;
    running=(async()=>{
      try{cache=await prefetch();}catch(e){cache=null;console.warn('Prefetch skipped:',e&&e.message);} // fall back to one request per tab
      try{return await _refresh.apply(this,arguments);}finally{cache=null;}
    })().finally(()=>{running=null;});
    return running;
  };
})();
