import Link from 'next/link';

const LINKS = [
  { href: '/books', label: 'Sách' },
  { href: '/plans', label: 'Gói mượn' },
  { href: '/account/orders', label: 'Đơn hàng' },
  { href: '/account', label: 'Tài khoản' },
];

const WORDS = ['Mượn', 'Mua', 'Giao', 'Đọc'];

const TILE_COLORS = ['bg-ember', 'bg-blue'];

// Footer kiểu landing: dải tile chữ chạy ngang + huy hiệu OB, lưới link trắng 2×2, card mint chốt slogan.
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-[8px] md:gap-[12px]">
      <div className="relative">
        <div aria-hidden="true" className="overflow-hidden">
          <div className="marquee-track marquee-slow">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-[8px] pr-[8px] md:gap-[12px] md:pr-[12px]">
                {WORDS.map((word, i) => (
                  <span
                    key={word}
                    className={`display rounded-[30px] px-[0.3em] pt-[0.14em] pb-[0.2em] text-[clamp(56px,9vw,140px)] ${TILE_COLORS[i % TILE_COLORS.length]}`}
                  >
                    {word}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="absolute top-1/2 right-[24px] hidden h-[120px] w-[120px] -translate-y-1/2 place-items-center rounded-full border-2 border-paper bg-indigo font-display text-[48px] font-extrabold text-paper md:grid"
        >
          OB
        </span>
      </div>
      <div className="grid gap-[8px] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-[12px]">
        <nav aria-label="Chân trang" className="grid grid-cols-2 gap-[8px] md:gap-[12px]">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex aspect-[5/4] flex-col justify-between rounded-[30px] bg-paper p-[20px] transition-all duration-500 ease-bounce hover:bg-lilac"
            >
              <span aria-hidden="true">↗</span>
              <span className="display text-[clamp(28px,3.5vw,56px)]">{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-col justify-between gap-[32px] rounded-[30px] bg-mint p-[24px] md:rounded-[40px] md:p-[clamp(24px,4vw,56px)]">
          <p className="display text-[clamp(40px,6vw,104px)] leading-[1.35]">
            Chọn gói.
            <br />
            <em>Rồi cứ thế mà đọc.</em>
          </p>
          <div className="flex flex-wrap justify-between gap-[16px] text-[14px] font-medium">
            <span>© 2026 Open Boox</span>
            <span>Mượn · Mua · Giao tận nơi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
