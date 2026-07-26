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

export function checkApiAuth(request: Request): Response | null {
  const secret = process.env.GENERATOR_API_SECRET;
  if (!secret) {
    // Local dev: no secret required
    return null;
  }

  const auth = request.headers.get("authorization");
  const header = request.headers.get("x-generator-secret");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : header;

  if (!token || token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
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
