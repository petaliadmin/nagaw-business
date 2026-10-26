import { ImageResponse } from 'next/og';
import { OG_SIZE, OgCard } from '@/lib/og-card';

export const alt =
  'Nagaw Business : tenez votre boutique au franc près, depuis votre téléphone.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <OgCard
      eyebrow="Gratuit pour commencer"
      title="Tenez votre boutique au franc près, depuis votre téléphone"
    />,
    size,
  );
}
