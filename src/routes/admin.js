import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import { Setting, Subscription, Video } from "../config/db.js";
import { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// === LOGIN ===
router.get("/admin/login", (req, res) => {
  if (req.session.admin) return res.redirect("/admin");
  res.render("admin/login", { title: "Admin Login", error: null });
});

router.post("/admin/login", express.urlencoded({ extended: true }), async (req, res) => {
  const { email, password } = req.body;
  const em = await Setting.findByPk("admin_email");
  const ph = await Setting.findByPk("admin_password_hash");
  if (!em || !ph) return res.render("admin/login", { title: "Admin Login", error: "Admin belum diset" });

  const match = (email === em.value) && await bcrypt.compare(password, ph.value);
  if (match) {
    req.session.admin = { email };
    return res.redirect("/admin");
  }
  res.render("admin/login", { title: "Admin Login", error: "Login gagal" });
});

router.get("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// === PROTECTED ROUTES ===
router.use("/admin", requireAdmin);

// Dashboard
router.get("/admin", async (req, res) => {
  res.render("admin/dashboard", { title: "Admin" });
});

// Metrics
router.get("/admin/api/metrics", async (req, res) => {
  const [total, done, deleted] = await Promise.all([
    Video.count(),
    Video.count({ where: { status: "done" } }),
    Video.count({ where: { status: "files_deleted" } })
  ]);
  res.json({ total, done, deleted });
});

// Videos list
router.get("/admin/api/videos", async (req, res) => {
  const items = await Video.findAll({ order: [["createdAt", "DESC"]], limit: 200 });
  res.json({ items });
});

// Purge video files
router.post("/admin/api/videos/:id/purge", async (req, res) => {
  const v = await Video.findByPk(req.params.id);
  if (!v) return res.status(404).json({ error: true });
  const list = [v.srcOriginal, v.srcMp4, v.srcWebm].filter(Boolean).map(p => p.replace(/^\//, ""));
  for (const p of list) { try { await fs.unlink(p); } catch {} }
  await v.update({ srcOriginal: null, srcMp4: null, srcWebm: null, status: "files_deleted" });
  res.json({ success: true });
});

// Subscriptions
router.get("/admin/api/subscriptions", async (req, res) => {
  const subs = await Subscription.findAll({ order: [["expireAt", "DESC"]] });
  res.json(subs);
});

router.post("/admin/api/subscriptions/activate", express.json(), async (req, res) => {
  const { fingerprint, days } = req.body;
  if (!fingerprint) return res.status(400).json({ error: true, msg: "no fingerprint" });
  const expireAt = new Date(Date.now() + (Number(days || 30) * 86400000));
  await Subscription.upsert({ fingerprint, status: "active", expireAt });
  res.json({ success: true });
});

// Settings
router.get("/admin/api/settings", async (req, res) => {
  const s = Object.fromEntries((await Setting.findAll()).map(x => [x.key, x.value]));
  res.json({
    default_seconds: s.default_seconds || "5",
    default_width: s.default_width || "1280",
    default_fps: s.default_fps || "30",
    turnstile_enabled: s.turnstile_enabled || "0",
    turnstile_site_key: s.turnstile_site_key || "",
    turnstile_secret_key: s.turnstile_secret_key || ""
  });
});

router.post("/admin/api/settings", express.json(), async (req, res) => {
  const body = req.body || {};
  const pairs = Object.entries({
    default_seconds: body.default_seconds || "5",
    default_width: body.default_width || "1280",
    default_fps: body.default_fps || "30",
    turnstile_enabled: body.turnstile_enabled === "1" ? "1" : "0",
    turnstile_site_key: body.turnstile_site_key || "",
    turnstile_secret_key: body.turnstile_secret_key || ""
  });
  for (const [k, v] of pairs) await Setting.upsert({ key: k, value: v });
  res.json({ success: true });
});

export default router;
