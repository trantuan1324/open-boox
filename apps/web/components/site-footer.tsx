import Link from 'next/link';

const LINKS = [
  { href: '/books', label: 'Sách' },
  { href: '/plans', label: 'Gói mượn' },
  { href: '/account/orders', label: 'Đơn hàng' },
  { href: '/account', label: 'Tài khoản' },
];

export function SiteFooter() {
  return (
    <footer className="sheet mt-auto flex flex-col gap-[40px] bg-mint px-[24px] pb-[24px] pt-[64px] md:gap-[70px] md:px-[64px] md:pb-[28px] md:pt-[110px]">
      <div className="flex flex-col justify-between gap-[40px] md:flex-row md:items-start">
        <p className="display text-[64px] md:text-[150px]">
          Chọn gói.
          <br />
          <em>Rồi cứ thế mà đọc.</em>
        </p>
        <nav aria-label="Chân trang" className="flex flex-col items-start gap-[10px] md:items-end">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[24px] font-bold uppercase leading-none transition hover:scale-[1.03] md:text-[30px]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap justify-between gap-[12px] border-t border-ink pt-[16px] text-[11px] font-bold uppercase tracking-[0.03em]">
        <span>© 2026 Open Boox</span>
        <span>Mượn · Mua · Giao tận nơi</span>
      </div>
    </footer>
  );
}
