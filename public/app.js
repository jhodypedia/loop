/* =========================================================
   LoopLab - Frontend App (public/app.js)
   ========================================================= */

/* ==========================
   Fingerprint nyata
   (UserAgent + Screen + Timezone + Canvas + Audio)
   ========================== */
async function getFingerprint() {
  let fp = localStorage.getItem("fp");
  if (fp) return fp;

  const ua = navigator.userAgent || "ua";
  const screenRes = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "tz");

  // Canvas FP
  let canvasHash = "";
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "16px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText("LoopLabFP", 2, 15);
    canvasHash = c.toDataURL();
  } catch { canvasHash = "nocanvas"; }

  // Audio FP
  let audioHash = "";
  try {
    const ACtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const actx = new ACtx(1, 44100, 44100);
    const osc = actx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(10000, actx.currentTime);
    const comp = actx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, actx.currentTime);
    comp.knee.setValueAtTime(40, actx.currentTime);
    comp.ratio.setValueAtTime(12, actx.currentTime);
    comp.attack.setValueAtTime(0, actx.currentTime);
    comp.release.setValueAtTime(0.25, actx.currentTime);
    osc.connect(comp); comp.connect(actx.destination); osc.start(0);
    const buf = await actx.startRendering();
    let sum = 0; const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i += 100) sum += Math.abs(ch[i]);
    audioHash = sum.toString(36);
  } catch { audioHash = "noaudio"; }

  const raw = `${ua}|${screenRes}|${tz}|${canvasHash}|${audioHash}`;
  fp = "fp_" + btoa(raw).replace(/=/g, "").slice(0, 32);
  localStorage.setItem("fp", fp);
  return fp;
}

/* ==========================
   Daily Limit (1 loop/hari)
   ========================== */
function checkDailyLimit(fp) {
  const today = new Date().toISOString().slice(0,10);
  const key = "lastLoop_" + fp;
  return localStorage.getItem(key) !== today;
}
function setDailyLimit(fp) {
  const today = new Date().toISOString().slice(0,10);
  localStorage.setItem("lastLoop_" + fp, today);
}

/* ==========================
   Upload + Progress Bar
   ========================== */
async function uploadVideo(fd) {
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  return await r.json();
}

function createProgressCard(id) {
  const container = document.getElementById("progressContainer");
  const card = document.createElement("div");
  card.className = "card";
  card.id = "progress-" + id;
  card.innerHTML = `
    <div class="h1" style="font-size:18px">Sedang memproses video #${id}</div>
    <div class="progress" style="height:24px;margin-top:10px">
      <div id="bar-${id}" class="progress-bar progress-bar-striped progress-bar-animated"
           role="progressbar" style="width: 0%">0%</div>
    </div>
    <div id="msg-${id}" class="lead" style="margin-top:8px;color:#6b7280">
      Mohon tunggu...
    </div>
    <div id="dl-${id}" style="margin-top:12px;display:none"></div>
  `;
  container.prepend(card);
}

/* ==========================
   Polling Status Realtime
   Expects /api/status/:id -> {status, progress, mp4, webm, message}
   ========================== */
async function pollStatus(id) {
  createProgressCard(id);

  for (let i = 0; i < 600; i++) {        // ~25 menit (600 x 2.5s)
    await new Promise(r => setTimeout(r, 2500));

    let resp;
    try { resp = await fetch("/api/status/" + id); } catch { continue; }
    if (!resp || !resp.ok) continue;

    const j = await resp.json();

    const bar = document.getElementById("bar-" + id);
    const msg = document.getElementById("msg-" + id);
    const dl  = document.getElementById("dl-" + id);
    if (!bar) continue;

    if (typeof j.progress === "number") {
      const pct = Math.max(0, Math.min(100, Math.floor(j.progress)));
      bar.style.width = pct + "%";
      bar.textContent = pct + "%";
    }

    if (j.status === "done") {
      bar.classList.remove("progress-bar-animated");
      bar.style.width = "100%";
      bar.textContent = "100%";
      if (msg) msg.textContent = "Video selesai! Silakan download di bawah.";
      if (dl) {
        dl.style.display = "block";
        dl.innerHTML = `
          <a href="${j.mp4}"  class="btn btn-primary btn-sm">⬇️ Download MP4</a>
          <a href="${j.webm}" class="btn btn-outline-primary btn-sm">⬇️ Download WEBM</a>
        `;
      }
      loadGallery();
      return;
    }

    if (j.status === "failed") {
      bar.classList.remove("progress-bar-animated");
      bar.classList.add("bg-danger");
      bar.style.width = "100%";
      bar.textContent = "Gagal";
      if (msg) msg.textContent = j.message || "Processing error";
      return;
    }
  }

  const msg = document.getElementById("msg-" + id);
  if (msg) msg.textContent = "Timeout: proses terlalu lama.";
}

