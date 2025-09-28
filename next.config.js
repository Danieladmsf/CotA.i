/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Enable SWC minifier for better performance
  swcMinify: true,
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
    "**.¹.cloudworkstations.dev", 
    "72.60.61.118:8080", 
    "72.60.61.118:3000", 
    "72.60.61.118:3001", 
    "72-60-61-118.nip.io:3000", 
    "72-60-61-118.nip.io:3001", 
    "**.serveo.net", 
    "sandra-optimal-magistratically.ngrok-free.app"
  ],
};

module.exports = nextConfig;
