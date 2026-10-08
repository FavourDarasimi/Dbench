import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Django endpoints end with "/", and Next's default 308 canonicalization
  // would bounce every API call (and re-POST bodies) before the proxy sees it.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
