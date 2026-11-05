import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Caveat, Instrument_Serif } from 'next/font/google';
import Script from 'next/script';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { GtmRouteListener } from '@/components/analytics/GtmRouteListener';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildSiteGraphJsonLd, getSiteUrl } from '@/lib/seo/jsonld';
import './globals.css';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim();
const siteUrl = getSiteUrl();

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

const DEFAULT_TITLE = 'Viserv — Visa & Passport Services';
const DEFAULT_DESCRIPTION =
  'Get your visa and passport services done quickly and easily with Viserv. We help Indian citizens with visa applications and passport services.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: '/',
    siteName: 'Viserv',
    type: 'website',
    images: [{ url: '/logo.png', alt: 'Viserv' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ['/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  verification: {
    other: {
      'facebook-domain-verification': '0qon6e4g8w89mzseub1qqezm2042jm',
    },
  },
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
        <JsonLd data={buildSiteGraphJsonLd()} />
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
        {GTM_ID ? (
          <>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0"
                width="0"
                style={{ display: 'none', visibility: 'hidden' }}
                title="Google Tag Manager"
              />
            </noscript>
            <Script id="gtm" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${GTM_ID}');
              `}
            </Script>
            <Suspense fallback={null}>
              <GtmRouteListener />
            </Suspense>
          </>
        ) : null}
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
