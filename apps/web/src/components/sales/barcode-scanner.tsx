'use client';

import { ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { buttonClasses } from '@/components/ui/button-styles';
import { isNewRead, type LastSeen } from '@/lib/sales/barcode';

/** What the caisse did with a code: told on screen and to screen readers. */
export interface ScanOutcome {
  ok: boolean;
  message: string;
}

/** The codes found on products: shop barcodes, then QR codes. */
const FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
] as const;

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

/**
 * The phone's own reader when it has one (Chrome on Android), otherwise
 * the same reader in WebAssembly, loaded only now and served by the app
 * itself: no outside site, and kept by the service worker for offline
 * sales (ADR-068).
 */
async function makeDetector(): Promise<Detector> {
  const Native = (
    globalThis as {
      BarcodeDetector?: {
        new (options: { formats: string[] }): Detector;
        getSupportedFormats(): Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats();
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length > 0) return new Native({ formats });
  }
  const { BarcodeDetector, setZXingModuleOverrides } =
    await import('barcode-detector/ponyfill');
  const wasm = new URL('zxing-wasm/reader/zxing_reader.wasm', import.meta.url)
    .href;
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? wasm : prefix + path,
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

/**
 * « Scanner » (ADR-068): the back camera reads barcodes and QR codes, and
 * each product read goes straight into the cart. The sheet stays open to
 * scan the next one; the same box held in view counts once.
 */
export function BarcodeScanner({
  open,
  onClose,
  onCode,
}: {
  open: boolean;
  onClose: () => void;
  onCode: (code: string) => ScanOutcome;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  // Each opening starts clean: no message from the last time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setProblem(null);
      setOutcome(null);
    }
  }
  // The latest handler, without restarting the camera at each cart change.
  const handle = useRef(onCode);
  useEffect(() => {
    handle.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: LastSeen | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem(
          'Ce navigateur ne donne pas accès à la caméra. Utilisez un lecteur de codes-barres ou tapez le code dans la recherche.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (error) {
        setProblem(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'La caméra est refusée. Autorisez-la dans les réglages du navigateur pour scanner.'
            : 'La caméra ne s’ouvre pas. Utilisez un lecteur de codes-barres ou tapez le code dans la recherche.',
        );
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      let detector: Detector;
      try {
        detector = await makeDetector();
      } catch {
        setProblem(
          'La lecture des codes n’a pas pu démarrer. Vérifiez la connexion une première fois, puis réessayez.',
        );
        return;
      }
      const look = async () => {
        if (stopped || !video.current) return;
        if (video.current.readyState >= 2) {
          const found = await detector.detect(video.current).catch(() => []);
          const code = found[0]?.rawValue?.trim();
          const now = Date.now();
          if (code) {
            const fresh = isNewRead(code, last, now);
            // Seen again: still the same box, its clock starts over.
            last = { code, seenAt: now };
            if (fresh) {
              const result = handle.current(code);
              setOutcome(result);
              if (result.ok) navigator.vibrate?.(60);
            }
          }
        }
        timer = setTimeout(look, 200);
      };
      void look();
    }

    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open]);

  return (
    <BottomSheet open={open} title="Scanner un produit" onClose={onClose}>
      {problem ? (
        <p
          role="alert"
          className="rounded-2xl bg-warning-soft p-4 font-bold text-warning-ink"
        >
          {problem}
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-ink">
          {/* The picture is for the eye; what was read is said below. */}
          <video
            ref={video}
            muted
            playsInline
            aria-hidden
            className="aspect-[4/3] w-full object-cover"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-4 border-canvas/80"
          />
        </div>
      )}
      <p
        role="status"
        className={`flex min-h-12 items-center gap-2 rounded-2xl px-4 font-bold ${
          outcome?.ok
            ? 'bg-sales-soft text-sales-ink'
            : outcome
              ? 'bg-warning-soft text-warning-ink'
              : 'bg-canvas text-ink-muted'
        }`}
      >
        <ScanLine aria-hidden className="size-5 shrink-0" />
        {outcome?.message ?? 'Visez le code-barres ou le QR code du produit.'}
      </p>
      <button
        type="button"
        onClick={onClose}
        className={buttonClasses('primary', 'w-full')}
      >
        Terminé
      </button>
    </BottomSheet>
  );
}
