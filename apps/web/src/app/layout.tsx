import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { ConnectionBanner } from '@/components/pwa/connection-banner';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import './globals.css';

// Choice of the owner (ADR-021): rounded, very legible, full French accents.
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'latin-ext'],
});

export const metadata: Metadata = {
  title: 'Nagaw Business',
  description:
    'Gérez votre boutique depuis votre téléphone, même sans connexion : stock, ventes, factures et trésorerie.',
  applicationName: 'Nagaw Business',
  appleWebApp: { capable: true, title: 'Nagaw', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#6d28d9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ConnectionBanner />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
