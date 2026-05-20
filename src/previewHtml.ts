import * as vscode from "vscode";

export interface PreviewResources {
  cspSource: string;
  cssUri: vscode.Uri;
  diagramsUri: vscode.Uri;
}

export function previewHTML(nonce: string, resources: PreviewResources): string {
  const { cspSource, cssUri, diagramsUri } = resources;
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} https: data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource} https: data:`,
    `script-src ${cspSource} 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    `connect-src https://cdn.jsdelivr.net`,
  ].join("; ");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <main id="content"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let lastFragments = [];
    const content = () => document.getElementById("content");
    const rerenderDiagrams = (root = document) => {
      const runtime = window.M31Diagrams;
      if (runtime && typeof runtime.render === "function") {
        try { void runtime.render(root); } catch (_) { /* ignore */ }
      }
    };
    const setFragmentAttrs = (node, fragment) => {
      node.dataset.mdppFragment = String(fragment.index);
      node.dataset.mdppFragmentType = fragment.type || "";
      const range = fragment.range || {};
      for (const [key, value] of Object.entries(range)) {
        node.dataset["mdpp" + key.charAt(0).toUpperCase() + key.slice(1)] = String(value);
      }
    };
    const fragmentNode = (fragment) => {
      const node = document.createElement("div");
      node.className = "mdpp-preview-fragment";
      setFragmentAttrs(node, fragment);
      node.innerHTML = fragment.html || "";
      return node;
    };
    const renderFragments = (root, fragments) => {
      if (!Array.isArray(fragments) || fragments.length === 0) {
        return false;
      }
      const existing = Array.from(root.children);
      const canPatch = existing.length === fragments.length && existing.every((node) => node.classList.contains("mdpp-preview-fragment"));
      if (!canPatch) {
        root.replaceChildren(...fragments.map(fragmentNode));
        lastFragments = fragments.map(fragment => fragment.html || "");
        return true;
      }
      for (const [index, fragment] of fragments.entries()) {
        const node = existing[index];
        setFragmentAttrs(node, fragment);
        const html = fragment.html || "";
        if (lastFragments[index] !== html) {
          node.innerHTML = html;
        }
      }
      lastFragments = fragments.map(fragment => fragment.html || "");
      return true;
    };
    window.addEventListener("message", event => {
      const message = event.data;
      if (message.type === "render") {
        const root = content();
        if (!root) return;
        if (!renderFragments(root, message.fragments)) {
          root.innerHTML = message.html || "";
          lastFragments = [];
        }
        root.dataset.mdppVersion = String(message.version || "");
        rerenderDiagrams(root);
      } else if (message.type === "scrollTo") {
        const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
        const ratio = Math.max(0, Math.min(1, Number(message.ratio) || 0));
        window.scrollTo({ top: ratio * maxScroll, behavior: "auto" });
      }
    });
    document.addEventListener("click", event => {
      const link = event.target && event.target.closest ? event.target.closest("a[href^='#']") : null;
      if (!link) {
        return;
      }
      const target = document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ block: "start" });
      }
    });
    window.addEventListener("scroll", () => {
      vscode.postMessage({ type: "scroll", ratio: window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight) });
    }, { passive: true });
    vscode.postMessage({ type: "ready" });
  </script>
  <script nonce="${nonce}" src="${diagramsUri}"></script>
</body>
</html>`;
}

export function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
