import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { nonce, previewHTML } from "../src/previewHtml";

test("nonce is CSP-safe and 32 characters", () => {
  const value = nonce();
  assert.match(value, /^[A-Za-z0-9]{32}$/);
});

test("preview HTML wires Markdown++ resources and scroll sync", () => {
  const html = previewHTML("abc123", {
    cspSource: "vscode-webview:",
    cssUri: { toString: () => "webview://asset/preview.css" } as any,
    diagramsUri: { toString: () => "webview://asset/mdpp-diagrams.js" } as any
  });
  assert.match(html, /nonce="abc123"/);
  assert.match(html, /webview:\/\/asset\/preview\.css/);
  assert.match(html, /webview:\/\/asset\/mdpp-diagrams\.js/);
  assert.match(html, /message\.type === "render"/);
  assert.match(html, /message\.type === "scrollTo"/);
  assert.match(html, /vscode\.postMessage\(\{ type: "scroll"/);
  assert.match(html, /renderFragments\(root, message\.fragments\)/);
  assert.match(html, /mdpp-preview-fragment/);
  assert.match(html, /rerenderDiagrams\(root\)/);
});

test("preview stylesheet contains gotreesitter fence highlight classes", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "media", "preview.css"), "utf8");
  for (const cls of [
    "hl-keyword",
    "hl-string",
    "hl-number",
    "hl-type",
    "hl-function",
    "hl-comment",
    "hl-operator",
    "hl-punctuation"
  ]) {
    assert.match(css, new RegExp(`pre code \\.${cls}\\b`));
  }
});

test("diagram runtime caches rendered SVG by source hash", () => {
  const js = fs.readFileSync(path.join(process.cwd(), "media", "mdpp-diagrams.js"), "utf8");
  assert.match(js, /renderedDiagramCache/);
  assert.match(js, /sessionStorage\.getItem/);
  assert.match(js, /rememberSVG\(key, svg\)/);
});
