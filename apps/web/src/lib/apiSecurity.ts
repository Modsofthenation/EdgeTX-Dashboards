import { timingSafeEqual } from "node:crypto";
import { MAX_ACTIVE_SESSIONS } from "~/server/generatorFacade";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

/** Test-only: clear in-memory rate buckets. */
export function resetRateLimitBucketsForTests(): void {
  rateBuckets.clear();
}

function envFlagEnabled(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True for loopback Host / client IP (local `npm run dev`, desktop, e2e). */
export function isLoopbackRequest(request: Request): boolean {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = (forwarded ?? realIp ?? "").toLowerCase();
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip === "::ffff:127.0.0.1"
  ) {
    return true;
  }

  try {
    const host = new URL(request.url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      // Public reverse proxies usually set x-forwarded-for / x-real-ip.
      if (!forwarded && !realIp) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Same-origin browser fetches from the web UI (Sec-Fetch-Site / Origin).
 * Lets GENERATOR_API_SECRET protect non-browser clients without breaking the SPA.
 */
export function isSameOriginBrowserRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site === "same-origin") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const req = new URL(request.url);
    const orig = new URL(origin);
    return (
      orig.protocol === req.protocol &&
      orig.hostname === req.hostname &&
      orig.port === req.port
    );
  } catch {
    return false;
  }
}

/**
 * API gate for generate/refine/chat/validate/etc.
 *
 * - No `GENERATOR_API_SECRET`: allow loopback only (local/desktop). Set
 *   `GENERATOR_ALLOW_UNAUTHENTICATED=1` to open LAN / intentional public demos.
 * - With secret: accept Bearer / `x-generator-secret`, or same-origin browser UI.
 */
export function checkApiAuth(request: Request): Response | null {
  const secret = process.env.GENERATOR_API_SECRET?.trim();

  if (!secret) {
    if (envFlagEnabled("GENERATOR_ALLOW_UNAUTHENTICATED")) return null;
    if (isLoopbackRequest(request)) return null;
    return Response.json(
      {
        error:
          "Unauthorized. Set GENERATOR_API_SECRET for non-localhost access, or GENERATOR_ALLOW_UNAUTHENTICATED=1 for an intentional open API.",
      },
      { status: 401 },
    );
  }

  const auth = request.headers.get("authorization");
  const header = request.headers.get("x-generator-secret");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : header;

  if (token && secretsEqual(token, secret)) return null;
  if (isSameOriginBrowserRequest(request)) return null;

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function checkRateLimit(request: Request): Response | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";

  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }

  bucket.count++;
  if (bucket.count > RATE_LIMIT_MAX) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 },
    );
  }
  return null;
}

export function checkSessionCapacity(currentCount: number): Response | null {
  if (currentCount >= MAX_ACTIVE_SESSIONS) {
    return Response.json(
      { error: "Too many active generation sessions. Try again later." },
      { status: 503 },
    );
  }
  return null;
}
