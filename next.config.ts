import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin serverless functions to London for UK data residency (Vercel)
  // Region is also set in vercel.json
  poweredByHeader: false,
  // Allow PDF uploads to the form importer server action.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // The founder console moved from /admin to /founder. Keep old bookmarks and
  // any in-flight links working.
  async redirects() {
    return [
      { source: "/admin", destination: "/founder", permanent: true },
      { source: "/admin/:path*", destination: "/founder/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
