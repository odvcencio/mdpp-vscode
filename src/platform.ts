import * as os from "node:os";

export type PlatformTarget = {
  platform: NodeJS.Platform;
  arch: string;
};

export function binaryName(target: PlatformTarget = { platform: process.platform, arch: process.arch }): string {
  return target.platform === "win32" ? "mdpp-lsp.exe" : "mdpp-lsp";
}

export function releaseAssetName(target: PlatformTarget = { platform: process.platform, arch: process.arch }): string {
  const platform = normalizePlatform(target.platform);
  const arch = normalizeArch(target.arch);
  return `mdpp-lsp_${platform}_${arch}${target.platform === "win32" ? ".exe" : ""}`;
}

export function normalizePlatform(platform: NodeJS.Platform): string {
  switch (platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`unsupported platform: ${platform}`);
  }
}

export function normalizeArch(arch: string = os.arch()): string {
  switch (arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`unsupported architecture: ${arch}`);
  }
}
