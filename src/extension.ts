import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient/node";
import { resolveServerBinary } from "./binary";
import { nonce, previewHTML } from "./previewHtml";

let client: LanguageClient | undefined;
let preview: MarkdownPPPreview | undefined;
let output: vscode.OutputChannel | undefined;
let status: vscode.StatusBarItem | undefined;

type MarkdownPPServerInfo = {
  name: string;
  version: string;
  specVersion?: string;
  buildCommit?: string;
  buildTime?: string;
  binaryPath?: string;
  pid?: number;
  goVersion?: string;
};

type PreviewReadyParams = {
  uri: string;
  version: number;
};

type PreviewRange = {
  startByte: number;
  endByte: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

type PreviewFragment = {
  index: number;
  type: string;
  range: PreviewRange;
  html: string;
};

type RenderPreviewResult = {
  uri: string;
  html: string;
  fragments?: PreviewFragment[];
  version: number;
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output = vscode.window.createOutputChannel("Markdown++");
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
  status.text = "$(markdown) Markdown++";
  status.tooltip = "Markdown++ language server";
  status.show();
  context.subscriptions.push(output, status);

  const config = readConfig();
  const serverPath = await resolveServerBinary(context, config);
  client = startLanguageClient(context, serverPath, config.takeOverMarkdownLanguage);

  context.subscriptions.push(
    vscode.commands.registerCommand("markdownpp.renderHtml", () => showCommandError(renderCurrentDocument("html"))),
    vscode.commands.registerCommand("markdownpp.exportPdf", () => showCommandError(renderCurrentDocument("pdf"))),
    vscode.commands.registerCommand("markdownpp.openPreview", () => showCommandError(openPreview(context))),
    vscode.commands.registerCommand("markdownpp.openPreviewToSide", () => showCommandError(openPreview(context))),
    vscode.commands.registerCommand("markdownpp.restartServer", () => showCommandError(restartClient(context))),
    vscode.workspace.onWillSaveTextDocument(event => {
      if (readConfig().formatOnSave && isMarkdownPPDocument(event.document)) {
        event.waitUntil(formatBeforeSave(event.document));
      }
    }),
    vscode.workspace.onDidChangeConfiguration(async event => {
      if (!event.affectsConfiguration("markdownpp")) {
        return;
      }
      await restartClient(context);
    })
  );

  if (config.previewEnabled) {
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => preview?.syncFromEditor()));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => preview?.refreshIfMatches(event.document)));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
      if (!preview || document.uri.toString() !== preview.documentUri()) {
        return;
      }
      void preview.refresh();
    }));
  }
}

export async function deactivate(): Promise<void> {
  preview?.dispose();
  preview = undefined;
  if (client) {
    await client.stop();
    client = undefined;
  }
  status?.dispose();
  status = undefined;
  output?.dispose();
  output = undefined;
}

function startLanguageClient(context: vscode.ExtensionContext, serverPath: string, takeOverMarkdown: boolean): LanguageClient {
  output?.appendLine(`Starting mdpp-lsp: ${serverPath}`);
  const serverOptions: ServerOptions = {
    command: serverPath,
    transport: TransportKind.stdio
  };
  const documentSelector: string[] = takeOverMarkdown
    ? ["markdown", "markdown-plus-plus"]
    : ["markdown-plus-plus"];
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    outputChannel: output,
    synchronize: {
      configurationSection: "markdownpp"
    }
  };
  const next = new LanguageClient("markdownpp", "Markdown++", serverOptions, clientOptions);
  next.onNotification("markdownpp/previewReady", (params: PreviewReadyParams) => {
    preview?.refreshWhenReady(params);
  });
  context.subscriptions.push({
    dispose: () => {
      void next.stop();
    }
  });
  void next.start().then(
    () => logServerInfo(next, serverPath),
    err => {
      const message = err instanceof Error ? err.message : String(err);
      output?.appendLine(`mdpp-lsp failed to start: ${message}`);
      if (status) {
        status.text = "$(error) Markdown++";
        status.tooltip = `Markdown++ language server failed: ${message}`;
      }
    }
  );
  return next;
}

