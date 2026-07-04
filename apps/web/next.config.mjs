/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@widget-gen/shared"],
  serverExternalPackages: ["@cursor/sdk", "archiver", "@widget-gen/generator", "better-sqlite3"],
};

export default nextConfig;
