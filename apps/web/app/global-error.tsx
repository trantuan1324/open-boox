'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ background: '#000', color: '#000', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32 }}>
          <h1 style={{ textTransform: 'uppercase', fontWeight: 700 }}>Đã có lỗi xảy ra</h1>
          <p style={{ marginTop: 8 }}>Vui lòng thử lại sau ít phút.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: '#000',
              color: '#fff',
              borderRadius: 999,
              padding: '14px 24px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
