import express from "express";
import path from "path";
import dotenv from "dotenv"; dotenv.config();
import expressLayouts from "express-ejs-layouts";
import session from "express-session";
import connectSessionSequelize from "connect-session-sequelize";

import { sequelize, Setting } from "./config/db.js";
import publicApi from "./routes/publicApi.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const __root = path.resolve();

// === STATIC ===
app.use(express.static(path.join(__root, "public")));
app.use("/uploads", express.static(path.join(__root, "uploads")));

// === PARSERS ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === VIEW ENGINE ===
app.set("view engine", "ejs");
app.set("views", path.join(__root, "src", "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// === SESSION ===
const SequelizeStore = connectSessionSequelize(session.Store);
app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: false,
  store: new SequelizeStore({ db: sequelize }),
  cookie: { maxAge: 7 * 24 * 3600 * 1000 } // 7 hari
}));

// === ROUTES ===
app.use("/", publicApi);
app.use("/", adminRoutes);

// === BOOTSTRAP ===
(async () => {
  await sequelize.sync();

  // Default settings
  const defaults = {
    default_seconds: "5",
    default_width: "1280",
    default_fps: "30",
    turnstile_enabled: "0",
    turnstile_site_key: "",
    turnstile_secret_key: ""
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!await Setting.findByPk(k)) await Setting.create({ key: k, value: v });
  }

  // Seed admin credentials
  if (!await Setting.findByPk("admin_email"))
    await Setting.create({ key: "admin_email", value: process.env.ADMIN_EMAIL || "admin@local" });
  if (!await Setting.findByPk("admin_password_hash")) {
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
    await Setting.create({ key: "admin_password_hash", value: hash });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✅ Ready: http://localhost:${PORT}`));
})();
