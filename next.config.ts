import type { NextConfig } from 'next';
import { LEGACY_VISA_LISTING_REDIRECTS } from './lib/seo/legacyVisaListingRedirects';

const nextConfig: NextConfig = {
  /* config options here */
  // Required for the production Docker image (copies a minimal server into the runner).
  output: 'standalone',
  reactStrictMode: true,
  // 301 retired listing slugs (and /apply) so Google-indexed URLs do not 404.
  async redirects() {
    return LEGACY_VISA_LISTING_REDIRECTS.flatMap(({ source, destination }) => [
      { source, destination, statusCode: 301 as const },
      {
        source: `${source}/:path*`,
        destination: `${destination}/:path*`,
        statusCode: 301 as const,
      },
    ]);
  },
  // Dev-only: allow ngrok / Cloudflare tunnels so login, Server Actions, and
  // /_next assets work when the browser Origin is the tunnel host (not localhost).
  // Hostnames only — no scheme or port. Restart `next dev` after changing this.
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
    '*.trycloudflare.com',
  ],
  images: {
    // Next 16: custom image qualities must be declared in qualities array
    qualities: [75, 85, 90, 95, 100],
    formats: ['image/avif', 'image/webp'],
    // Keep optimized listing heroes warm across revalidations (default is 60s).
    minimumCacheTTL: 86400,
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
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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
      // Let Server Actions (login OTP, apply forms) accept ngrok Origin headers.
      allowedOrigins: [
        '*.ngrok-free.app',
        '*.ngrok-free.dev',
        '*.ngrok.app',
        '*.ngrok.io',
        '*.trycloudflare.com',
      ],
    },
  },
};

export default nextConfig;
