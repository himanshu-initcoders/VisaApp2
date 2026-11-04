import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    // Next 16: local Image src with query strings need an allowlist.
    // - /api/media?key=... (private S3 proxy)
    // - static files under /public (logo, icons, etc.) — no query string
    localPatterns: [
      {
        pathname: '/api/media',
        // omit `search` to allow any ?key=... value
      },
      {
        pathname: '/**',
        search: '',
      },
    ],
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
    // Checkout/submit send traveller JSON + draft storage keys only (file bytes go via
    // FormData to /api/apply/draft-files). Keep proxy + Server Action limits aligned;
    // default proxy buffer is 10MB and truncates → JSON.parse 500.
    proxyClientMaxBodySize: '20mb',
    // Default Server Action body limit is 1MB; headroom for large multi-traveller JSON.
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
