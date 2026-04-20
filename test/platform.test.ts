import test from "node:test";
import assert from "node:assert/strict";
import {
  binaryName,
  normalizeArch,
  normalizePlatform,
  releaseAssetName
} from "../src/platform";

test("binaryName matches host executable convention", () => {
  assert.equal(binaryName({ platform: "linux", arch: "x64" }), "mdpp-lsp");
  assert.equal(binaryName({ platform: "darwin", arch: "arm64" }), "mdpp-lsp");
  assert.equal(binaryName({ platform: "win32", arch: "x64" }), "mdpp-lsp.exe");
});

test("releaseAssetName matches Go release artifact names", () => {
  assert.equal(releaseAssetName({ platform: "linux", arch: "x64" }), "mdpp-lsp_linux_amd64");
  assert.equal(releaseAssetName({ platform: "darwin", arch: "arm64" }), "mdpp-lsp_darwin_arm64");
  assert.equal(releaseAssetName({ platform: "win32", arch: "x64" }), "mdpp-lsp_windows_amd64.exe");
});

test("platform and arch normalization rejects unsupported targets", () => {
  assert.equal(normalizePlatform("darwin"), "darwin");
  assert.equal(normalizeArch("x64"), "amd64");
  assert.throws(() => normalizePlatform("freebsd"), /unsupported platform/);
  assert.throws(() => normalizeArch("ia32"), /unsupported architecture/);
});
