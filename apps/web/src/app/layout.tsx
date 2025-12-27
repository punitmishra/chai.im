import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Chai.im - Secure Chat',
  description: 'End-to-end encrypted chat platform with Signal Protocol encryption',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Chai.im - Secure Chat',
    description: 'End-to-end encrypted chat platform with Signal Protocol encryption',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
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
      <body className="bg-zinc-950 text-white antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
