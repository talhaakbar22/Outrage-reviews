import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "16.171.140.220",
    // ngrok tunnel (update when the subdomain changes):
    // "6b9d-43-251-255-105.ngrok-free.app",
    "hsxperts.co",
  ],
};

export default nextConfig;
