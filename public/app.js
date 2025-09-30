// ==========================
// Fingerprint sederhana
// ==========================
function getFingerprint() {
  let fp = localStorage.getItem("fp");
  if (fp) return fp;
  const key = (navigator.userAgent || "") + `${screen.width}x${screen.height}` + Math.random();
  fp = "fp_" + btoa(key).replace(/=/g, "").slice(0, 32);
  localStorage.setItem("fp", fp);
  return fp;
}

// ==========================
// UPLOAD + Progress bar
// ==========================
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

// ==========================
// POLLING STATUS
// ==========================
async function pollStatus(id) {
  createProgressCard(id);

  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const r = await fetch("/api/status/" + id);
    if (!r.ok) continue;
    const j = await r.json();

    const bar = document.getElementById("bar-" + id);
    const msg = document.getElementById("msg-" + id);
    const dl = document.getElementById("dl-" + id);

    if (!bar) continue;

    if (j.progress) {
      bar.style.width = j.progress + "%";
      bar.innerText = j.progress + "%";
    }

    if (j.status === "done") {
      bar.classList.remove("progress-bar-animated");
      bar.style.width = "100%";
      bar.innerText = "100%";

      msg.innerText = "Video selesai! Silakan download di bawah.";
      dl.style.display = "block";
      dl.innerHTML = `
        <a href="${j.mp4}" class="btn btn-primary btn-sm">⬇️ Download MP4</a>
        <a href="${j.webm}" class="btn btn-outline-primary btn-sm">⬇️ Download WEBM</a>
      `;
      loadGallery();
      return;
    } else if (j.status === "failed") {
      bar.classList.remove("progress-bar-animated");
      bar.classList.add("bg-danger");
      bar.style.width = "100%";
      bar.innerText = "Gagal";

      msg.innerText = j.message || "Processing error";
      return;
    }
  }

  const msg = document.getElementById("msg-" + id);
  if (msg) msg.innerText = "Timeout: proses terlalu lama.";
}

// ==========================
// LOAD GALLERY
// ==========================
async function loadGallery() {
  const r = await fetch("/api/videos?limit=15");
  const j = await r.json();
  const g = document.getElementById("gallery");
  g.innerHTML = "";

  j.items.forEach((v) => {
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
    } else {
      el.innerHTML = `
        <div class="video-overlay">
          <div class="video-title">❌ File dihapus</div>
        </div>
      `;
    }
    g.appendChild(el);
  });

  document.getElementById("totalCounter").innerText = j.total;
  initCarousel();
}

// ==========================
// CAROUSEL
// ==========================
let autoScroll;

function initCarousel() {
  const carousel = document.getElementById("gallery");
  const wrapper = document.querySelector(".carousel-wrapper");

  if (!carousel || !wrapper) return;

  document.getElementById("btnLeft")?.addEventListener("click", () => {
    carousel.scrollBy({ left: -300, behavior: "smooth" });
  });
  document.getElementById("btnRight")?.addEventListener("click", () => {
    carousel.scrollBy({ left: 300, behavior: "smooth" });
  });

  function startAutoScroll() {
    autoScroll = setInterval(() => {
      carousel.scrollBy({ left: 2, behavior: "smooth" });
      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth) {
        carousel.scrollTo({ left: 0, behavior: "smooth" });
      }
    }, 50);
  }
  function stopAutoScroll() { clearInterval(autoScroll); }

  wrapper.addEventListener("mouseenter", stopAutoScroll);
  wrapper.addEventListener("mouseleave", startAutoScroll);

  startAutoScroll();
}

// ==========================
// DOM READY
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  loadGallery();

  document.getElementById("btnReload")?.addEventListener("click", loadGallery);

  const form = document.getElementById("uploadFormInner");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.append("fingerprint", getFingerprint());

    const tsv = document.querySelector('textarea[name="cf-turnstile-response"]');
    if (tsv) fd.append("cf-turnstile-response", tsv.value || "");

    const res = await uploadVideo(fd);

    if (res.limited) {
      alert(res.msg);
    } else if (res.error) {
      alert(res.msg || "Upload gagal");
    } else if (res.success) {
      pollStatus(res.id);
    }

    e.target.reset();
  });
});
