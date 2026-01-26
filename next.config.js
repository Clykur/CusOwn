/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable static optimization for better dev experience
  experimental: {
    // Ensure proper chunk loading
    optimizePackageImports: [],
  },
  // Improve webpack chunk handling
  webpack: (config, { isServer, dev }) => {
    // Exclude server-only files from client bundles
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/supabase/server-auth': false,
        '@/lib/supabase/server': false,
      };
    }
    
    // Better error handling for chunk loading
    if (!isServer && dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Create a separate vendor chunk
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },
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
}

module.exports = nextConfig

