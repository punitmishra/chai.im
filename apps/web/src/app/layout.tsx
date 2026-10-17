import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Chai.im - Secure Chat',
  description: 'End-to-end encrypted messaging with Signal Protocol. Your conversations, zero knowledge.',
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', url: '/favicon.ico' },
    { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon.png' },
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
  maximumScale: 1,
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
