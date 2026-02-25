const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow strict/CI builds to use an isolated dist directory
  // so dev `.next` artifacts cannot interfere with production builds.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Keep console logs in development, strip noisy logs in production bundles.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
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
  webpack: (config, { isServer, dev }) => {
    // Prevent intermittent ENOENT on .next/cache/*.pack.gz during dev
    // by using in-memory cache instead of filesystem pack cache.
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }

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
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
      "frame-src 'self' https://api.razorpay.com",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        // Apply security headers to all routes except static assets
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), accelerometer=(), gyroscope=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
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
