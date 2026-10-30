'use client';

import { Download, ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button-styles';

const ZOOMS = [1, 1.5, 2, 3];

/**
 * A page drawn on a canvas, as wide as the viewer at zoom 1. Sharp on a
 * phone: the canvas has the device's pixels, and CSS brings it back to size.
 */
function PdfPage({
  page,
  width,
  label,
}: {
  page: PDFPageProxy;
  width: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const scale = width / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale: scale * ratio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${width}px`;
    const task = page.render({ canvas, viewport });
    task.promise.catch((error: unknown) => {
      // A new size interrupts the drawing in progress: not a failure.
      if ((error as Error).name !== 'RenderingCancelledException')
        console.error('Page du PDF non dessinée', error);
    });
    return () => task.cancel();
  }, [page, width]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="mx-auto bg-white shadow-md"
    />
  );
}

/**
 * Shows a PDF inside the page. Phone browsers do not display a PDF in a
 * frame, hence pdf.js, loaded only here; its legacy build runs on the old
 * Android browsers of entry-level phones. Downloading stays one tap away,
 * and is what is left if the file cannot be drawn.
 */
export function PdfViewer({
  src,
  fileName,
  title,
}: {
  src: string;
  fileName: string;
  title: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [areaWidth, setAreaWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | null = null;
    async function open() {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      loading = pdfjs.getDocument({ url: src });
      const document = await loading.promise;
      const loaded = await Promise.all(
        Array.from({ length: document.numPages }, (_, index) =>
          document.getPage(index + 1),
        ),
      );
      if (!cancelled) setPages(loaded);
    }
    open().catch((error: unknown) => {
      console.error('PDF non affiché', src, error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      setAreaWidth(Math.floor(entry?.contentRect.width ?? 0));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const factor = ZOOMS[zoom] ?? 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setZoom(zoom - 1)}
          disabled={zoom === 0}
          className={buttonClasses('secondary', 'px-3')}
        >
          <ZoomOut aria-hidden className="size-5" />
          Réduire
        </button>
        <button
          type="button"
          onClick={() => setZoom(zoom + 1)}
          disabled={zoom === ZOOMS.length - 1}
          className={buttonClasses('secondary', 'px-3')}
        >
          <ZoomIn aria-hidden className="size-5" />
          Agrandir
        </button>
        <a
          href={src}
          download={`${fileName}.pdf`}
          className={buttonClasses('primary', 'px-3')}
        >
          <Download aria-hidden className="size-5" />
          Télécharger
        </a>
      </div>

      {failed ? (
        <Alert tone="error">
          Impossible d’afficher ce document ici. Utilisez « Télécharger » pour
          l’ouvrir sur votre appareil.
        </Alert>
      ) : (
        <div
          ref={areaRef}
          role="region"
          aria-label={title}
          tabIndex={0}
          className="flex flex-col gap-4 overflow-auto rounded-2xl bg-surface-muted p-2"
        >
          {pages.length === 0 ? (
            <p role="status" className="p-6 text-center">
              Chargement du document…
            </p>
          ) : (
            pages.map((page, index) => (
              <PdfPage
                key={page.pageNumber}
                page={page}
                width={areaWidth * factor}
                label={`${title}, page ${index + 1} sur ${pages.length}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
