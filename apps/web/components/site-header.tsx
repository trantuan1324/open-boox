import Link from 'next/link';
import { getCurrentUser } from '@/lib/api/server';
import { CartLink } from './cart/cart-link';

const ANNOUNCEMENTS = ['Gói mượn từ 79.000đ / 30 ngày', 'Giao & nhận sách tận nhà', 'Trả cuốn này, mượn cuốn khác'];
const NAV_PILL =
  'inline-flex items-center rounded-full border border-ink bg-paper px-[18px] py-[13px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition-all duration-500 ease-bounce hover:bg-ink hover:text-paper';
const NAV_CTA =
  'inline-flex items-center rounded-full bg-ink px-[20px] py-[13px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-paper transition-all duration-500 ease-bounce hover:-translate-y-[2px] hover:bg-paper hover:text-ink';

// Nav nổi kiểu landing: logo tròn + pill viền đen lơ lỏng trên nội dung, banner chạy chữ cuộn theo trang.
export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <>
      <div aria-label="Thông báo" className="-mx-[8px] overflow-hidden bg-lilac py-[6px] md:-mx-[12px]">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-[48px] pr-[48px]">
              {ANNOUNCEMENTS.map((text) => (
                <span
                  key={text}
                  className="text-[11px] font-bold uppercase tracking-[0.03em] whitespace-nowrap md:text-[12px]"
                >
                  {text} •
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="sticky top-[8px] z-40 flex flex-wrap items-center justify-between gap-[8px] px-[4px] md:top-[12px]">
        <Link
          href="/"
          aria-label="Open Boox — trang chủ"
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper font-display text-[18px] font-extrabold uppercase text-ink transition-all duration-500 ease-bounce hover:bg-ink hover:text-paper md:h-[56px] md:w-[56px] md:text-[22px]"
        >
          OB
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-[6px]">
          <Link href="/books" className={NAV_PILL}>
            Sách
          </Link>
          <Link href="/plans" className={NAV_PILL}>
            Gói mượn
          </Link>
          <CartLink />
          {user ? (
            <>
              {user.role === 'ADMIN' && (
                <Link href="/admin" className={NAV_PILL}>
                  Quản trị
                </Link>
              )}
              <Link href="/account" className={NAV_CTA}>
                Tài khoản
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={NAV_PILL}>
                Đăng nhập
              </Link>
              <Link href="/register" className={NAV_CTA}>
                Đăng ký ↗
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
