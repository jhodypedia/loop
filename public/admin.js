function showTab(id){['tab-overview','tab-videos','tab-subs','tab-settings'].forEach(t=>{document.getElementById(t).style.display=(t===id?'block':'none');});}

async function loadMetrics(){
  const r=await fetch('/admin/api/metrics'); const j=await r.json();
  document.getElementById('met-total').textContent=j.total;
  document.getElementById('met-done').textContent=j.done;
  document.getElementById('met-deleted').textContent=j.deleted;
}
async function loadVideos(){
  const r=await fetch('/admin/api/videos'); const j=await r.json();
  const body=document.getElementById('videosBody'); body.innerHTML='';
  j.items.forEach(v=>{
    const tr=document.createElement('tr'); tr.className='tr';
    tr.innerHTML=`<td class="td">${v.id}</td>
      <td class="td"><span class="badge ${v.status==='done'?'ok':(v.status==='files_deleted'?'err':'alt')}">${v.status}</span></td>
      <td class="td">${v.loopSeconds}s → ${v.totalSeconds}s</td>
      <td class="td">${v.status!=='files_deleted'?`<button class="btn danger" data-purge="${v.id}">Purge</button>`:'-'}</td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('[data-purge]').forEach(b=>{
    b.onclick = async ()=>{
      if(!confirm('Hapus file fisik?')) return;
      const r=await fetch('/admin/api/videos/'+b.dataset.purge+'/purge',{method:'POST'});
      const j=await r.json(); if(j.success){ alert('Purged'); loadVideos(); } else alert('Gagal');
    };
  });
}
async function loadSubs(){
  const r=await fetch('/admin/api/subscriptions'); const j=await r.json();
  const body=document.getElementById('subsBody'); body.innerHTML='';
  j.forEach(s=>{
    const tr=document.createElement('tr'); tr.className='tr';
    tr.innerHTML=`<td class="td">${s.fingerprint}</td><td class="td">${s.status}</td><td class="td">${s.expireAt||'-'}</td>`;
    body.appendChild(tr);
  });
}
async function loadSettings(){
  const r=await fetch('/admin/api/settings'); const s=await r.json();
  // defaults
  document.getElementById('setDefSec').value=s.default_seconds||5;
  document.getElementById('setDefW').value=s.default_width||1280;
  document.getElementById('setDefFps').value=s.default_fps||30;
  // turnstile
  document.getElementById('setTsSite').value=s.turnstile_site_key||'';
  document.getElementById('setTsSecret').value=s.turnstile_secret_key||'';
  document.getElementById('setTsEnabled').value=s.turnstile_enabled||'0';
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-tab]').forEach(b=> b.onclick=()=>showTab(b.dataset.tab));
  showTab('tab-overview');
  loadMetrics(); loadVideos(); loadSubs(); loadSettings();

  document.getElementById('refreshVideos').onclick = loadVideos;

  document.getElementById('btnActivateSub').onclick = async ()=>{
    const fingerprint=document.getElementById('subFp').value.trim();
    const days=+document.getElementById('subDays').value||30;
    if(!fingerprint) return alert('Fingerprint kosong');
    const r=await fetch('/admin/api/subscriptions/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint,days})});
    const j=await r.json(); if(j.success){ alert('Subscription aktif'); loadSubs(); } else alert('Gagal');
  };

  document.getElementById('btnSaveSettings').onclick = async ()=>{
    const payload={
      default_seconds: document.getElementById('setDefSec').value,
      default_width: document.getElementById('setDefW').value,
      default_fps: document.getElementById('setDefFps').value,
      turnstile_site_key: document.getElementById('setTsSite').value,
      turnstile_secret_key: document.getElementById('setTsSecret').value,
      turnstile_enabled: document.getElementById('setTsEnabled').value
    };
    const r=await fetch('/admin/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json(); alert(j.success?'Tersimpan':'Gagal simpan');
  };
});
