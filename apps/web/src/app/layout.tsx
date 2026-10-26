import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { ConnectionBanner } from '@/components/pwa/connection-banner';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { siteUrl } from '@/lib/env';
import { allowIndexing, SITE_NAME } from '@/lib/seo';
import './globals.css';

// Choice of the owner (ADR-021): rounded, very legible, full French accents.
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'latin-ext'],
});

const DESCRIPTION =
  'Gérez votre boutique depuis votre téléphone, même sans connexion : stock, ventes, factures et trésorerie.';

export const metadata: Metadata = {
  // Absolute URLs (canonical, Open Graph) are built from the public URL.
  metadataBase: new URL(siteUrl()),
  // No title template: every page already names the brand in its title.
  title: SITE_NAME,
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'fr_FR',
    title: SITE_NAME,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
  robots: allowIndexing(process.env)
    ? { index: true, follow: true, 'max-image-preview': 'large' }
    : { index: false, follow: false },
  formatDetection: { telephone: false },
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
      {/* Browser extensions (ColorZilla's cz-shortcut-listen…) add
          attributes to <body> before React loads: only this element's
          attributes are exempt, never its content. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ConnectionBanner />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
