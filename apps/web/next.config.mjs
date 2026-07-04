/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@widget-gen/shared"],
  serverExternalPackages: ["@cursor/sdk", "archiver", "@widget-gen/generator", "better-sqlite3"],
  // Windows dev: persistent webpack pack cache often races with HMR and leaves missing .pack.gz files.
  webpack: (config, { dev }) => {
    if (dev && process.platform === "win32") {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
