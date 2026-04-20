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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
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
  }
}

export async function deactivate(): Promise<void> {
  preview?.dispose();
  preview = undefined;
  if (client) {
    await client.stop();
    client = undefined;
  }
}

function startLanguageClient(context: vscode.ExtensionContext, serverPath: string, takeOverMarkdown: boolean): LanguageClient {
  const serverOptions: ServerOptions = {
    command: serverPath,
    transport: TransportKind.stdio
  };
  const documentSelector: string[] = takeOverMarkdown
    ? ["markdown", "markdown-plus-plus"]
    : ["markdown-plus-plus"];
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {
      configurationSection: "markdownpp"
    }
  };
  const next = new LanguageClient("markdownpp", "Markdown++", serverOptions, clientOptions);
  context.subscriptions.push({
    dispose: () => {
      void next.stop();
    }
  });
  void next.start();
  return next;
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
    binaryVersion: cfg.get<string>("binary.version", "v0.1.10"),
    formatOnSave: cfg.get<boolean>("format.onSave", false),
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
    this.panel.webview.html = previewHTML(nonce());
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
    this.panel.dispose();
  }

  refreshIfMatches(document: vscode.TextDocument): void {
    if (document.uri.toString() !== this.document.uri.toString()) {
      return;
    }
    this.document = document;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.disposed) {
      return;
    }
    const result = await this.languageClient.sendRequest<{ html: string }>("markdownpp/renderPreview", {
      textDocument: { uri: this.document.uri.toString() }
    });
    this.panel.webview.postMessage({ type: "render", html: result.html });
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
