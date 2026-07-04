/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@widget-gen/generator", "@widget-gen/shared"],
  serverExternalPackages: ["@cursor/sdk", "archiver"],
};

export default nextConfig;
