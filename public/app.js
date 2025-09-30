// Fingerprint sederhana (localStorage)
function getFingerprint(){
  let fp = localStorage.getItem("fp");
  if(fp) return fp;
  const key = (navigator.userAgent||"")+`${screen.width}x${screen.height}`+Math.random();
  fp = 'fp_'+btoa(key).replace(/=/g,'').slice(0,32);
  localStorage.setItem("fp", fp);
  return fp;
}

// Load gallery (AJAX)
async function loadGallery(){
  const r = await fetch('/api/videos?limit=9');
  const j = await r.json();
  const g = document.getElementById('gallery');
  g.innerHTML = '';
  j.items.forEach(v=>{
    const el = document.createElement('div'); el.className = 'card tile';
    if(v.status==='files_deleted'){
      el.innerHTML = `<div class="badge err">File dihapus</div><div class="badge">${v.id}</div>`;
    }else{
      const src = v.srcMp4 || v.srcWebm || '';
      el.innerHTML = src
        ? `<video muted loop playsinline><source src="${src}" type="video/mp4"></video><div class="badge">${v.status}</div>`
        : `<div class="badge alt">processing...</div>`;
    }
    g.appendChild(el);
  });
  document.getElementById('totalCounter').innerText = j.total;
}

// Upload (AJAX) + polling status
async function uploadVideo(fd){
  const r = await fetch('/api/upload', { method:'POST', body: fd });
  return await r.json();
}
async function pollStatus(id){
  for(let i=0;i<600;i++){
    await new Promise(r=>setTimeout(r,2500));
    const r = await fetch('/api/status/'+id);
    if(!r.ok) continue;
    const j = await r.json();
    if(j.status==='done'){
      alert('Selesai! File: '+j.mp4);
      loadGallery();
      return;
    }else if(j.status==='failed'){
      alert('Gagal: '+(j.message||'processing error'));
      return;
    }
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadGallery();
  document.getElementById('btnReload').onclick = loadGallery;
  document.getElementById('uploadForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.append('fingerprint', getFingerprint());
    // Tambahkan token Turnstile jika widget aktif (id: cf-turnstile)
    const tsv = document.querySelector('textarea[name="cf-turnstile-response"]');
    if(tsv) fd.append('cf-turnstile-response', tsv.value || '');
    const res = await uploadVideo(fd);
    if(res.limited){ alert(res.msg); }
    else if(res.error){ alert(res.msg||'Error'); }
    else if(res.success){ alert('Upload diterima. Memproses...'); pollStatus(res.id); }
    e.target.reset();
  });
});
