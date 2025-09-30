import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { Queue } from "bullmq";
import { Video, UserAnon, Subscription, Setting } from "../config/db.js";
import { getFingerprint } from "../middlewares/fingerprint.js";
import { redisConnection } from "../queue/_conn.js";

const router = express.Router();
const queue  = new Queue("video-jobs", { connection: redisConnection() });

const UPLOAD_DIR = "uploads/orig";
const OUT_DIR    = "uploads/out";
await fs.mkdir(UPLOAD_DIR, { recursive:true });
await fs.mkdir(OUT_DIR, { recursive:true });

const storage = multer.diskStorage({
  destination: (_,__,cb)=>cb(null, UPLOAD_DIR),
  filename:   (_,f,cb)=>cb(null, `${Date.now()}_${f.originalname}`)
});
const upload = multer({ storage, limits:{ fileSize: 200*1024*1024 } });

// ✅ Turnstile verify (aktif jika admin enable)
async function verifyTurnstile(req){
  const s = Object.fromEntries((await Setting.findAll()).map(x=>[x.key,x.value]));
  if((s.turnstile_enabled||"0")!=="1") return true;
  const token = req.body["cf-turnstile-response"];
  if(!token || !s.turnstile_secret_key) return false;
  try{
    const { data } = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({ secret: s.turnstile_secret_key, response: token }),
      { headers:{ "content-type":"application/x-www-form-urlencoded" } }
    );
    return !!data.success;
  }catch{ return false; }
}

// ✅ Home (EJS)
router.get("/", async (req,res)=>{
  const total = await Video.count();
  const s = Object.fromEntries((await Setting.findAll()).map(x=>[x.key,x.value]));
  const head = (s.turnstile_enabled==="1" && s.turnstile_site_key)
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  res.render("public/home", { title:"LoopLab", total, head });
});

// ✅ List galeri (AJAX)
router.get("/api/videos", async (req,res)=>{
  const limit = Math.min(parseInt(req.query.limit||"9"), 30);
  const items = await Video.findAll({ order:[["createdAt","DESC"]], limit });
  const total = await Video.count();
  res.json({ items, total });
});

// ✅ Upload (AJAX) + limit harian + enqueue
router.post("/api/upload", upload.single("video"), async (req,res)=>{
  try{
    if(!(await verifyTurnstile(req))) return res.json({ error:true, msg:"Captcha gagal" });

    const fp = getFingerprint(req);
    const ip = req.ip;
    const seconds = Math.max(2, Number(req.body.seconds||5));
    const minutes = Number(req.body.minutes||0);
    const hours   = Number(req.body.hours||0);
    const width   = Number(req.body.width||1280);
    const fps     = Number(req.body.fps||30);

    const totalSeconds = hours*3600 + minutes*60;
    const MAX = Number(process.env.MAX_LOOP_SECONDS || 7200);
    if(totalSeconds <= 0) return res.json({ error:true, msg:"Durasi harus > 0" });
    if(totalSeconds > MAX) return res.json({ error:true, msg:`Durasi maksimal ${MAX} detik` });

    // subscription check
    const sub = await Subscription.findOne({ where:{ fingerprint: fp }});
    const subscribed = sub && sub.expireAt && new Date(sub.expireAt) > new Date();

    // user anon quota
    const today = (new Date()).toISOString().slice(0,10);
    let ua = await UserAnon.findByPk(fp);
    if(!ua) ua = await UserAnon.create({ fingerprint: fp, ip, lastLoopDate: today, loopsToday:0 });
    if(ua.lastLoopDate !== today) await ua.update({ lastLoopDate: today, loopsToday:0 });

    if(!subscribed && ua.loopsToday >= 1){
      return res.json({ limited:true, msg:"Anda sudah membuat 1 loop hari ini. Berlangganan untuk lebih banyak." });
    }

    await ua.increment("loopsToday");

    // hitung jumlah pengulangan
    const loops = Math.max(1, Math.floor(totalSeconds / seconds));

    const id = uuidv4();
    const srcOriginal = req.file.path;
    const outMp4  = path.join(OUT_DIR, `${id}.mp4`);
    const outWebm = path.join(OUT_DIR, `${id}.webm`);

    await Video.create({ 
      id, 
      srcOriginal, 
      loopSeconds: seconds, 
      totalSeconds, 
      status:"queued", 
      progress: 0 // ⬅️ mulai dari 0
    });

    await queue.add("process", { id, srcOriginal, seconds, width, fps, loops, totalSeconds });

    res.json({ success:true, id });
  }catch(e){
    console.error(e);
    res.json({ error:true, msg:e.message });
  }
});

// ✅ Status (AJAX)
router.get("/api/status/:id", async (req,res)=>{
  const v = await Video.findByPk(req.params.id);
  if(!v) return res.status(404).json({ error:true });
  res.json({ 
    id: v.id, 
    status: v.status, 
    progress: v.progress || 0,   // ⬅️ progress dikirim
    mp4: v.srcMp4, 
    webm: v.srcWebm, 
    message: v.message 
  });
});

export default router;
