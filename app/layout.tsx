import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Visa & Passport Services - Fast, Easy, Reliable',
  description:
    'Get your visa and passport services done quickly and easily. We help Indian citizens with visa applications and passport services.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