async function logServerInfo(languageClient: LanguageClient, serverPath: string): Promise<void> {
  try {
    const info = await languageClient.sendRequest<MarkdownPPServerInfo>("markdownpp/serverInfo");
    const binary = info.binaryPath || serverPath;
    output?.appendLine(`mdpp-lsp ${info.version} spec ${info.specVersion || "unknown"} (${info.goVersion || "go"})`);
    output?.appendLine(`mdpp-lsp binary: ${binary}`);
    if (info.buildCommit || info.buildTime) {
      output?.appendLine(`mdpp-lsp build: ${info.buildCommit || "unknown"} ${info.buildTime || ""}`.trim());
    }
    if (status) {
      status.text = `$(markdown) mdpp ${info.version}`;
      status.tooltip = [
        `Markdown++ ${info.version}`,
        `Spec: ${info.specVersion || "unknown"}`,
        `Binary: ${binary}`,
        info.buildCommit ? `Commit: ${info.buildCommit}` : undefined,
        info.buildTime ? `Built: ${info.buildTime}` : undefined
      ].filter(Boolean).join("\n");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    output?.appendLine(`mdpp-lsp serverInfo unavailable: ${message}`);
    output?.appendLine(`mdpp-lsp binary: ${serverPath}`);
    if (status) {
      status.text = "$(warning) mdpp";
      status.tooltip = `Markdown++ server info unavailable\nBinary: ${serverPath}\n${message}`;
    }
  }
}

async function restartClient(context: vscode.ExtensionContext): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
  const config = readConfig();
  const serverPath = await resolveServerBinary(context, config);
  client = startLanguageClient(context, serverPath, config.takeOverMarkdownLanguage);
}

function readConfig() {
  const cfg = vscode.workspace.getConfiguration("markdownpp");
  return {
    takeOverMarkdownLanguage: cfg.get<boolean>("takeOverMarkdownLanguage", true),
    previewEnabled: cfg.get<boolean>("preview.enabled", true),
    serverPath: cfg.get<string>("server.path", ""),
    cliPath: cfg.get<string>("cli.path", "mdpp"),
    releaseBaseUrl: cfg.get<string>("release.baseUrl", "https://github.com/odvcencio/mdpp/releases/download"),
    binaryVersion: cfg.get<string>("binary.version", "v0.4.1"),
    formatOnSave: cfg.get<boolean>("format.onSave", true),
    pdfPaper: cfg.get<string>("pdf.paper", "letter"),
    pdfMargin: cfg.get<number>("pdf.margin", 0.5)
  };
}

async function showCommandError(work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await vscode.window.showErrorMessage(`Markdown++: ${message}`);
  }
}

function isMarkdownPPDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "markdown" || document.languageId === "markdown-plus-plus";
}

async function formatBeforeSave(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
  const editor = vscode.window.visibleTextEditors.find(candidate => candidate.document.uri.toString() === document.uri.toString());
  const options: vscode.FormattingOptions = editor
    ? {
        tabSize: Number(editor.options.tabSize) || 2,
        insertSpaces: editor.options.insertSpaces !== false
      }
    : { tabSize: 2, insertSpaces: true };
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    "vscode.executeFormatDocumentProvider",
    document.uri,
    options
  );
  return edits ?? [];
}

async function renderCurrentDocument(format: "html" | "pdf"): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const config = readConfig();
  const doc = editor.document;
  if (doc.isDirty) {
    await doc.save();
  }
  if (format === "html") {
    const target = await vscode.window.showSaveDialog({
      defaultUri: doc.uri.with({ path: doc.uri.path.replace(/\.[^.]*$/, ".html") }),
      filters: { HTML: ["html"] }
    });
    if (!target) {
      return;
    }
    await runCLI(config.cliPath, ["render", "--format=html", "-o", target.fsPath, doc.uri.fsPath]);
    await vscode.window.showInformationMessage("Rendered Markdown++ HTML.");
    return;
  }

  const target = await vscode.window.showSaveDialog({
    defaultUri: doc.uri.with({ path: doc.uri.path.replace(/\.[^.]*$/, ".pdf") }),
    filters: { PDF: ["pdf"] }
  });
  if (!target) {
    return;
  }
  await runCLI(config.cliPath, [
    "render",
    "--format=pdf",
    "--paper",
    config.pdfPaper,
    "--margin",
    String(config.pdfMargin),
    "-o",
    target.fsPath,
    doc.uri.fsPath
  ]);
  await vscode.window.showInformationMessage("Exported Markdown++ PDF.");
}

function runCLI(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(command, args, { shell: process.platform === "win32" });
    let stderr = "";
    proc.stderr.on("data", chunk => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `${command} exited with ${code}`));
      }
    });
  });
}

