// Share card drawn by `next/og` (Satori): inline styles only, no Tailwind.
// Colors are the design tokens of docs/DESIGN.md (brand, sales).

export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#6D28D9',
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: '#FFFFFF',
            color: '#6D28D9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            fontWeight: 800,
          }}
        >
          N
        </div>
        <div style={{ fontSize: 40, fontWeight: 800 }}>Nagaw Business</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            background: '#DCFCE7',
            color: '#14532D',
            borderRadius: 999,
            padding: '8px 24px',
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: title.length > 60 ? 56 : 68,
            fontWeight: 800,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ fontSize: 30, color: '#EDE9FE' }}>
        Caisse, stock et argent de votre boutique, même sans internet
      </div>
    </div>
  );
}
