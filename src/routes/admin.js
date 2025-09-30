import express from "express";
import bcrypt from "bcryptjs";
import { Setting, Subscription, Video } from "../config/db.js";

const router = express.Router();

// Admin single page (AJAX dashboard)
router.get("/admin", async (req,res)=>{
  res.render("admin/dashboard", { title:"Admin" });
});

// Metrics
router.get("/admin/api/metrics", async (req,res)=>{
  const [total, done, deleted] = await Promise.all([
    Video.count(),
    Video.count({ where:{ status:"done" } }),
    Video.count({ where:{ status:"files_deleted" } })
  ]);
  res.json({ total, done, deleted });
});

// Videos list
router.get("/admin/api/videos", async (req,res)=>{
  const items = await Video.findAll({ order:[["createdAt","DESC"]], limit:200 });
  res.json({ items });
});

// Purge files (fisik) – DB tetap ada
router.post("/admin/api/videos/:id/purge", async (req,res)=>{
  const v = await Video.findByPk(req.params.id);
  if(!v) return res.status(404).json({ error:true });
  const list = [v.srcOriginal, v.srcMp4, v.srcWebm].filter(Boolean).map(p=>p.replace(/^\//,''));
  for(const p of list){ try{ await import('fs/promises').then(m=>m.unlink(p)).catch(()=>{}); }catch{} }
  await v.update({ srcOriginal:null, srcMp4:null, srcWebm:null, status:"files_deleted" });
  res.json({ success:true });
});

// Subscriptions
router.get("/admin/api/subscriptions", async (req,res)=>{
  const subs = await Subscription.findAll({ order:[["expireAt","DESC"]] });
  res.json(subs);
});
router.post("/admin/api/subscriptions/activate", express.json(), async (req,res)=>{
  const { fingerprint, days } = req.body;
  if(!fingerprint) return res.status(400).json({ error:true, msg:'no fingerprint' });
  const expireAt = new Date(Date.now() + (Number(days||30)*86400000));
  await Subscription.upsert({ fingerprint, status:"active", expireAt });
  res.json({ success:true });
});

// Settings (get & set)
router.get("/admin/api/settings", async (req,res)=>{
  const s = Object.fromEntries((await Setting.findAll()).map(x=>[x.key,x.value]));
  res.json({
    default_seconds: s.default_seconds||"5",
    default_width: s.default_width||"1280",
    default_fps: s.default_fps||"30",
    turnstile_enabled: s.turnstile_enabled||"0",
    turnstile_site_key: s.turnstile_site_key||"",
    turnstile_secret_key: s.turnstile_secret_key||""
  });
});
router.post("/admin/api/settings", express.json(), async (req,res)=>{
  const body = req.body||{};
  const pairs = Object.entries({
    default_seconds: body.default_seconds||"5",
    default_width: body.default_width||"1280",
    default_fps: body.default_fps||"30",
    turnstile_enabled: body.turnstile_enabled==="1" ? "1":"0",
    turnstile_site_key: body.turnstile_site_key||"",
    turnstile_secret_key: body.turnstile_secret_key||""
  });
  for(const [k,v] of pairs) await Setting.upsert({ key:k, value:v });
  res.json({ success:true });
});

export default router;
