/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  experimental: {
    // The double-asterisk wildcard `**` is required to match any number of subdomains.
    allowedDevOrigins: ["**.¹.cloudworkstations.dev", "72.60.61.118:8080"],
  },
};

module.exports = nextConfig;
