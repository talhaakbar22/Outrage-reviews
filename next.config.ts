import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "16.171.140.220",
    // add your domain if you use one too, e.g.:
    // "reviews.yourdomain.com",
  ],
};

export default nextConfig;