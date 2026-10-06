import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@cursor/sdk",
    "@connectrpc/connect",
    "@connectrpc/connect-node",
    "undici",
  ],
  allowedDevOrigins: [
    "16.171.140.220",
    // ngrok tunnel (update when the subdomain changes):
    // "c541-43-251-255-105.ngrok-free.app",
    // Firebase Hosting / App Hosting (outrageldn-dashboard) — not hsxperts.co
    "outrageldn-dashboard.web.app",
    "outrageldn-dashboard.firebaseapp.com",
  ],
};

export default nextConfig;
