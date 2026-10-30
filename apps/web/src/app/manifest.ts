import type { MetadataRoute } from 'next';

/** Makes the app installable on the home screen (ADR-020). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/espace',
    name: 'Nagaw Business',
    short_name: 'Nagaw',
    description:
      'Gérez votre boutique depuis votre téléphone, même sans connexion.',
    lang: 'fr',
    start_url: '/espace',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f7fc',
    theme_color: '#ffffff',
    categories: ['business', 'finance', 'productivity'],
    // From a shortcut or a link: back to the open application, not a second one.
    launch_handler: { client_mode: 'navigate-existing' },
    // A long press on the icon of the application.
    shortcuts: [
      {
        name: 'Vendre',
        url: '/caisse',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Ventes',
        url: '/espace/ventes',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Produits',
        url: '/espace/produits',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
