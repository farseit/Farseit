/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let apiHost = { protocol: 'http', hostname: 'localhost' };
try {
  const u = new URL(apiUrl);
  apiHost = { protocol: u.protocol.replace(':', ''), hostname: u.hostname, ...(u.port ? { port: u.port } : {}) };
} catch {}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/webp'],
    remotePatterns: [apiHost, { protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion'] },
};

module.exports = nextConfig;
