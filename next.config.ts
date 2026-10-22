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
  serverExternalPackages: [
    'tesseract.js',
    'pdfjs-dist',
    'onnxruntime-web',
    'onnxruntime-node',
    '@mediapipe/tasks-vision',
  ],
  experimental: {
    // Apply checkout POSTs passport/docs as base64 in Server Actions and can exceed 10MB.
    // proxy.ts clones the body; default proxy buffer is 10MB and truncates → JSON.parse 500.
    proxyClientMaxBodySize: '20mb',
    // Default Server Action body limit is 1MB; keep aligned with proxy buffer above.
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
