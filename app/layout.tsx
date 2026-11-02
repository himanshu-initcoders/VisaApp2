import type { Metadata } from 'next';
import { Caveat, Instrument_Serif } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import './globals.css';

const caveat = Caveat({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-caveat',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Viserv — Visa & Passport Services',
  description:
    'Get your visa and passport services done quickly and easily with Viserv. We help Indian citizens with visa applications and passport services.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`scroll-smooth ${caveat.variable} ${instrumentSerif.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/BasierCircle-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Switzer-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
