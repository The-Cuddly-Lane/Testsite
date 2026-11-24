/* gcal-bookings.js — bookings appear in the same Google Calendar as meet & greets (one way: app → Google).
   Uses the Calendar connection from Settings → Google Calendar (getCalId, _calReq, _calErr in app.js).
   - Saving a booking adds or updates its event; Quoted and Cancelled bookings have no event (removed if there was one).
   - Deleting a booking removes its event.
   - Settings → "Add all upcoming bookings" fills the calendar once for bookings made before this existed.
   - The event ID is kept in a new Bookings column, GCal_EventID (added automatically). The booking form never
     writes that column, so saving a booking cannot wipe it. Each event also carries the booking ID privately,
     so a lost event ID never creates a duplicate event.
   Loaded after safe-write.js and sync-fast.js. */
(function(){
  'use strict';
  if(typeof window._calReq!=='function'||typeof window.getCalId!=='function')return;
  const COL='GCal_EventID';
  const NO_EVENT=['Quoted','Cancelled','Canceled'];
  const COLOR={Boarding:'9',DayCare:'5','Drop-in':'7',Walking:'10',Training:'3','Pet Taxi':'6'};// Google's event colour IDs
  const ICON={Boarding:'🌙',DayCare:'☀️','Drop-in':'🚪',Walking:'🦮',Training:'🎓','Pet Taxi':'🚕'};

  // ---- keep the event ID on each booking object (the column is read with the rest of the Bookings tab) ----
  const _mapBk=window.mapBk;
  window.mapBk=function(r,i,h){const o=_mapBk.apply(this,arguments);if(o&&h&&h[COL]!=null)o.gcal=String(r[h[COL]]||'').replace(/^'/,'');return o;};

  const addDays=(ymd,n)=>{const p=ymd.split('-').map(Number);const d=new Date(Date.UTC(p[0],p[1]-1,p[2]+n));return d.toISOString().slice(0,10);};
  const T=t=>(typeof _fmtT==='function'?_fmtT(t):t);
  function eventBody(bk){
    const d=(typeof _dogByCid==='function'&&_dogByCid(bk.customerId))||null;
    const svc=(bk.svc||'').replace(/^[^A-Za-z0-9]+/,'').trim();
    const owner=d&&d.owner?d.owner:'';const phone=d&&d.phone?String(d.phone).replace(/^'/,''):'';
    const sd=bk.sd,ed=bk.ed||bk.sd;
    const desc=[
      svc+' · '+(typeof fmtDate==='function'?fmtDate(sd):sd)+(ed!==sd?' → '+(typeof fmtDate==='function'?fmtDate(ed):ed):''),
      'Dog: '+bk.dog+(bk.customerId?' ('+bk.customerId+')':''),
      owner?'Owner: '+owner:'',phone?'Phone: '+phone:'',
      bk.dropLoc?'Drop-off: '+bk.dropLoc:'',bk.pickLoc?'Pick-up: '+bk.pickLoc:'',
      'Status: '+(bk.status||''),'',
      'Booking '+bk.id+' — from The Cuddly Lane staff app. Edit the booking in the app: changes made here are not copied back.'
    ].filter((x,i,a)=>x||a[i-1]).join('\n');
    const body={summary:(ICON[svc]||'🐾')+' '+bk.dog+' · '+svc+(owner?' ('+owner.split(' ')[0]+')':''),description:desc,
      location:bk.dropLoc||'',colorId:COLOR[svc]||undefined,
      extendedProperties:{private:{tclType:'booking',tclId:String(bk.id)}}};
    const st=T(bk.st),et=T(bk.et);
    if(st&&(et||ed===sd)){
      body.start={dateTime:sd+'T'+st+':00',timeZone:MG_TZ};
      body.end=et?{dateTime:ed+'T'+et+':00',timeZone:MG_TZ}:{dateTime:_mgEndLocal(sd,st,60),timeZone:MG_TZ};
      if(body.end.dateTime<=body.start.dateTime)body.end={dateTime:_mgEndLocal(sd,st,60),timeZone:MG_TZ};
    }else{body.start={date:sd};body.end={date:addDays(ed,1)};}// all-day, end date is exclusive
    return body;
  }
  async function findByBookingId(id){
    const res=await _calReq('GET','/events?privateExtendedProperty='+encodeURIComponent('tclId='+id)+'&showDeleted=false&maxResults=5');
    if(res.status>=200&&res.status<300&&res.data.items&&res.data.items.length)return res.data.items[0].id;
    return '';
  }
  async function upsert(bk){
    const body=eventBody(bk);let eid=bk.gcal||'';
    if(!eid)eid=await findByBookingId(bk.id);
    if(eid){const res=await _calReq('PATCH','/events/'+encodeURIComponent(eid),{...body,status:'confirmed'});
      if(res.status>=200&&res.status<300&&res.data.id)return res.data.id;
      if(res.status!==404&&res.status!==410)throw _calErr(res);}// deleted by hand in Google Calendar → create it again
    const res=await _calReq('POST','/events',body);
    if(res.status>=200&&res.status<300&&res.data.id)return res.data.id;
    throw _calErr(res);
  }
  async function remove(eid){if(!eid)return;const res=await _calReq('DELETE','/events/'+encodeURIComponent(eid));
    if([200,204,404,410].includes(res.status))return;throw _calErr(res);}

  // ---- write event IDs into the Bookings tab (one request for any number of bookings) ----
  const colA1=j=>{let s='';j++;while(j>0){const m=(j-1)%26;s=String.fromCharCode(65+m)+s;j=Math.floor((j-1)/26);}return s;};
  async function writeIds(list){// list: [{id, eventId}]
    if(!list.length)return;
    const fresh=await (readSheet.fresh||readSheet)(TABS.BK,'A1:CZ');const fh=(fresh[0]||[]).map(x=>String(x||'').trim());
    const idCol=fh.indexOf('ID');if(idCol<0)throw new Error('Bookings tab has no ID column.');
    const data=[];let col=fh.indexOf(COL);
    if(col<0){col=fh.length;data.push({range:qTab(TABS.BK)+'!'+colA1(col)+'1',values:[[COL]]});if(typeof bkHdrRow!=='undefined'&&!bkHdrRow.includes(COL))bkHdrRow.push(COL);}
    list.forEach(({id,eventId})=>{const rows=[];for(let i=1;i<fresh.length;i++)if(String((fresh[i]||[])[idCol]||'').replace(/^'/,'').trim()===String(id))rows.push(i+1);
      if(rows.length===1)data.push({range:qTab(TABS.BK)+'!'+colA1(col)+rows[0],values:[[eventId||'']]});});
    const t=await getToken();
    const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values:batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'RAW',data})});
    const d=await r.json();if(d.error)throw new Error(d.error.message);
  }

  // one booking: add/update or remove its event, then remember the event ID
  async function syncOne(bk){
    if(!getCalId()||!bk||!bk.id||!bk.sd)return;
    if(NO_EVENT.includes(bk.status)){if(bk.gcal){await remove(bk.gcal);bk.gcal='';await writeIds([{id:bk.id,eventId:''}]);}return 'removed';}
    const eid=await upsert(bk);
    if(eid!==bk.gcal){bk.gcal=eid;await writeIds([{id:bk.id,eventId:eid}]);}
    return 'saved';
  }
  window.bkCalSyncOne=syncOne;

  // ---- after a booking is saved ----
  const _save=window.saveBk;
  window.saveBk=async function(){
    const eid=(document.getElementById('bm_eid')||{}).value||'';
    const before=new Set(bookings.map(b=>b.id));const prev=eid?bookings.find(b=>b.id===eid):null;const prevGcal=prev?prev.gcal||'':'';
    const r=await _save.apply(this,arguments);
    if(!getCalId())return r;
    const bk=eid?bookings.find(b=>b.id===eid):bookings.find(b=>!before.has(b.id));
    const ok=(document.getElementById('bkStatus')||{classList:{contains:()=>false}}).classList.contains('ok');
    if(!bk||!ok)return r;// the save did not happen
    if(prevGcal&&!bk.gcal)bk.gcal=prevGcal;// the saved row is rebuilt from the form, which has no event ID
    syncOne(bk).then(x=>{if(x==='saved')toast('Booking added to Google Calendar','ok');else if(x==='removed')toast('Removed from Google Calendar ('+bk.status+')','ok');})
      .catch(e=>toast('Booking saved, but Google Calendar was NOT updated: '+(e&&e.message||e),'err'));
    return r;
  };

  // ---- after a booking is deleted ----
  const _del=window.doDeleteBk;
  window.doDeleteBk=async function(){
    const bk=(typeof _delBkRi!=='undefined'&&_delBkRi?bookings.find(b=>b.ri===_delBkRi):null)||bookings.find(b=>b.id===(typeof _delBkId!=='undefined'?_delBkId:''));
    const eid=bk&&bk.gcal;const n=bookings.length;
    const r=await _del.apply(this,arguments);
    if(eid&&getCalId()&&bookings.length<n)remove(eid).then(()=>toast('Removed from Google Calendar','ok')).catch(e=>toast('Booking deleted, but its Google Calendar event could NOT be removed — delete it by hand. '+(e&&e.message||e),'err'));
    return r;
  };

  // ---- Settings: add every upcoming booking once ----
  async function pushAll(btn,out){
    if(!getCalId()){out.style.color='var(--rd)';out.textContent='Save a Calendar ID first.';return;}
    const today=todayStr();
    const list=bookings.filter(b=>b.id&&b.sd&&(b.ed||b.sd)>=today);
    if(!confirm('Add or update '+list.filter(b=>!NO_EVENT.includes(b.status)).length+' upcoming bookings in Google Calendar? Quoted and cancelled bookings are left out.'))return;
    btn.disabled=true;let ok=0,removed=0,fail=0;const ids=[];
    for(let i=0;i<list.length;i++){const bk=list[i];out.style.color='var(--gr2)';out.textContent='Working… '+(i+1)+' / '+list.length;
      try{if(NO_EVENT.includes(bk.status)){if(bk.gcal){await remove(bk.gcal);ids.push({id:bk.id,eventId:''});bk.gcal='';removed++;}continue;}
        const eid=await upsert(bk);if(eid!==bk.gcal){ids.push({id:bk.id,eventId:eid});bk.gcal=eid;}ok++;}
      catch(e){fail++;console.warn('Calendar',bk.id,e);}
      await new Promise(r=>setTimeout(r,120));}
    try{await writeIds(ids);}catch(e){fail++;out.style.color='var(--rd)';out.textContent='Events made, but their IDs could not be saved to the sheet: '+e.message;btn.disabled=false;return;}
    out.style.color=fail?'var(--rd)':'var(--gn)';out.textContent='✓ '+ok+' in Google Calendar'+(removed?', '+removed+' removed':'')+(fail?' · '+fail+' failed (see console)':'')+'.';
    btn.disabled=false;
  }
  function addButton(){
    const test=document.querySelector('#setupBar button[onclick="testCal()"]');if(!test||document.getElementById('gcalPushAll'))return;
    const b=document.createElement('button');b.className='sbtn';b.id='gcalPushAll';b.textContent='Add all upcoming bookings';
    const out=document.createElement('span');out.style.cssText='font-size:13px;display:block;margin-top:6px;';
    b.onclick=()=>pushAll(b,out);test.parentElement.appendChild(b);test.parentElement.after(out);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addButton);else addButton();
})();
