import { createHash, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "desk_session";

export function sessionToken(password) {
  return createHash("sha256")
    .update(`idea-validation-desk:v1:${password}`)
    .digest("hex");
}

export function tokensMatch(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
