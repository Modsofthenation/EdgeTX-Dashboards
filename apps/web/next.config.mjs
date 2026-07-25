/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@widget-gen/shared",
    "@widget-gen/layout-verify",
    "@widget-gen/editor-core",
    "@widget-gen/sim-preview",
    "@widget-gen/generator",
    "@edgetx/simulator-ui",
  ],
  serverExternalPackages: ["@cursor/sdk", "archiver", "better-sqlite3"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    if (dev && process.platform === "win32") {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
