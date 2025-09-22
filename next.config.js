/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable optimization for development with tunnels
  swcMinify: false,
  experimental: {
    esmExternals: false
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
    ],
  },
  // The double-asterisk wildcard `**` is required to match any number of subdomains.
  allowedDevOrigins: ["**.¹.cloudworkstations.dev", "72.60.61.118:8080", "**.serveo.net", "sandra-optimal-magistratically.ngrok-free.app"],
};

module.exports = nextConfig;
