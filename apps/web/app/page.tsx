import { Anton, Inter_Tight } from 'next/font/google';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { CartLink } from '@/components/cart/cart-link';
import { getCurrentUser } from '@/lib/api/server';
import { Reveal } from './reveal';
import './landing.css';

const anton = Anton({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: '400',
  variable: '--font-obx-display',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-obx-body',
  display: 'swap',
});

const BANNER_ITEMS = ['Gói đọc không giới hạn', 'Mượn sách giao tận nơi', 'Mua sách một chạm', 'Trả sách tận cửa'];

const SERVICES = [
  {
    no: '01',
    emoji: '📚',
    title: 'Mượn theo gói',
    body: 'Đăng ký một gói, giữ nhiều cuốn cùng lúc, trả cuốn này để mượn cuốn khác.',
    tone: 'green',
  },
  {
    no: '02',
    emoji: '🛒',
    title: 'Mua sách',
    body: 'Chọn sách, thanh toán một lần, sách là của bạn.',
    tone: 'yellow',
  },
  {
    no: '03',
    emoji: '🚚',
    title: 'Giao tận nơi',
    body: 'Chúng tôi giao sách đến cửa và đến lấy lại khi bạn trả.',
    tone: 'violet',
  },
];

const HERO_STICKERS: Array<{ emoji: string; style: CSSProperties }> = [
  { emoji: '📚', style: { top: '16%', left: '7%', '--rot': '-12deg', '--size': 'clamp(64px, 9vw, 120px)' } as CSSProperties },
  { emoji: '🚚', style: { top: '9%', right: '9%', '--rot': '10deg', '--size': 'clamp(56px, 8vw, 104px)', animationDelay: '0.8s' } as CSSProperties },
  { emoji: '🛒', style: { bottom: '24%', left: '12%', '--rot': '8deg', '--size': 'clamp(52px, 7vw, 96px)', animationDelay: '1.6s' } as CSSProperties },
  { emoji: '⭐', style: { bottom: '15%', right: '8%', '--rot': '-8deg', '--size': 'clamp(56px, 8vw, 104px)', animationDelay: '2.4s' } as CSSProperties },
];

const SHELF_STICKERS: Array<{ emoji: string; style: CSSProperties }> = [
  { emoji: '📕', style: { top: '7%', left: '8%', '--rot': '-10deg' } as CSSProperties },
  { emoji: '📖', style: { top: '10%', left: '38%', '--rot': '8deg', animationDelay: '0.4s' } as CSSProperties },
  { emoji: '📚', style: { top: '6%', right: '8%', '--rot': '6deg', animationDelay: '0.9s' } as CSSProperties },
  { emoji: '📗', style: { top: '34%', left: '14%', '--rot': '12deg', animationDelay: '0.2s' } as CSSProperties },
  { emoji: '📘', style: { top: '38%', right: '12%', '--rot': '-8deg', animationDelay: '0.7s' } as CSSProperties },
  { emoji: '📙', style: { top: '60%', left: '9%', '--rot': '6deg', animationDelay: '1.1s' } as CSSProperties },
  { emoji: '📚', style: { top: '55%', right: '20%', '--rot': '-12deg', animationDelay: '1.5s' } as CSSProperties },
  { emoji: '📖', style: { top: '30%', left: '44%', '--rot': '-6deg', animationDelay: '1.9s' } as CSSProperties },
];

const CTA_BLOCKS: Array<{ text: string; kind: 'block' | 'dot'; tone: string }> = [
  { text: 'Mượn ngay', kind: 'block', tone: 'blue' },
  { text: 'OB', kind: 'dot', tone: 'purple' },
  { text: 'Mua sách', kind: 'block', tone: 'orange' },
  { text: '✦', kind: 'dot', tone: 'yellow' },
  { text: 'Đọc mỗi ngày', kind: 'block', tone: 'green' },
  { text: 'OB', kind: 'dot', tone: 'blue' },
];

