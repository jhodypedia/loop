import dotenv from "dotenv"; dotenv.config();
import { Worker } from "bullmq";
import path from "path";
import fs from "fs/promises";
import { createLoop } from "../utils/ffmpeg.js";
import { Video } from "../config/db.js";
import { redisConnection } from "./_conn.js";

new Worker("video-jobs", async job=>{
  const d = job.data;
  const v = await Video.findByPk(d.id);
  if(!v) return;
  try{
    await v.update({ status:"processing", message:null });
    const tmpBase = path.join("uploads","out", `${d.id}_base.mp4`);
    const outMp4  = path.join("uploads","out", `${d.id}.mp4`);
    const outWebm = path.join("uploads","out", `${d.id}.webm`);
    await createLoop(d.srcOriginal, tmpBase, outMp4, outWebm, d.seconds, d.width, d.fps, d.loops);
    await v.update({ srcMp4:`/${outMp4}`, srcWebm:`/${outWebm}`, status:"done" });
    await fs.unlink(tmpBase).catch(()=>{});
  }catch(e){
    await v.update({ status:"failed", message:e.message });
  }
},{ connection: redisConnection(), concurrency: 1 });

console.log("Worker running...");
