import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 0G Storage SDK is Node-only on the server (fs, crypto); keep it external.
  serverExternalPackages: ["@0gfoundation/0g-ts-sdk"],
  turbopack: {
    root: process.cwd(),
    // Optional peer deps pulled in transitively by thirdweb (x402 payments) that we never use.
    resolveAlias: {
      "@x402/core/client": "./lib/stubs/empty.js",
      "@x402/evm": "./lib/stubs/empty.js",
      "@x402/evm/exact/client": "./lib/stubs/empty.js",
      "@x402/evm/upto/client": "./lib/stubs/empty.js",
      "@x402/svm/exact/client": "./lib/stubs/empty.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
