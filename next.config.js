/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Enable SWC minifier for better performance
  swcMinify: true,
  // Remove problematic experimental settings
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
    ],
  },
  // The double-asterisk wildcard `**` is required to match any number of subdomains.
  allowedDevOrigins: ["**.¹.cloudworkstations.dev", "72.60.61.118:8080", "**.serveo.net", "sandra-optimal-magistratically.ngrok-free.app"],
};

module.exports = nextConfig;
