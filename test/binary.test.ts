import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { binaryName } from "../src/platform";
import { checksumForAsset, localDevelopmentBinary, managedBinaryURL, managedChecksumsURL, resolveServerBinary } from "../src/binary";

test("managedBinaryURL trims base slashes and appends versioned asset", () => {
  const url = managedBinaryURL({
    serverPath: "",
    releaseBaseUrl: "https://example.invalid/releases/download///",
    binaryVersion: "v1.2.3"
  });
  assert.match(url, /^https:\/\/example\.invalid\/releases\/download\/v1\.2\.3\/mdpp-lsp_/);
  assert.doesNotMatch(url, /download\/\/+v1\.2\.3/);
});

test("managedChecksumsURL points at versioned checksums", () => {
  assert.equal(
    managedChecksumsURL({
      serverPath: "",
      releaseBaseUrl: "https://example.invalid/releases/download/",
      binaryVersion: "v1.2.3"
    }),
    "https://example.invalid/releases/download/v1.2.3/checksums.txt"
  );
});

test("checksumForAsset reads sha256sum and shasum style rows", () => {
  const checksum = "a".repeat(64);
  assert.equal(checksumForAsset(`${checksum}  mdpp-lsp_linux_amd64\n`, "mdpp-lsp_linux_amd64"), checksum);
  assert.equal(checksumForAsset(`${checksum} *mdpp-lsp_windows_amd64.exe\n`, "mdpp-lsp_windows_amd64.exe"), checksum);
  assert.equal(checksumForAsset(`${checksum}  ./mdpp_linux_amd64\n`, "mdpp-lsp_linux_amd64"), undefined);
});

test("localDevelopmentBinary prefers sibling mdpp build before managed downloads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdpp-vscode-bin-test-"));
  try {
    const extensionPath = path.join(root, "mdpp-vscode");
    const mdppPath = path.join(root, "mdpp");
    fs.mkdirSync(extensionPath, { recursive: true });
    fs.mkdirSync(mdppPath, { recursive: true });
    const server = path.join(mdppPath, binaryName());
    fs.writeFileSync(server, "");

    assert.equal(localDevelopmentBinary({ extensionPath }), server);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resolveServerBinary prefers sibling mdpp build over stale bundled binary", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mdpp-vscode-resolve-test-"));
  try {
    const extensionPath = path.join(root, "mdpp-vscode");
    const mdppPath = path.join(root, "mdpp");
    const storagePath = path.join(root, "storage");
    fs.mkdirSync(path.join(extensionPath, "bin"), { recursive: true });
    fs.mkdirSync(mdppPath, { recursive: true });
    const localServer = path.join(mdppPath, binaryName());
    const bundledServer = path.join(extensionPath, "bin", binaryName());
    fs.writeFileSync(localServer, "");
    fs.writeFileSync(bundledServer, "");

    const context = {
      extensionPath,
      globalStorageUri: { fsPath: storagePath },
      asAbsolutePath: (relative: string) => path.join(extensionPath, relative)
    } as any;

    assert.equal(
      await resolveServerBinary(context, {
        serverPath: "",
        releaseBaseUrl: "https://example.invalid/releases/download",
        binaryVersion: "v1.2.3"
      }),
      localServer
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
