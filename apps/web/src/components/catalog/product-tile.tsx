import type { ProductDto } from '@nagaw/shared';
import { CATEGORY_TONES } from '@/lib/catalog/labels';

/** Photo URL on the web origin (proxied, versioned so it can be cached). */
export function productPhotoUrl(
  product: Pick<ProductDto, 'id' | 'photoVersion'>,
) {
  return product.photoVersion
    ? `/espace/produits/${product.id}/photo?v=${product.photoVersion}`
    : null;
}

/**
 * Product picture: its photo, or its first letter on the category color, so
 * that people who read slowly still recognise products at a glance.
 */
export function ProductTile({
  product,
  size = 'md',
}: {
  product: Pick<ProductDto, 'id' | 'name' | 'photoVersion' | 'category'>;
  size?: 'md' | 'lg';
}) {
  const url = productPhotoUrl(product);
  const box = size === 'lg' ? 'size-40 text-6xl' : 'size-16 text-2xl';
  if (url) {
    return (
      // Proxied private photo: next/image would need a public loader.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`${box} shrink-0 rounded-2xl bg-surface-muted object-cover`}
      />
    );
  }
  const tone = CATEGORY_TONES[product.category?.color ?? 'brand'];
  return (
    <span
      aria-hidden
      className={`${box} ${tone} flex shrink-0 items-center justify-center rounded-2xl font-extrabold`}
    >
      {product.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
