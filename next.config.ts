import type { NextConfig } from "next";

// Baseline security headers applied to every response. Kept deliberately minimal
// (no script-src CSP) so it hardens the app without needing per-request nonces.
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Harmless over plain HTTP (browsers ignore it); enforced once served via HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Logo uploads go through a server action; the default 1 MB cap is too
      // small for a 2 MB image plus multipart overhead.
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        // Everything gets the baseline headers.
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        // Clickjacking protection for every route EXCEPT the embeddable widget.
        source: "/((?!embed).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // The booking widget is meant to be embedded in any customer's website.
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
