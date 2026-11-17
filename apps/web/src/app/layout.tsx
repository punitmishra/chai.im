import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Chai.im - Secure Chat',
  description: 'End-to-end encrypted messaging with Signal Protocol. Your conversations, zero knowledge.',
  manifest: '/manifest.json',
  icons: [
    // Only the SVG favicon exists; the .ico / apple-touch PNG were 404s.
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', url: '/favicon.svg' },
  ],
  openGraph: {
    title: 'Chai.im - Secure Chat',
    description: 'End-to-end encrypted messaging with Signal Protocol. Your conversations, zero knowledge.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#06b6d4',
  width: 'device-width',
  initialScale: 1,
  // No maximumScale — allow pinch-zoom (WCAG 1.4.4).
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-950 text-white antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
