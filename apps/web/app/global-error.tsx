'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ background: '#100904', color: '#ffedd7', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ textTransform: 'uppercase', fontWeight: 500 }}>Đã có lỗi xảy ra</h1>
        <button onClick={reset} style={{ color: 'inherit', textTransform: 'uppercase' }}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
