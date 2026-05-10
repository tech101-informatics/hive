import crypto from "crypto";

const HMAC_SECRET = process.env.SUPPORT_HMAC_SECRET || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const REPLAY_WINDOW_SECONDS = 300;

/**
 * Verify a dashboard request signed with SUPPORT_HMAC_SECRET.
 *
 * The dashboard MUST compute:
 *   base = `${timestamp}.${pathWithQuery}.${rawBody}`
 *   sig  = hex(HMAC-SHA256(SUPPORT_HMAC_SECRET, base))
 *
 * And send headers:
 *   X-Hive-Timestamp: <unix seconds>
 *   X-Hive-Signature: <hex sig>
 */
export function verifyDashboardSignature(
  pathWithQuery: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  if (!HMAC_SECRET) {
    console.warn("[support-auth] SUPPORT_HMAC_SECRET not set — rejecting all dashboard requests");
    return false;
  }
  if (!timestamp || !signature) {
    console.log("[support-auth] missing timestamp or signature header", { timestamp, signature });
    return false;
  }

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    console.log("[support-auth] non-numeric timestamp:", timestamp);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    console.log("[support-auth] timestamp out of replay window", { now, ts, drift: now - ts });
    return false;
  }

  const base = `${timestamp}.${pathWithQuery}.${rawBody}`;
  const expected = crypto.createHmac("sha256", HMAC_SECRET).update(base).digest("hex");

  console.log("[support-auth] base       =", JSON.stringify(base));
  console.log("[support-auth] expected   =", expected);
  console.log("[support-auth] received   =", signature);
  console.log("[support-auth] secret_len =", HMAC_SECRET.length);

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) {
    console.log("[support-auth] length mismatch:", expectedBuf.length, "vs", signatureBuf.length);
    return false;
  }

  try {
    const ok = crypto.timingSafeEqual(expectedBuf, signatureBuf);
    if (!ok) console.log("[support-auth] signatures differ — see expected vs received above");
    return ok;
  } catch {
    return false;
  }
}

/** Verify a Cloudflare Turnstile token via the siteverify endpoint. */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.warn("[support-auth] TURNSTILE_SECRET_KEY not set — rejecting all landing-page requests");
    return false;
  }
  if (!token) return false;

  try {
    const params = new URLSearchParams();
    params.append("secret", TURNSTILE_SECRET);
    params.append("response", token);
    if (remoteIp) params.append("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("[support-auth] Turnstile verify error:", e);
    return false;
  }
}
