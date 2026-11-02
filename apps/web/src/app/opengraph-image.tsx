import { ImageResponse } from 'next/og';
import { OG_SIZE, OgCard } from '@/lib/og-card';

export const alt =
  'Nagaw Business : sachez qui vous doit et ce que vous gagnez, depuis votre téléphone.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <OgCard
      eyebrow="Gratuit pour commencer"
      title="Sachez qui vous doit et ce que vous gagnez, depuis votre téléphone"
    />,
    size,
  );
}
