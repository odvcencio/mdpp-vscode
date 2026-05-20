import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type * as VSCode from "vscode";
import { binaryName, releaseAssetName } from "./platform";

export type BinaryConfig = {
  serverPath: string;
  releaseBaseUrl: string;
  binaryVersion: string;
};

export async function resolveServerBinary(context: VSCode.ExtensionContext, config: BinaryConfig): Promise<string> {
  if (config.serverPath.trim() !== "") {
    return config.serverPath;
  }

  const localDev = localDevelopmentBinary(context);
  if (localDev) {
    return localDev;
  }

  const bundled = context.asAbsolutePath(path.join("bin", binaryName()));
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  const managed = path.join(context.globalStorageUri.fsPath, config.binaryVersion, binaryName());
  if (fs.existsSync(managed)) {
    return managed;
  }

  const vscode = await import("vscode");
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Installing Markdown++ language server",
      cancellable: false
    },
    async () => {
      await downloadManagedBinary(managed, config);
    }
  );
  return managed;
}

export function localDevelopmentBinary(context: Pick<VSCode.ExtensionContext, "extensionPath">): string | undefined {
  const candidates = [
    path.resolve(context.extensionPath, "..", "mdpp", binaryName()),
    path.resolve(context.extensionPath, "..", "..", "mdpp", binaryName())
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function downloadManagedBinary(targetPath: string, config: BinaryConfig): Promise<void> {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const url = managedBinaryURL(config);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download ${url}: HTTP ${response.status}`);
  }

  const assetName = releaseAssetName();
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expectedSHA = await expectedAssetSHA256(config, assetName);
  verifySHA256(assetName, bytes, expectedSHA);
  const archivePath = path.join(path.dirname(targetPath), assetName);
  await fs.promises.writeFile(archivePath, bytes);
  await fs.promises.copyFile(archivePath, targetPath);
  if (process.platform !== "win32") {
    await fs.promises.chmod(targetPath, 0o755);
  }
}

export function managedBinaryURL(config: BinaryConfig): string {
  const base = config.releaseBaseUrl.replace(/\/+$/, "");
  return `${base}/${config.binaryVersion}/${releaseAssetName()}`;
}

export function managedChecksumsURL(config: BinaryConfig): string {
  const base = config.releaseBaseUrl.replace(/\/+$/, "");
  return `${base}/${config.binaryVersion}/checksums.txt`;
}

export function checksumForAsset(checksums: string, assetName: string): string | undefined {
  for (const line of checksums.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(trimmed);
    if (match && path.basename(match[2]) === assetName) {
      return match[1].toLowerCase();
    }
  }
  return undefined;
}

async function expectedAssetSHA256(config: BinaryConfig, assetName: string): Promise<string> {
  const url = managedChecksumsURL(config);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`download ${url}: HTTP ${response.status}`);
  }
  const checksum = checksumForAsset(await response.text(), assetName);
  if (!checksum) {
    throw new Error(`checksums.txt does not contain ${assetName}`);
  }
  return checksum;
}

function verifySHA256(assetName: string, bytes: Uint8Array, expected: string): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${assetName}: got ${actual}, want ${expected}`);
  }
}
