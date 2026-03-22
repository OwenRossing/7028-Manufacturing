import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // AWS S3
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.s3.*.amazonaws.com" },
      // Cloudflare R2
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" }
      // Add your specific S3-compatible hostname here, e.g.:
      // { protocol: "https", hostname: "assets.yourteam.com" }
    ]
  }
};

export default nextConfig;
