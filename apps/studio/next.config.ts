import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appDir, "../..");
const repoNodeModules = resolve(repoRoot, "node_modules");

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.modules = [
      repoNodeModules,
      resolve(appDir, "node_modules"),
      ...(config.resolve.modules ?? []),
    ];
    return config;
  },
};

export default nextConfig;
