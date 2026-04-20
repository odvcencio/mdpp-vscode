import test from "node:test";
import assert from "node:assert/strict";
import { checksumForAsset, managedBinaryURL, managedChecksumsURL } from "../src/binary";

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