/* ==========================
   Galeri (AJAX)
   ========================== */
async function loadGallery() {
  try {
    const r = await fetch("/api/videos?limit=15");
    const j = await r.json();
    const g = document.getElementById("gallery");
    if (!g) return;
    g.innerHTML = "";

    j.items.forEach(v => {
      const el = document.createElement("div");
      el.className = "video-card";
      if (v.status === "done") {
        el.innerHTML = `
          <a href="/video/${v.id}" style="text-decoration:none; color:inherit">
            <video muted loop playsinline>
              <source src="${v.srcMp4 || v.srcWebm}" type="video/mp4">
            </video>
            <div class="video-overlay">
              <div class="video-title">🎬 Video #${v.id}</div>
              <div class="video-sub">Klik untuk detail & download</div>
            </div>
          </a>
        `;
      } else if (v.status === "processing") {
        el.innerHTML = `
          <div class="video-overlay">
            <div class="video-title">⏳ Sedang diproses</div>
          </div>
        `;
      } else { // files_deleted / lainnya
        el.innerHTML = `
          <div class="video-overlay">
            <div class="video-title">❌ File dihapus</div>
          </div>
        `;
      }
      g.appendChild(el);
    });

    const totalEl = document.getElementById("totalCounter");
    if (totalEl) totalEl.textContent = j.total;

    initCarousel();
  } catch (e) {
    console.error("loadGallery error:", e);
  }
}

/* ==========================
   Carousel (Netflix style)
   ========================== */
let autoScroll = null;     // pastikan hanya ada satu deklarasi global

function initCarousel() {
  const carousel = document.getElementById("gallery");
  const wrapper  = document.querySelector(".carousel-wrapper");
  if (!carousel || !wrapper) return;

  // Hindari double-init saat loadGallery dipanggil ulang
  if (wrapper.dataset.initialized === "1") return;
  wrapper.dataset.initialized = "1";

  document.getElementById("btnLeft")?.addEventListener("click", () => {
    carousel.scrollBy({ left: -300, behavior: "smooth" });
  });
  document.getElementById("btnRight")?.addEventListener("click", () => {
    carousel.scrollBy({ left: 300, behavior: "smooth" });
  });

  function startAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    autoScroll = setInterval(() => {
      carousel.scrollBy({ left: 2, behavior: "smooth" });
      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth) {
        carousel.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 50);
  }
  function stopAutoScroll() {
    if (autoScroll) clearInterval(autoScroll);
    autoScroll = null;
  }

  wrapper.addEventListener("mouseenter", stopAutoScroll);
  wrapper.addEventListener("mouseleave", startAutoScroll);

  startAutoScroll();
}

/* ==========================
   DOM Ready
   ========================== */
document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
  document.getElementById("btnReload")?.addEventListener("click", loadGallery);

  const form = document.getElementById("uploadFormInner");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const fp = await getFingerprint();

    // Cek limit harian (frontend)
    if (!checkDailyLimit(fp)) {
      alert("❌ Batas harian tercapai.\nHanya 1 loop gratis per hari.\nSilakan berlangganan untuk akses lebih banyak.");
      return;
    }

    fd.append("fingerprint", fp);

    // Turnstile (jika ada)
    const tsv = document.querySelector('textarea[name="cf-turnstile-response"]');
    if (tsv) fd.append("cf-turnstile-response", tsv.value || "");

    // Kirim upload
    const res = await uploadVideo(fd);

    if (res.limited) {
      alert(res.msg);
    } else if (res.error) {
      alert(res.msg || "Upload gagal");
    } else if (res.success) {
      // set daily limit on success accept
      setDailyLimit(fp);
      // mulai polling progres
      pollStatus(res.id);
    }

    form.reset();
  });
});