async function openPreview(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  if (!client) {
    throw new Error("Markdown++ language server is not running");
  }
  preview?.dispose();
  preview = new MarkdownPPPreview(context, client, editor.document);
  context.subscriptions.push(preview);
  await preview.refresh();
}

class MarkdownPPPreview implements vscode.Disposable {
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;
  private refreshTimer: NodeJS.Timeout | undefined;
  private inflight: Promise<void> | undefined;
  private refreshPending = false;
  private requestSerial = 0;
  private lastRenderedVersion = -1;
  private static readonly REFRESH_DEBOUNCE_MS = 300;

  constructor(
    context: vscode.ExtensionContext,
    private readonly languageClient: LanguageClient,
    private document: vscode.TextDocument
  ) {
    this.panel = vscode.window.createWebviewPanel(
      "markdownppPreview",
      `Preview ${path.basename(document.uri.fsPath)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [context.extensionUri, vscode.Uri.file(path.dirname(document.uri.fsPath))]
      }
    );
    const cssUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "preview.css"));
    const diagramsUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "mdpp-diagrams.js"));
    this.panel.webview.html = previewHTML(nonce(), {
      cspSource: this.panel.webview.cspSource,
      cssUri,
      diagramsUri
    });
    this.panel.webview.onDidReceiveMessage(message => {
      if (message.type === "ready") {
        void this.refresh();
      } else if (message.type === "scroll") {
        this.syncToEditor(Number(message.ratio));
      }
    });
    this.panel.onDidDispose(() => this.dispose());
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.panel.dispose();
  }

  documentUri(): string {
    return this.document.uri.toString();
  }

  refreshIfMatches(document: vscode.TextDocument): void {
    if (document.uri.toString() !== this.document.uri.toString()) {
      return;
    }
    this.document = document;
    this.scheduleRefresh();
  }

  refreshWhenReady(params: PreviewReadyParams): void {
    if (this.disposed || params.uri !== this.document.uri.toString()) {
      return;
    }
    if (params.version < this.document.version) {
      return;
    }
    void this.refresh();
  }

  scheduleRefresh(): void {
    if (this.disposed) {
      return;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, MarkdownPPPreview.REFRESH_DEBOUNCE_MS);
  }

  async refresh(): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.inflight) {
      this.refreshPending = true;
      return;
    }
    this.inflight = this.runRender();
    try {
      await this.inflight;
    } finally {
      this.inflight = undefined;
      if (this.refreshPending && !this.disposed) {
        this.refreshPending = false;
        void this.refresh();
      }
    }
  }

  private async runRender(): Promise<void> {
    const uri = this.document.uri.toString();
    const requestVersion = this.document.version;
    const serial = ++this.requestSerial;
    const result = await this.languageClient.sendRequest<RenderPreviewResult>("markdownpp/renderPreview", {
      textDocument: { uri },
      fragments: true
    });
    if (this.disposed) {
      return;
    }
    if (serial !== this.requestSerial || result.version < this.document.version || result.version < requestVersion) {
      output?.appendLine(`Dropped stale preview for ${uri}: result=${result.version}, document=${this.document.version}`);
      return;
    }
    this.lastRenderedVersion = result.version;
    this.panel.webview.postMessage({
      type: "render",
      html: result.html,
      fragments: result.fragments || [],
      version: result.version
    });
  }

  syncFromEditor(): void {
    if (this.disposed || !vscode.window.activeTextEditor || vscode.window.activeTextEditor.document.uri.toString() !== this.document.uri.toString()) {
      return;
    }
    const editor = vscode.window.activeTextEditor;
    const ratio = editor.selection.active.line / Math.max(1, editor.document.lineCount - 1);
    this.panel.webview.postMessage({ type: "scrollTo", ratio });
  }

  private syncToEditor(ratio: number): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== this.document.uri.toString()) {
      return;
    }
    const line = Math.max(0, Math.min(editor.document.lineCount - 1, Math.round(ratio * (editor.document.lineCount - 1))));
    const pos = new vscode.Position(line, 0);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
  }
}

export async function copyLocalBinaries(extensionDir: string, sourceDir: string): Promise<void> {
  const binDir = path.join(extensionDir, "bin");
  await fs.promises.mkdir(binDir, { recursive: true });
  for (const name of process.platform === "win32" ? ["mdpp-lsp.exe"] : ["mdpp-lsp"]) {
    const src = path.join(sourceDir, name);
    const dst = path.join(binDir, name);
    await fs.promises.copyFile(src, dst);
  }
}

export function tmpBinaryDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mdpp-vscode-"));
}
