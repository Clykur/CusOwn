const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence "multiple lockfiles" warning by pinning the tracing root to this project.
  outputFileTracingRoot: path.resolve(__dirname),
  // Disabled to avoid double-mount/render storms that trigger repeated GET /admin/dashboard.
  reactStrictMode: false,
  // Disable static optimization for better dev experience
  experimental: {
    // Ensure proper chunk loading
    optimizePackageImports: [],
    // Cache dynamic RSC segments in client router to reduce repeated GET /admin|owner|customer/dashboard in dev.
    staleTimes: { dynamic: 30, static: 300 },
  },
  // Keep Supabase server-only out of client bundles; avoid custom splitChunks
  // so server and client chunk paths stay in sync (fixes vendor-chunks/@supabase.js ENOENT).
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/supabase/server-auth': false,
        '@/lib/supabase/server': false,
      };
    }
    return config;
  },
  // Resolve @supabase on server via Node (avoids broken vendor chunk path in server bundle).
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  async headers() {
    return [
      {
        // Apply security headers to all routes except static assets
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Ensure proper MIME types for static assets
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Ensure icon.svg is handled correctly
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
