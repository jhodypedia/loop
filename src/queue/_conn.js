import dotenv from "dotenv"; dotenv.config();
export function redisConnection(){
  return { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT || 6379) };
}
