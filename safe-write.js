/* ============================================================================
   The Cuddly Lane: safer writes to the Google Sheet.
   Loaded after app.js. It replaces a few low-level helpers so that every
   existing save keeps working, but:

   1. Dogs and Bookings: only the cells that actually changed are written.
      v85 rewrote the whole row, which blanked every column the app does not
      know about (Email, WatchList, WF_MeetGreet, Manual_value_check ...) and
      could undo a change someone else had just made on another phone.
   2. Before writing, the row is found again by CustomerID / booking ID in a
      fresh read, so a moved or deleted row can never receive the wrong data.
      If the row cannot be found for certain, nothing is written and the
      person is asked to Sync.
   3. Deleting a booking clears the whole row (v85 cleared only A to Z), after
      checking it is the right booking.
   4. Trial-Log: the live sheet's result column is headed "Good"; the app
      called it "Suitable". Both names now work for reading and writing.
   5. Text that starts with = + - @ (for example "+1 cup at lunch") is saved
      as text instead of being turned into a formula.
   6. The Rates tab (prices, holidays, T&C version, Calendar ID) is created
      with its header row the first time something is saved to it.
   ============================================================================ */
(function(){
  if(typeof updateRow!=='function'||typeof readSheet!=='function'){console.warn('safe-write: app.js not loaded');return;}

  // ---------- 4 + 5: header alias and formula-safe text ----------
  const _mkHdr=mkHdr;
  window.mkHdr=function(row){const m=_mkHdr(row);if(m.Suitable===undefined&&m.Good!==undefined)m.Suitable=m.Good;return m;};
  const FORMULA_OK=v=>typeof VL_A!=='undefined'&&v===VL_A;          // the app's own DogName lookup formula
  function safeCell(v){
    if(typeof v!=='string'||!v)return v;
    if(FORMULA_OK(v))return v;
    if(/^[=+@]/.test(v)||(/^-/.test(v)&&!/^-\d+(\.\d+)?$/.test(v)))return "'"+v;
    return v;
  }
  window.safeCell=safeCell;
  const _rowFromMap=rowFromMap;
  window.rowFromMap=function(hdrRow,map,fallbackHdr){
    const h=(hdrRow&&hdrRow.length)?hdrRow:(fallbackHdr||[]);
    const m=Object.assign({},map);if(m.Good===undefined&&m.Suitable!==undefined)m.Good=m.Suitable;
    return _rowFromMap(h,m,fallbackHdr).map(safeCell);
  };

  // ---------- remember each row exactly as it was loaded, so we can tell what changed ----------
  // Kept by ID (not on the object) so copies of a record made elsewhere in the app still find it.
  const RAW=new Map();
  const rawKey=(isBk,id,ri)=>(isBk?'B|':'D|')+id+(ri?'|'+ri:'');
  function keepRaw(isBk,id,ri,row){if(!id)return;RAW.set(rawKey(isBk,id,ri),row);RAW.set(rawKey(isBk,id),row);}
  ['mapBk','mapDog'].forEach(name=>{const f=window[name];if(typeof f!=='function')return;const isBk=name==='mapBk';
    window[name]=function(r){const o=f.apply(this,arguments);try{if(o&&Array.isArray(r))keepRaw(isBk,String(isBk?o.id:o.cid||'').trim(),isBk?o.ri:o.rowIdx,r.slice());}catch(e){}return o;};});

  // ---------- which columns does the app own? ----------
  const probe=new Proxy({},{get:(t,k)=>k===Symbol.toPrimitive?undefined:''});
  function keysOf(fn){try{return new Set(Object.keys(fn(probe)||{}));}catch(e){return null;}}
  let DOG_KEYS=null,BK_KEYS=null;
  function ownedKeys(tab){
    if(tab===TABS.DOGS){if(!DOG_KEYS&&typeof dogToFieldMap==='function')DOG_KEYS=keysOf(dogToFieldMap);return DOG_KEYS;}
    if(tab===TABS.BK){if(!BK_KEYS&&typeof bkFieldMap==='function')BK_KEYS=keysOf(bkFieldMap);return BK_KEYS;}
    return null;
  }

  const AUTO_ADD=['WF_Selfie'];
  const colA1=j=>{let s='';j++;while(j>0){const m=(j-1)%26;s=String.fromCharCode(65+m)+s;j=Math.floor((j-1)/26);}return s;};
  const norm=v=>(v==null?'':String(v)).replace(/^'/,'').trim();

  async function batchCells(tab,data){
    const t=await getToken();
    const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values:batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'USER_ENTERED',data})});
    const d=await r.json();if(d.error)throw new Error(d.error.message);return d;
  }

  // Find the sheet row for this record in a fresh read. Prefers the cached row when it still holds the same ID.
  function locate(fresh,idCol,id,ri,tabLabel){
    if(idCol<0)throw new Error('The '+tabLabel+' tab has no ID column. Nothing was saved.');
    const at=i=>norm((fresh[i-1]||[])[idCol]);
    if(ri&&at(ri)===id)return ri;
    const hits=[];for(let i=2;i<=fresh.length;i++)if(at(i)===id)hits.push(i);
    if(hits.length===1)return hits[0];
    if(!hits.length)throw new Error('Could not find '+id+' in '+tabLabel+'. It may have been moved or deleted on another device. Tap Sync and try again. Nothing was saved.');
    throw new Error(id+' appears '+hits.length+' times in '+tabLabel+'. Tap Sync and try again, or fix the duplicate in the sheet. Nothing was saved.');
  }

  // ---------- 1 + 2: Dogs and Bookings write only the changed cells, after finding the row again ----------
  const _updateRow=updateRow;
  window.updateRow=async function(tab,ri,vals){
    const keys=ownedKeys(tab);
    if(!keys||!keys.size){
      // Log tabs: the row is remembered from the history list. Check it still belongs to the same dog before overwriting it.
      if(LOG_TABS().includes(tab)&&ri&&norm(vals&&vals[0])){
        const now=await readSheet(tab,'A'+ri+':A'+ri).catch(()=>[]);const got=norm((now[0]||[])[0]);
        if(got!==norm(vals[0]))throw new Error('That log row has changed in the sheet since it was loaded. Tap Sync and try again. Nothing was saved.');
      }
      return _updateRow(tab,ri,(vals||[]).map(safeCell));
    }
    const isBk=tab===TABS.BK;const cachedHdr=(isBk?bkHdrRow:dogsHdrRow)||[];const idName=isBk?'ID':'CustomerID';
    const newMap={};cachedHdr.forEach((h,i)=>{if(h&&keys.has(h))newMap[h]=vals[i];});
    const id=norm(newMap[idName]);
    const fresh=await readSheet(tab,'A1:CZ');const fh=fresh[0]||[];
    let row;
    if(id)row=locate(fresh,fh.indexOf(idName),id,ri,tab);
    else{ // record without an ID (old data): only trust the cached row if it still looks like the same record
      const nameCol=fh.indexOf('DogName');const cur=fresh[(ri||0)-1]||[];
      if(!ri||norm(cur[fh.indexOf(idName)])!==''||(nameCol>=0&&norm(cur[nameCol])!==norm(newMap.DogName)))throw new Error('This record has no ID and its row has changed. Tap Sync and try again. Nothing was saved.');
      row=ri;}
    // the record as it was when this device loaded it: lets us write only what this person changed
    const list=isBk?(typeof bookings!=='undefined'?bookings:[]):(typeof allDogs!=='undefined'?allDogs:[]);
    const rec=list.find(o=>o&&(isBk?(o.id===id&&(!ri||o.ri===ri)):o.cid===id))||list.find(o=>o&&(isBk?o.id===id:o.cid===id));
    const raw=RAW.get(rawKey(isBk,id,ri))||RAW.get(rawKey(isBk,id))||null;const base={};if(raw)cachedHdr.forEach((h,i)=>{if(h&&!(h in base))base[h]=raw[i];});
    const cur=fresh[row-1]||[];const data=[];
    // 7: columns the app saves to but the sheet does not have yet (only WF_Selfie for now) get a header added at the end
    if(rec&&isBk&&typeof bkFieldMap==='function'){try{const fm=bkFieldMap(rec);AUTO_ADD.forEach(h=>{if(!(h in newMap)&&fm[h]!==undefined)newMap[h]=fm[h];});}catch(e){}}
    AUTO_ADD.forEach(h=>{if(!(h in newMap)||fh.includes(h)||!norm(newMap[h]))return;const j=fh.length;fh.push(h);
      data.push({range:qTab(tab)+'!'+colA1(j)+'1',values:[[h]]});if(isBk&&typeof bkHdrRow!=='undefined'&&!bkHdrRow.includes(h))bkHdrRow.push(h);});
    fh.forEach((h,j)=>{
      if(!h||!(h in newMap))return;
      const nv=newMap[h];
      if(raw){if(norm(nv)===norm(base[h]))return;}          // this person did not change it: leave whatever is in the sheet now
      if(norm(nv)===norm(cur[j]))return;                     // already the same in the sheet
      data.push({range:qTab(tab)+'!'+colA1(j)+row,values:[[nv==null?'':nv]]});
    });
    if(data.length)await batchCells(tab,data);
    if(rec){if(isBk)rec.ri=row;else rec.rowIdx=row;}
    if(id)keepRaw(isBk,id,row,cachedHdr.map((h,i)=>vals[i]));
    return {updatedRange:qTab(tab)+'!A'+row,changedCells:data.length,row};
  };

  // ---------- 3: deleting a booking clears the whole row, after checking it is the right one ----------
  const LOG_TABS=()=>[TABS.DAILY,TABS.HEALTH,TABS.FIGHT,TABS.TRANSPORT,TABS.TRIAL,TABS.ACTLOG];
  const staffName=()=>{try{return localStorage.getItem('tcl_me')||'';}catch(e){return '';}};
  const _clearRow=clearRow;
  window.clearRow=async function(tab,ri){
    if(tab===TABS.COSTS){ // check the remembered row is still the same cost before clearing it
      const c=(typeof costs!=='undefined'?costs:[]).find(x=>x.ri===ri);
      if(c){const now=await readSheet(tab,'A'+ri+':D'+ri).catch(()=>[]);const r=now[0]||[];
        if(norm(r[0])!==norm(c.date)||Math.abs((parseFloat(String(r[2]).replace(/[^0-9.\-]/g,''))||0)-(+c.amount||0))>0.005)throw new Error('That cost row has changed in the sheet since it was loaded. Tap Sync and try again. Nothing was deleted.');}
      return _clearRow(tab,ri);
    }
    if(tab!==TABS.BK)return _clearRow(tab,ri);
    const rec=(typeof bookings!=='undefined'?bookings:[]).find(b=>b.ri===ri);
    const fresh=await readSheet(tab,'A1:CZ');const fh=fresh[0]||[];
    let row=ri;if(rec&&rec.id)row=locate(fresh,fh.indexOf('ID'),norm(rec.id),ri,tab);
    const last=colA1(Math.max(fh.length,(fresh[row-1]||[]).length,26)-1);
    const t=await getToken();
    const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'/values/'+encodeURIComponent(qTab(tab)+'!A'+row+':'+last+row)+':clear',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();if(d.error)throw new Error(d.error.message);return d;
  };

  // ---------- 6: create the Rates tab the first time it is needed ----------
  let _ratesOk=false;
  async function ensureTab(title,header){
    const t=await getToken();
    const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+'?fields=sheets.properties.title',{headers:{Authorization:'Bearer '+t}});
    const d=await r.json();if(d.error)throw new Error(d.error.message);
    if((d.sheets||[]).some(s=>s.properties&&s.properties.title===title))return;
    const a=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+getSID()+':batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({requests:[{addSheet:{properties:{title}}}]})});
    const ad=await a.json();if(ad.error)throw new Error(ad.error.message);
    await _updateRow(title,1,header);
  }
  const _appendRow=appendRow;
  window.appendRow=async function(tab,vals){
    if(tab===TABS.RATES&&!_ratesOk){await ensureTab(TABS.RATES,['Key','Value','UpdatedAt']);_ratesOk=true;}
    let v=(vals||[]).map(safeCell);
    // Activity-Log: fill Staff with the "I am" name when the app left it empty
    if(tab===TABS.ACTLOG&&staffName()&&typeof actlogHdrRow!=='undefined'){const si=actlogHdrRow.indexOf('Staff');if(si>=0&&!norm(v[si])){v=v.slice();while(v.length<=si)v.push('');v[si]=staffName();}}
    return _appendRow(tab,v);
  };
})();
