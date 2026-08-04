import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  checkApiAuth,
  checkRateLimit,
  checkSessionCapacity,
  isLoopbackRequest,
  isSameOriginBrowserRequest,
  resetRateLimitBucketsForTests,
} from "./apiSecurity.ts";

describe("checkApiAuth", () => {
  const prevSecret = process.env.GENERATOR_API_SECRET;
  const prevOpen = process.env.GENERATOR_ALLOW_UNAUTHENTICATED;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.GENERATOR_API_SECRET;
    else process.env.GENERATOR_API_SECRET = prevSecret;
    if (prevOpen === undefined)
      delete process.env.GENERATOR_ALLOW_UNAUTHENTICATED;
    else process.env.GENERATOR_ALLOW_UNAUTHENTICATED = prevOpen;
  });

  it("allows loopback when secret is unset", () => {
    delete process.env.GENERATOR_API_SECRET;
    delete process.env.GENERATOR_ALLOW_UNAUTHENTICATED;
    const res = checkApiAuth(new Request("http://localhost/api/generate"));
    assert.equal(res, null);
  });

  it("rejects non-loopback when secret is unset", () => {
    delete process.env.GENERATOR_API_SECRET;
    delete process.env.GENERATOR_ALLOW_UNAUTHENTICATED;
    const res = checkApiAuth(
      new Request("https://example.com/api/generate", {
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );
    assert.equal(res?.status, 401);
  });

  it("allows non-loopback when GENERATOR_ALLOW_UNAUTHENTICATED is set", () => {
    delete process.env.GENERATOR_API_SECRET;
    process.env.GENERATOR_ALLOW_UNAUTHENTICATED = "1";
    const res = checkApiAuth(
      new Request("https://example.com/api/generate", {
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
    );
    assert.equal(res, null);
  });

  it("rejects missing token when secret is set", () => {
    process.env.GENERATOR_API_SECRET = "s3cret";
    const res = checkApiAuth(new Request("http://localhost/api/generate"));
    assert.equal(res?.status, 401);
  });

  it("accepts matching Bearer and x-generator-secret", () => {
    process.env.GENERATOR_API_SECRET = "s3cret";
    const bearer = checkApiAuth(
      new Request("http://localhost/api/generate", {
        headers: { authorization: "Bearer s3cret" },
      }),
    );
    assert.equal(bearer, null);
    const header = checkApiAuth(
      new Request("http://localhost/api/generate", {
        headers: { "x-generator-secret": "s3cret" },
      }),
    );
    assert.equal(header, null);
  });

  it("accepts same-origin browser requests when secret is set", () => {
    process.env.GENERATOR_API_SECRET = "s3cret";
    const res = checkApiAuth(
      new Request("http://localhost:3000/api/chats", {
        headers: {
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    assert.equal(res, null);
  });

  it("rejects wrong-length tokens without throwing", () => {
    process.env.GENERATOR_API_SECRET = "s3cret";
    const res = checkApiAuth(
      new Request("http://localhost/api/generate", {
        headers: { "x-generator-secret": "nope" },
      }),
    );
    assert.equal(res?.status, 401);
  });
});

describe("isLoopbackRequest / isSameOriginBrowserRequest", () => {
  it("detects localhost without forwarded headers", () => {
    assert.equal(
      isLoopbackRequest(new Request("http://127.0.0.1:3000/api/health")),
      true,
    );
  });

  it("rejects public forwarded IPs even on localhost host", () => {
    assert.equal(
      isLoopbackRequest(
        new Request("http://localhost/api/generate", {
          headers: { "x-forwarded-for": "198.51.100.2" },
        }),
      ),
      false,
    );
  });

  it("detects same-origin via Sec-Fetch-Site", () => {
    assert.equal(
      isSameOriginBrowserRequest(
        new Request("https://app.example/api/chats", {
          headers: { "sec-fetch-site": "same-origin" },
        }),
      ),
      true,
    );
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitBucketsForTests());

  it("allows the first 8 requests then returns 429", () => {
    const req = new Request("http://localhost/api/generate", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    for (let i = 0; i < 8; i++) {
      assert.equal(checkRateLimit(req), null);
    }
    assert.equal(checkRateLimit(req)?.status, 429);
  });
});

describe("checkSessionCapacity", () => {
  it("returns 503 when at capacity", () => {
    assert.equal(checkSessionCapacity(0), null);
    assert.equal(checkSessionCapacity(10)?.status, 503);
  });
});
