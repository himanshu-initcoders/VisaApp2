import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        // Existing seeded country images still point here until replaced with our CDN
        protocol: 'https',
        hostname: 'media.atlys.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // pdfjs / tesseract load workers and wasm from CDN at runtime
  serverExternalPackages: ['tesseract.js', 'pdfjs-dist'],
  experimental: {
    // Default Server Action body limit is 1MB; country banner uploads allow up to 5MB
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
