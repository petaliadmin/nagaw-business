/** Address of the shop's logo; the version keeps the browser's copy fresh. */
export function logoUrl(version: string | null): string | null {
  return version ? `/espace/logo?v=${version}` : null;
}

/** The logo of the shop on its documents; nothing without one. */
export function ShopLogo({ version }: { version: string | null }) {
  const src = logoUrl(version);
  if (!src) return null;
  return (
    // Proxied and versioned already: next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Logo de la boutique"
      className="max-h-16 w-auto max-w-40 object-contain object-left"
    />
  );
}
