import test from "node:test";
import assert from "node:assert/strict";
import { nonce, previewHTML } from "../src/previewHtml";

test("nonce is CSP-safe and 32 characters", () => {
  const value = nonce();
  assert.match(value, /^[A-Za-z0-9]{32}$/);
});

test("preview HTML includes Markdown++ styling hooks and scroll sync", () => {
  const html = previewHTML("abc123");
  assert.match(html, /nonce="abc123"/);
  assert.match(html, /\.mdpp-toc/);
  assert.match(html, /\.mdpp-embed/);
  assert.match(html, /message\.type === "render"/);
  assert.match(html, /message\.type === "scrollTo"/);
  assert.match(html, /vscode\.postMessage\(\{ type: "scroll"/);
});
