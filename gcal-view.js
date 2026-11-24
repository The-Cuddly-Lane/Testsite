/* gcal-view.js — show other Google Calendars inside the app's Calendar page (view only).
   Settings → Google Calendar → "Other calendars to show": add as many as you like (name + Calendar ID), remove with ×.
   The list is shared by all devices through the Rates tab (key tcl_viewcals).
   Each calendar must be shared with the service account; "See all event details" is enough.
   Their events appear as small coloured lines in the Month view and as a list in the Hour (day) view.
   Events the app itself puts in Google Calendar (bookings, meet & greets) are left out, so nothing shows twice.
   One read request per calendar per month shown; refreshed every minute with auto-sync. */
(function(){
  'use strict';
  if(typeof window.getCalToken!=='function')return;
  const KEY='tcl_viewcals';
  const PALETTE=['#64748B','#0EA5E9','#A855F7','#14B8A6','#E11D48','#CA8A04','#2563EB','#DB2777'];
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const list=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(c=>c&&c.id):[];}catch(e){return [];}};
  const colorOf=i=>PALETTE[i%PALETTE.length];

  // ---- shared list: read with the Rates tab during Sync (no extra request), saved back to Rates ----
  const _read=window.readSheet;
  window.readSheet=async function(tab,range){
    const r=await _read.apply(this,arguments);
    try{if(tab===TABS.RATES&&range==='A2:C'){const row=(r||[]).find(x=>x[0]===KEY);if(row)localStorage.setItem(KEY,row[1]||'[]');}}catch(e){}
    return r;
  };
  if(_read.fresh)window.readSheet.fresh=_read.fresh;
  async function saveList(arr){
    localStorage.setItem(KEY,JSON.stringify(arr));
    const rows=await (readSheet.fresh||readSheet)(TABS.RATES,'A2:C').catch(()=>[]);const idx=rows.findIndex(r=>r[0]===KEY);
    const vals=[KEY,JSON.stringify(arr),new Date().toISOString()];
    if(idx>=0)await updateRow(TABS.RATES,idx+2,vals);else await appendRow(TABS.RATES,vals);
  }

  // ---- reading events ----
  const cache=new Map();// calId|from|to -> {at, items, err}
  let gen=0;
  async function fetchCal(c,from,to){
    const t=await getCalToken();
    const q='?timeMin='+encodeURIComponent(from+'T00:00:00Z')+'&timeMax='+encodeURIComponent(to+'T23:59:59Z')+'&singleEvents=true&orderBy=startTime&maxResults=250&timeZone=Europe%2FLondon';
    const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(c.id)+'/events'+q,{headers:{Authorization:'Bearer '+t}});
    let d={};try{d=await r.json();}catch(e){}
    if(!r.ok){const m=(d.error&&d.error.message)||('HTTP '+r.status);
      throw new Error(r.status===404?'not found — check the ID and that it is shared with the service account':r.status===403?m+' — check the calendar is shared with the service account':m);}
    return (d.items||[]).filter(e=>e.status!=='cancelled'&&!(e.extendedProperties&&e.extendedProperties.private&&e.extendedProperties.private.tclType));
  }
  function monthRange(){const a=new Date(_calAnchor+'T12:00:00');const f=new Date(a.getFullYear(),a.getMonth(),1-7),l=new Date(a.getFullYear(),a.getMonth()+1,14);
    const s=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return [s(f),s(l)];}
  async function ensure(force){
    const cals=list();if(!cals.length)return false;
    const [from,to]=monthRange();const my=++gen;let changed=false;
    await Promise.all(cals.map(async c=>{const k=c.id+'|'+from+'|'+to;const hit=cache.get(k);
      if(hit&&!force&&Date.now()-hit.at<55000)return;
      try{const items=await fetchCal(c,from,to);const sig=JSON.stringify(items.map(e=>[e.id,e.updated]));if(!hit||hit.sig!==sig||hit.err)changed=true;cache.set(k,{at:Date.now(),items,sig});}
      catch(e){if(!hit||!hit.err)changed=true;cache.set(k,{at:Date.now(),items:hit&&!hit.err?hit.items:[],err:e.message});}}));
    return changed&&my===gen;
  }
  // every event, expanded to each day it covers: ds -> [{cal, idx, ev, time}]
  function byDay(){
    const cals=list();const [from,to]=monthRange();const out={};
    cals.forEach((c,i)=>{const hit=cache.get(c.id+'|'+from+'|'+to);if(!hit)return;
      hit.items.forEach(ev=>{
        let sd,ed,time='';
        if(ev.start&&ev.start.date){sd=ev.start.date;const e=new Date(ev.end.date+'T12:00:00');e.setDate(e.getDate()-1);ed=e.toISOString().slice(0,10);}
        else if(ev.start&&ev.start.dateTime){sd=ev.start.dateTime.slice(0,10);ed=(ev.end&&ev.end.dateTime||ev.start.dateTime).slice(0,10);time=ev.start.dateTime.slice(11,16);}
        else return;
        for(let d=new Date(sd+'T12:00:00'),n=0;n<62;n++,d.setDate(d.getDate()+1)){const ds=d.toISOString().slice(0,10);if(ds>ed)break;
          (out[ds]=out[ds]||[]).push({cal:c,idx:i,ev,time:ds===sd?time:''});}
      });});
    Object.values(out).forEach(a=>a.sort((x,y)=>(x.time||'').localeCompare(y.time||'')));
    return out;
  }
  let reg=[];// events shown, for the detail sheet
  function chip(o){const n=reg.push(o)-1;
    return '<span class="cal-dog tl-ext" style="color:'+colorOf(o.idx)+';" onclick="event.stopPropagation();tlExtOpen('+n+')" title="'+esc(o.cal.name+': '+(o.ev.summary||'(busy)'))+'">● '+(o.time?esc(o.time)+' ':'')+esc(o.ev.summary||'Busy')+'</span>';}

  // Month view: add the lines under each day's dogs (the cell already calls _mgChips(ds))
  const _mg=window._mgChips;
  if(typeof _mg==='function')window._mgChips=function(ds){
    const base=_mg.apply(this,arguments);const day=(window.__tlExtDays||{})[ds]||[];if(!day.length)return base;
    const shown=day.slice(0,3).map(chip).join('');
    return base+shown+(day.length>3?'<span class="cal-dog tl-ext" style="color:var(--gr2);">+'+(day.length-3)+' more</span>':'');
  };
  // Hour (day) view: list the day's events under the timeline
  const _slots=window._calSlotsHtml;
  if(typeof _slots==='function')window._calSlotsHtml=function(){
    const base=_slots.apply(this,arguments);const day=(window.__tlExtDays||{})[_calAnchor]||[];if(!day.length)return base;
    return base+'<div class="tl-ext-list"><div class="tl-ext-h">Other calendars</div>'+day.map(o=>{const n=reg.push(o)-1;
      return '<button class="tl-ext-row" onclick="tlExtOpen('+n+')"><i style="background:'+colorOf(o.idx)+'"></i><b>'+(o.time||'All day')+'</b><span>'+esc(o.ev.summary||'Busy')+'</span><small>'+esc(o.cal.name)+'</small></button>';}).join('')+'</div>';
  };
  const _rc=window.renderCalendar;
  window.renderCalendar=function(){reg=[];window.__tlExtDays=byDay();const r=_rc.apply(this,arguments);
    ensure(false).then(ch=>{if(ch&&document.getElementById('sc-calendar').classList.contains('active')){window.__tlExtDays=byDay();reg=[];_rc.apply(this,[]);}}).catch(()=>{});
    return r;};
  window.tlExtRefresh=function(force){ensure(!!force).then(ch=>{if(ch&&document.getElementById('sc-calendar').classList.contains('active'))window.renderCalendar();}).catch(()=>{});};

  // detail sheet
  window.tlExtOpen=function(n){const o=reg[n];if(!o)return;const ev=o.ev;
    const when=ev.start.date?(fmtDate(ev.start.date)+(ev.end&&ev.end.date&&o.ev.end.date!==ev.start.date?' → '+fmtDate(new Date(new Date(ev.end.date+'T12:00:00').getTime()-864e5).toISOString().slice(0,10)):'')+' · all day')
      :(fmtDate(ev.start.dateTime.slice(0,10))+' '+ev.start.dateTime.slice(11,16)+(ev.end&&ev.end.dateTime?' – '+(ev.end.dateTime.slice(0,10)!==ev.start.dateTime.slice(0,10)?fmtDate(ev.end.dateTime.slice(0,10))+' ':'')+ev.end.dateTime.slice(11,16):''));
    const s=document.createElement('div');s.className='tl-scrim';s.id='tlExtScrim';
    s.innerHTML='<div class="tl-sheet" role="dialog" aria-modal="true"><div class="tl-ext-cal"><i style="background:'+colorOf(o.idx)+'"></i>'+esc(o.cal.name)+' · view only</div><h2>'+esc(ev.summary||'Busy')+'</h2><p class="tl-ext-when">'+esc(when)+'</p>'+
      (ev.location?'<p>📍 '+esc(ev.location)+'</p>':'')+(ev.description?'<p class="tl-ext-desc">'+esc(String(ev.description).replace(/<[^>]+>/g,' ').slice(0,600))+'</p>':'')+
      (ev.htmlLink?'<p><a href="'+esc(ev.htmlLink)+'" target="_blank" rel="noopener">Open in Google Calendar ↗</a></p>':'')+'<button class="sbtn2" style="width:100%;margin-top:8px;" onclick="document.getElementById(\'tlExtScrim\').remove()">Close</button></div>';
    s.addEventListener('click',e=>{if(e.target===s)s.remove();});document.body.appendChild(s);};

  // ---- Settings: list + Add ----
  function renderSettings(){
    const host=document.getElementById('tlExtCals');if(!host)return;const cals=list();
    host.innerHTML='<div class="tl-ext-sh">Other calendars to show <span>(view only — share each with the service account, "See all event details")</span></div>'+
      (cals.length?cals.map((c,i)=>{const [from,to]=(typeof _calAnchor!=='undefined')?monthRange():['',''];const hit=cache.get(c.id+'|'+from+'|'+to);
        return '<div class="tl-ext-item"><i style="background:'+colorOf(i)+'"></i><div><b>'+esc(c.name)+'</b><small>'+esc(c.id)+(hit&&hit.err?' · <span style="color:var(--rd)">'+esc(hit.err)+'</span>':'')+'</small></div><button class="ib" title="Remove" data-rm="'+i+'">×</button></div>';}).join('')
        :'<div class="tl-ext-none">None yet.</div>')+
      '<div class="tl-ext-add" hidden><input class="si" id="tlExtName" placeholder="Name, e.g. Katie\'s days off"><input class="si" id="tlExtId" placeholder="Calendar ID, e.g. abc123@group.calendar.google.com"><div class="brow"><button class="sbtn" id="tlExtSave">Check and add</button><button class="sbtn grey" id="tlExtCancel" style="background:var(--gr5);color:var(--gr);">Cancel</button></div><span id="tlExtMsg"></span></div>'+
      '<button class="sbtn" id="tlExtAddBtn">＋ Add calendar</button>';
    host.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{const arr=list();const c=arr[+b.dataset.rm];if(!c||!confirm('Stop showing "'+c.name+'"? (Nothing is deleted in Google Calendar.)'))return;
      arr.splice(+b.dataset.rm,1);try{await saveList(arr);}catch(e){toast('Removed on this device only: '+e.message,'err');}renderSettings();if(typeof renderCalendar==='function'&&document.getElementById('sc-calendar').classList.contains('active'))renderCalendar();});
    const form=host.querySelector('.tl-ext-add'),addBtn=host.querySelector('#tlExtAddBtn');
    addBtn.onclick=()=>{form.hidden=false;addBtn.hidden=true;host.querySelector('#tlExtName').focus();};
    host.querySelector('#tlExtCancel').onclick=()=>{form.hidden=true;addBtn.hidden=false;};
    host.querySelector('#tlExtSave').onclick=async()=>{
      const name=host.querySelector('#tlExtName').value.trim(),id=host.querySelector('#tlExtId').value.trim(),msg=host.querySelector('#tlExtMsg');
      if(!id){msg.style.color='var(--rd)';msg.textContent='Paste the Calendar ID.';return;}
      if(list().some(c=>c.id===id)){msg.style.color='var(--rd)';msg.textContent='That calendar is already in the list.';return;}
      msg.style.color='var(--gr2)';msg.textContent='Checking…';
      try{const t=new Date().toISOString().slice(0,10);await fetchCal({id},t,t);}
      catch(e){msg.style.color='var(--rd)';msg.textContent='✗ Cannot read it: '+e.message;return;}
      const arr=list();arr.push({id,name:name||id.split('@')[0]});
      try{await saveList(arr);msg.textContent='';}catch(e){toast('Added on this device only: '+e.message,'err');}
      toast('Calendar added','ok');renderSettings();};
  }
  function mount(){
    const status=document.getElementById('calCfgStatus');if(!status||document.getElementById('tlExtCals'))return;
    const host=document.createElement('div');host.id='tlExtCals';host.className='tl-ext-settings';
    const after=status.nextElementSibling&&status.nextElementSibling.tagName==='SPAN'?status.nextElementSibling:status;// below "Add all upcoming bookings" result line
    after.after(host);renderSettings();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  if(typeof window.toggleSetup==='function'){const f=window.toggleSetup;window.toggleSetup=function(){const r=f.apply(this,arguments);mount();renderSettings();return r;};}
})();
