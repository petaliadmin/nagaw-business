'use client';

import { PRODUCT_PHOTO_MAX_BYTES } from '@nagaw/shared';
import { Camera, ImageOff } from 'lucide-react';
import { useId, useRef, useState } from 'react';

const MAX_SIDE = 800;

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.82));
}

/**
 * Phone photos weigh several megabytes: resize to 800 px on the device and
 * re-encode (WebP, or JPEG where WebP encoding is missing) before sending.
 */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await encode(canvas, 'image/webp');
  if (!blob || blob.type !== 'image/webp')
    blob = await encode(canvas, 'image/jpeg');
  if (!blob) throw new Error('Encodage de l’image impossible');
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `photo.${extension}`, { type: blob.type });
}

export function PhotoField({
  currentUrl,
  error,
  legend = 'Photo (facultatif)',
  removable = true,
}: {
  /** Current photo, on the edit form. */
  currentUrl?: string | null;
  error?: string;
  legend?: string;
  /** Offers « Retirer la photo » when there is one. */
  removable?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const original = event.currentTarget.files?.[0];
    const target = event.currentTarget;
    if (!original) return;
    setBusy(true);
    setMessage(null);
    try {
      const small = await shrink(original);
      if (small.size > PRODUCT_PHOTO_MAX_BYTES)
        throw new Error(`Photo encore trop lourde (${small.size} octets)`);
      const files = new DataTransfer();
      files.items.add(small);
      target.files = files.files;
      setPreview(URL.createObjectURL(small));
      setRemoved(false);
    } catch (failure) {
      console.warn('Photo refusée', failure);
      target.value = '';
      setMessage(
        'Cette image n’a pas pu être lue. Essayez une autre photo (JPEG ou PNG).',
      );
    } finally {
      setBusy(false);
    }
  }

  const errorId = error || message ? `${inputId}-error` : undefined;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-base font-semibold">{legend}</legend>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-surface-muted">
          {preview && !removed ? (
            // A local preview (blob:) or the proxied photo: next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Aperçu de la photo"
              className="size-full object-cover"
            />
          ) : (
            <ImageOff aria-hidden className="size-8 text-ink-muted" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line-strong bg-surface px-4 text-base font-bold focus-within:outline-3 focus-within:outline-focus"
          >
            <Camera aria-hidden className="size-5" />
            {busy
              ? 'Préparation…'
              : preview && !removed
                ? 'Changer la photo'
                : 'Prendre ou choisir une photo'}
            <input
              ref={input}
              id={inputId}
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onChange}
              aria-describedby={errorId}
              className="sr-only"
            />
          </label>
          {currentUrl && removable && (
            <label className="inline-flex min-h-12 items-center gap-3 text-base">
              <input
                type="checkbox"
                name="removePhoto"
                checked={removed}
                onChange={(event) => {
                  setRemoved(event.currentTarget.checked);
                  if (event.currentTarget.checked && input.current)
                    input.current.value = '';
                }}
                className="size-6 accent-brand-strong"
              />
              Retirer la photo
            </label>
          )}
        </div>
      </div>
      {(error || message) && (
        <p
          id={errorId}
          role="alert"
          className="text-base font-medium text-danger-ink"
        >
          {message ?? error}
        </p>
      )}
    </fieldset>
  );
}
