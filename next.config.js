/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Enable SWC minifier for better performance
  swcMinify: true,
  // Generate ETag for cache validation (forces browser to check if file changed)
  generateEtags: true,
  // Optimize webpack configuration for large chunks and remote access
  webpack: (config, { dev }) => {
    if (dev) {
      // Increase chunk loading timeout for development (remote access)
      config.output.chunkLoadTimeout = 300000; // 5 minutes for slow connections
    }
    return config;
  },
  // Modularize imports to reduce bundle size
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'bhpy0qvpkgnuumnn.public.blob.vercel-storage.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '**',
      },
    ],
  },
  // Allowed origins for external access
  allowedDevOrigins: [
    "**.cloudworkstations.dev",
    "72.60.61.118:8080",
    "72.60.61.118:3000",
    "72.60.61.118:3001",
    "72-60-61-118.nip.io",
    "72-60-61-118.nip.io:3000",
    "72-60-61-118.nip.io:3001",
    "**.serveo.net",
    "sandra-optimal-magistratically.ngrok-free.app"
  ],
  // Optimize production bundle
  productionBrowserSourceMaps: false,
  compress: true,
  // Cache control headers - force revalidation in dev
  async headers() {
    return [
      {
        // For all pages - always revalidate to prevent stale cache
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
