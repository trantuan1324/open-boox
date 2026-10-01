import Link from 'next/link';
import { getCurrentUser } from '@/lib/api/server';
import { CartLink } from './cart/cart-link';

const ANNOUNCEMENTS = ['Gói mượn từ 79.000đ / 30 ngày', 'Giao & nhận sách tận nhà', 'Trả cuốn này, mượn cuốn khác'];
const NAV_PILL =
  'rounded-full border border-ink bg-paper px-[18px] py-[13px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition hover:scale-[1.03]';

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 flex flex-col bg-ink">
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
      <div className="flex flex-wrap items-center justify-between gap-[8px] px-[4px] py-[12px]">
        <Link
          href="/"
          aria-label="Open Boox — trang chủ"
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-paper text-[14px] font-bold text-ink transition hover:scale-[1.05]"
        >
          OB
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-[4px]">
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
              <Link href="/account" className={NAV_PILL}>
                Tài khoản
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className={NAV_PILL}>
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="ml-[4px] rounded-full bg-paper px-[20px] py-[13px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition hover:scale-[1.03]"
              >
                Đăng ký ↗
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
