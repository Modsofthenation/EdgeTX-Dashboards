import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  checkApiAuth,
  checkRateLimit,
  checkSessionCapacity,
  resetRateLimitBucketsForTests,
} from "./apiSecurity.ts";

describe("checkApiAuth", () => {
  const prev = process.env.GENERATOR_API_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.GENERATOR_API_SECRET;
    else process.env.GENERATOR_API_SECRET = prev;
  });

  it("allows all requests when secret is unset", () => {
    delete process.env.GENERATOR_API_SECRET;
    const res = checkApiAuth(new Request("http://localhost/api/generate"));
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
