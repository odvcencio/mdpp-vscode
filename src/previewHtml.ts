export function previewHTML(nonce: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: var(--vscode-font-family); line-height: 1.5; padding: 16px 24px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
    pre, code { font-family: var(--vscode-editor-font-family); }
    pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; }
    blockquote { border-left: 4px solid var(--vscode-panel-border); margin-left: 0; padding-left: 12px; color: var(--vscode-descriptionForeground); }
    .admonition, .mdpp-container, .mdpp-toc, .mdpp-embed { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px 12px; margin: 1em 0; }
    .admonition-title, .mdpp-container-title { font-weight: 700; margin-top: 0; }
    .mdpp-embed-youtube, .mdpp-embed-vimeo { border-left-width: 4px; }
    .mdpp-toc a { text-decoration: none; }
  </style>
</head>
<body>
  <main id="content"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    window.addEventListener("message", event => {
      const message = event.data;
      if (message.type === "render") {
        document.getElementById("content").innerHTML = message.html || "";
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
