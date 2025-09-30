export function getFingerprint(req){
  return req.body?.fingerprint || req.headers["x-fingerprint"] || req.ip || "anon";
}
