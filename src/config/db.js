import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv"; dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME || "loopdb",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  { host: process.env.DB_HOST || "127.0.0.1", dialect: "mysql", logging:false }
);

export const Video = sequelize.define("Video", {
  id: { type: DataTypes.STRING, primaryKey:true },
  srcOriginal: DataTypes.STRING,
  srcMp4: DataTypes.STRING,
  srcWebm: DataTypes.STRING,
  loopSeconds: DataTypes.INTEGER,
  totalSeconds: DataTypes.INTEGER,
  status: { type: DataTypes.ENUM("queued","processing","done","failed","files_deleted"), defaultValue:"queued" },
  message: DataTypes.TEXT
});

export const UserAnon = sequelize.define("UserAnon", {
  fingerprint: { type: DataTypes.STRING, primaryKey:true },
  ip: DataTypes.STRING,
  lastLoopDate: DataTypes.STRING,   // YYYY-MM-DD
  loopsToday: { type: DataTypes.INTEGER, defaultValue:0 }
});

export const Subscription = sequelize.define("Subscription", {
  fingerprint: DataTypes.STRING,
  status: { type: DataTypes.ENUM("active","expired"), defaultValue:"expired" },
  expireAt: DataTypes.DATE
});

export const Setting = sequelize.define("Setting", {
  key: { type: DataTypes.STRING, primaryKey:true },
  value: DataTypes.TEXT
});
