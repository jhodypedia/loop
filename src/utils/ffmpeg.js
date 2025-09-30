import { exec as _exec } from "child_process";
import { promisify } from "util";
const exec = promisify(_exec);

/**
 * Buat clip kecil (seconds), lalu ulangi jadi file panjang:
 * - tmpBase: clip normalized
 * - outMp4 : final MP4 (copy)
 * - outWebm: final VP9 WebM (kecil)
 */
export async function createLoop(src, tmpBase, outMp4, outWebm, seconds, width, fps, loops){
  // normalisasi & potong clip kecil
  await exec(`ffmpeg -y -i "${src}" -vf "scale=${width}:-2,fps=${fps}" -t ${seconds} -an -crf 20 -preset medium "${tmpBase}"`);
  // ulangi N-1 kali (stream_loop menambah setelah input pertama)
  const repeats = Math.max(0, loops - 1);
  await exec(`ffmpeg -y -stream_loop ${repeats} -i "${tmpBase}" -c copy "${outMp4}"`);
  // webm (VP9) — lebih cepat dari AV1 di lokal, ukuran kecil, kualitas oke
  await exec(`ffmpeg -y -i "${outMp4}" -c:v libvpx-vp9 -b:v 0 -crf 30 -an "${outWebm}"`);
}
