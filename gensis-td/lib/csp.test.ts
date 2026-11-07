// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCsp, cspHeaderName, originOf } from "./csp.ts";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " ")) ?? "";

test("scripts: self and this request's nonce only", () => {
  const csp = buildCsp("abc123", "https://files.dosyalift.com");
  assert.equal(directive(csp, "script-src"), "script-src 'self' 'nonce-abc123'");
  assert.ok(!csp.includes("unsafe-eval"));
  assert.ok(!directive(csp, "script-src").includes("unsafe-inline"));
  assert.ok(!csp.includes("strict-dynamic")); // would block Cloudflare's same-origin email-decode script
});

test("the files host is allowed where uploads, previews and framed documents need it, nowhere else", () => {
  const csp = buildCsp("n", "https://files.dosyalift.com/some/path");
  for (const d of ["connect-src", "img-src", "frame-src"]) assert.ok(directive(csp, d).includes("https://files.dosyalift.com"), d);
  assert.ok(!directive(csp, "script-src").includes("files.dosyalift.com"));
  assert.ok(!directive(csp, "default-src").includes("files.dosyalift.com"));
});

test("framing, plugins, base and forms are locked down", () => {
  const csp = buildCsp("n", null);
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  assert.equal(directive(csp, "form-action"), "form-action 'self'");
});

test("a bad or missing files URL adds nothing", () => {
  assert.equal(originOf(undefined), null);
  assert.equal(originOf("not a url"), null);
  assert.equal(originOf("javascript:alert(1)"), null);
  assert.equal(directive(buildCsp("n", "javascript:alert(1)"), "connect-src"), "connect-src 'self'");
});

test("report-only only when asked", () => {
  assert.equal(cspHeaderName(undefined), "Content-Security-Policy");
  assert.equal(cspHeaderName("0"), "Content-Security-Policy");
  assert.equal(cspHeaderName("1"), "Content-Security-Policy-Report-Only");
});