function Marquee({ children, className = '', duration = 30 }: { children: ReactNode; className?: string; duration?: number }) {
  return (
    <div className={`obx-marquee${className ? ` ${className}` : ''}`}>
      <div className="obx-marquee__track" style={{ animationDuration: `${duration}s` }}>
        <div className="obx-marquee__group">{children}</div>
        <div className="obx-marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className={`obx-home ${anton.variable} ${interTight.variable}`}>
      <div className="obx-banner">
        <Marquee duration={28}>
          {BANNER_ITEMS.map((item) => (
            <span key={item} className="obx-banner__item">
              {item}
              <span className="obx-banner__dot">✦</span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="obx-sheet">
        <section className="obx-hero">
          <header className="obx-nav">
            <Link href="/" className="obx-logo">
              OB
            </Link>
            <nav className="obx-nav__group">
              <Link href="/books" className="obx-pill">
                Sách
              </Link>
              <Link href="/plans" className="obx-pill">
                Gói đọc
              </Link>
              <span className="obx-pill">
                <CartLink />
              </span>
            </nav>
            <nav className="obx-nav__group">
              {user ? (
                <>
                  {user.role === 'ADMIN' && (
                    <Link href="/admin" className="obx-pill">
                      Quản trị
                    </Link>
                  )}
                  <Link href="/account" className="obx-pill">
                    Tài khoản
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="obx-pill">
                    Đăng nhập
                  </Link>
                  <Link href="/register" className="obx-pill">
                    Đăng ký
                  </Link>
                </>
              )}
              <Link href="/books" className="obx-pill obx-pill--dark">
                Bắt đầu ngay
              </Link>
            </nav>
          </header>

          <div className="obx-hero__stage">
            {HERO_STICKERS.map((s, i) => (
              <span key={i} className="obx-sticker" style={s.style}>
                {s.emoji}
              </span>
            ))}
            <h1 className="obx-hero__title">Open Boox</h1>
            <p className="obx-hero__tagline">Đọc nhiều hơn. Sở hữu ít hơn.</p>
            <div className="obx-hero__actions">
              <Link href="/books" className="obx-pill obx-pill--dark obx-pill--lg">
                Mượn sách ngay
              </Link>
              <Link href="/plans" className="obx-pill obx-pill--lg">
                Xem gói đọc
              </Link>
            </div>
          </div>
        </section>

        <section className="obx-section">
          <Reveal>
            <p className="obx-eyebrow">Cách hoạt động</p>
            <h2 className="obx-heading">Mượn. Mua. Giao tận nơi.</h2>
          </Reveal>
          <div className="obx-cards">
            {SERVICES.map((s, i) => (
              <Reveal key={s.no} delay={i * 90} className="obx-cards__item">
                <article className={`obx-card obx-card--${s.tone}`}>
                  <span className="obx-card__no">{s.no}</span>
                  <span className="obx-card__emoji">{s.emoji}</span>
                  <h3 className="obx-card__title">{s.title}</h3>
                  <p className="obx-card__body">{s.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="obx-section obx-split">
          <Reveal>
            <h2 className="obx-heading">
              Giữ nhiều cuốn.
              <br />
              Trả để mượn tiếp.
            </h2>
            <p className="obx-split__body">
              Một gói duy nhất, cả kệ sách đến tận cửa — chọn sách trên web, chúng tôi giao đến nhà và đến lấy lại khi bạn
              trả.
            </p>
            <Link href="/plans" className="obx-pill obx-pill--dark obx-pill--lg">
              Xem các gói đọc
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="obx-shelf">
              {SHELF_STICKERS.map((s, i) => (
                <span key={i} className="obx-shelf__item" style={s.style}>
                  {s.emoji}
                </span>
              ))}
              <span className="obx-shelf__word">Không giới hạn</span>
            </div>
          </Reveal>
        </section>
      </div>

      <section className="obx-cta">
        <Marquee duration={22}>
          {CTA_BLOCKS.map((b, i) =>
            b.kind === 'block' ? (
              <span key={i} className={`obx-cta__block obx-cta__block--${b.tone}`}>
                {b.text}
              </span>
            ) : (
              <span key={i} className={`obx-cta__dot obx-cta__dot--${b.tone}`}>
                {b.text}
              </span>
            ),
          )}
        </Marquee>
      </section>

      <footer className="obx-footer">
        <div className="obx-footer__card">
          <p className="obx-footer__heading">
            Mở sách.
            <br />
            <span className="obx-footer__heading-accent">Mở thế giới.</span>
          </p>
          <nav className="obx-footer__links">
            <Link href="/books">Sách</Link>
            <Link href="/plans">Gói đọc</Link>
            <Link href="/cart">Giỏ hàng</Link>
            <Link href="/register">Đăng ký</Link>
          </nav>
          <p className="obx-footer__legal">© 2026 Open Boox — Đọc nhiều hơn, sở hữu ít hơn.</p>
        </div>
      </footer>
    </div>
  );
}
