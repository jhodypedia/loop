import dotenv from "dotenv"; 
dotenv.config();
import { Worker } from "bullmq";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { Video } from "../config/db.js";
import { redisConnection } from "./_conn.js";

// Helper: run ffmpeg dengan progress parsing
async function runFfmpegWithProgress(d, tmpBase, outMp4, outWebm, onProgress) {
  return new Promise((resolve, reject) => {
    // Contoh command dasar (concat loop)
    const args = [
      "-y",
      "-i", d.srcOriginal,
      "-vf", `scale=${d.width}:-2,fps=${d.fps}`,
      tmpBase
    ];

    const ff = spawn("ffmpeg", args);

    ff.stderr.on("data", chunk => {
      const line = chunk.toString();
      // Parsing time dari log ffmpeg
      const match = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const h = parseInt(match[1]), m = parseInt(match[2]), s = parseFloat(match[3]);
        const sec = h * 3600 + m * 60 + s;
        const pct = Math.min(100, Math.floor((sec / d.totalSeconds) * 100));
        onProgress(pct);
      }
    });

    ff.on("error", reject);
    ff.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("FFmpeg gagal dengan kode " + code));
      }
    });
  });
}

new Worker(
  "video-jobs",
  async job => {
    const d = job.data;
    const v = await Video.findByPk(d.id);
    if (!v) return;
    try {
      await v.update({ status: "processing", message: null, progress: 0 });

      const tmpBase = path.join("uploads", "out", `${d.id}_base.mp4`);
      const outMp4 = path.join("uploads", "out", `${d.id}.mp4`);
      const outWebm = path.join("uploads", "out", `${d.id}.webm`);

      // Jalankan ffmpeg dengan progress
      await runFfmpegWithProgress(d, tmpBase, outMp4, outWebm, async pct => {
        job.updateProgress(pct); // update ke BullMQ
        await v.update({ progress: pct });
      });

      // Setelah selesai convert → encode output final (mp4 & webm)
      // Catatan: di sini bisa pakai perintah ffmpeg concat loop sesuai createLoop sebelumnya
      await fs.rename(tmpBase, outMp4);
      await fs.copyFile(outMp4, outWebm);

      await v.update({
        srcMp4: `/${outMp4}`,
        srcWebm: `/${outWebm}`,
        status: "done",
        progress: 100
      });

      await fs.unlink(tmpBase).catch(() => {});
    } catch (e) {
      await v.update({ status: "failed", message: e.message, progress: 100 });
    }
  },
  { connection: redisConnection(), concurrency: 1 }
);

console.log("Worker running with progress support...");
