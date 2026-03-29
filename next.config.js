const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Add this to silence Turbopack vs webpack conflict
  turbopack: {},

  distDir: '.next',

  outputFileTracingRoot: path.join(__dirname),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:
          (process.env.NEXT_PUBLIC_SUPABASE_URL &&
            new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname) ||
          'nlrmsamgpajuprldkpms.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
    qualities: [75, 85, 95],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  reactStrictMode: false,

  experimental: {
    optimizePackageImports: [],
    staleTimes: { dynamic: 30, static: 300 },
  },

  webpack: (config, { isServer, dev }) => {
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
        '@/lib/queue': false,
        bullmq: false,
        ioredis: false,
      };
    }

    const fileLoaderRule = config.module.rules.find((rule) => rule?.test?.test?.('.svg'));

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: {
          not: [...fileLoaderRule.resourceQuery.not, /url/],
        },
        use: ['@svgr/webpack'],
      }
    );

    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },

  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr', 'bullmq', 'ioredis'],

  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com",
      "frame-src 'self' https://api.razorpay.com https://accounts.google.com https://*.supabase.co https://vercel.live https://*.vercel.live",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), accelerometer=(), gyroscope=()',
          },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        ],
      },
    ];
  },

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
