import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server blocks cross-origin requests by default. Needed to
  // access the app through the cloudflared/ngrok tunnels (e.g. from a
  // phone) instead of localhost — both assign a new random subdomain each
  // restart, so these are wildcards rather than one fixed hostname.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev"],
};

export default nextConfig;
