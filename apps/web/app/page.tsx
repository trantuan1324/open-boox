import { type CategoryDto, type PlanDto } from '@open-boox/shared';
import { Anton, Inter_Tight } from 'next/font/google';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { CartLink } from '@/components/cart/cart-link';
import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';
import { Reveal } from './reveal';
import { ScrollFX } from './scroll-fx';
import { SmoothScroll } from './smooth-scroll';
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

const BANNER_ITEMS = ['Gói mượn từ 79.000đ / 30 ngày', 'Giao & nhận sách tận nhà', 'Trả cuốn này, mượn cuốn khác'];

const FEATURES = [
  {
    emoji: '📚',
    badge: '🔄',
    tone: 'yellow',
    t1: 'Mượn theo gói',
    t2: 'giữ nhiều cuốn',
    body: 'Giữ cùng lúc 2–5 cuốn tuỳ gói, không hạn trả. Trả cuốn này để mượn cuốn khác.',
    cta: 'Xem các gói',
    href: '/plans',
    flip: false,
  },
  {
    emoji: '📕',
    badge: '🪙',
    tone: 'violet',
    t1: 'Mua sách',
    t2: 'là của bạn',
    body: 'Thích cuốn nào thì mua luôn. Thanh toán một lần, sách ở lại kệ nhà bạn.',
    cta: 'Vào kho sách',
    href: '/books',
    flip: true,
  },
  {
    emoji: '🛍️',
    badge: '📚',
    tone: 'blue',
    t1: 'Giao tận nơi',
    t2: 'lấy lại tận nhà',
    body: 'Chúng tôi giao sách đến cửa và đến lấy lại khi bạn trả.',
    cta: 'Đăng ký ngay',
    href: '/register',
    flip: false,
  },
];

const CAT_COLORS = ['#ffd731', '#e9ccff', '#4da2ff', '#fb4903', '#55db9c', '#ffdede'];
const CAT_EMOJIS = ['📖', '💼', '🧠', '🔬', '🏛️', '🧸'];
const PLAN_COLORS = ['#ffd731', '#e9ccff', '#4da2ff'];
const PLAN_EMOJIS = ['📗', '📚', '🌟'];

const FALLBACK_PLANS: PlanDto[] = [
  { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79000 },
  { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119000 },
  { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179000 },
];

const FALLBACK_CATEGORIES: CategoryDto[] = [
  { id: 'van-hoc', name: 'Văn học', slug: 'van-hoc' },
  { id: 'kinh-te', name: 'Kinh tế', slug: 'kinh-te' },
  { id: 'tam-ly-ky-nang', name: 'Tâm lý – Kỹ năng', slug: 'tam-ly-ky-nang' },
  { id: 'khoa-hoc', name: 'Khoa học', slug: 'khoa-hoc' },
  { id: 'lich-su', name: 'Lịch sử', slug: 'lich-su' },
  { id: 'thieu-nhi', name: 'Thiếu nhi', slug: 'thieu-nhi' },
];

const HERO_STICKERS: Array<{ emoji: string; parallax: number; style: CSSProperties }> = [
  { emoji: '📚', parallax: 0.12, style: { top: '11%', left: '6%', '--rot': '-8deg', '--bg': '#ffd731', '--size': 'clamp(72px, 10vw, 150px)' } as CSSProperties },
  { emoji: '👓', parallax: -0.08, style: { bottom: '8%', right: '5%', '--rot': '10deg', '--bg': '#e9ccff', '--size': 'clamp(64px, 9vw, 130px)', animationDelay: '0.9s' } as CSSProperties },
  { emoji: '🔖', parallax: 0.16, style: { top: '8%', right: '17%', '--rot': '-12deg', '--bg': '#55db9c', '--size': 'clamp(56px, 8vw, 110px)', animationDelay: '1.8s' } as CSSProperties },
];

async function fetchWithFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiPublic<T>(path);
  } catch {
    return fallback;
  }
}

function Marquee({
  children,
  className = '',
  duration = 30,
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}) {
  return (
    <div className={`obx-marquee${className ? ` ${className}` : ''}`}>
      <div
        className={`obx-marquee__track${reverse ? ' obx-marquee__track--reverse' : ''}`}
        style={{ animationDuration: `${duration}s` }}
      >
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
  const [plans, categories] = await Promise.all([
    fetchWithFallback<PlanDto[]>('/plans', FALLBACK_PLANS),
    fetchWithFallback<CategoryDto[]>('/categories', FALLBACK_CATEGORIES),
  ]);

  return (
    <div className={`obx-home ${anton.variable} ${interTight.variable}`}>
      <SmoothScroll />
      <ScrollFX />
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

      <div className="obx-stack">
        {/* S1 · Hero + header */}
        <section className="obx-panel obx-panel--blue obx-hero">
          <header className="obx-nav">
            <Link href="/" className="obx-logo">
              OB
            </Link>
            <nav className="obx-nav__group">
              <Link href="/books" className="obx-pill">
                Sách
              </Link>
              <Link href="/plans" className="obx-pill">
                Gói mượn
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
                  <Link href="/register" className="obx-pill obx-pill--dark">
                    Đăng ký ↗
                  </Link>
                </>
              )}
            </nav>
          </header>

          <div className="obx-hero__stage">
            {HERO_STICKERS.map((s, i) => (
              <span key={i} className="obx-sticker" data-parallax={s.parallax} style={s.style}>
                {s.emoji}
              </span>
            ))}
            <div className="obx-hero__mark">
              <svg
                className="obx-hero__ribbon"
                viewBox="0 0 1200 260"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M-20 70 Q 260 160 620 105 T 1220 65 L 1220 175 Q 880 245 560 195 T -20 155 Z"
                  fill="#4da2ff"
                  stroke="#000"
                  strokeWidth="5"
                />
              </svg>
              <h1 className="obx-hero__title">
                <span>Open</span> <span>Boox</span>
              </h1>
            </div>
            <p className="obx-hero__tagline">Đọc nhiều hơn. Sở hữu ít hơn.</p>
            <p className="obx-hero__sub">Mượn sách theo gói, mua khi muốn giữ, và để chúng tôi giao đến tận cửa.</p>
            <div className="obx-hero__actions">
              <Link href="/plans" className="obx-pill obx-pill--dark obx-pill--lg">
                Chọn gói mượn ↗
              </Link>
              <Link href="/books" className="obx-pill obx-pill--lg">
                Xem kho sách
              </Link>
            </div>
          </div>
        </section>

        {/* S3 · Statement */}
        <section className="obx-panel obx-panel--blue obx-statement">
          <Reveal>
            <p className="obx-statement__line">Mọi cuốn sách</p>
          </Reveal>
          <Reveal delay={140}>
            <p className="obx-statement__line obx-statement__row">
              Giao
              <span className="obx-statement__sticker" data-parallax="-0.1">
                📚
              </span>
              tận cửa
            </p>
          </Reveal>
          <Reveal delay={280}>
            <p className="obx-statement__line">
              <span className="obx-skew">Trong một gói</span>
            </p>
          </Reveal>
        </section>

        {/* S4 · 3 tính năng zig-zag */}
        <section className="obx-panel obx-panel--white obx-features">
          <Reveal>
            <h2 className="obx-features__heading">Mượn hay mua — tuỳ bạn.</h2>
          </Reveal>
          {FEATURES.map((f) => (
            <div key={f.t1} className={`obx-feature${f.flip ? ' obx-feature--flip' : ''}`}>
              <Reveal className="obx-feature__visual-wrap">
                <div className={`obx-visual obx-visual--${f.tone}`}>
                  <span className="obx-visual__emoji">{f.emoji}</span>
                  <span className="obx-visual__badge">{f.badge}</span>
                </div>
              </Reveal>
              <Reveal delay={100} className="obx-feature__text">
                <p className="obx-feature__title">
                  {f.t1}
                  <br />
                  <span className="obx-skew">{f.t2}</span>
                </p>
                <p className="obx-feature__body">{f.body}</p>
                <Link href={f.href} className="obx-pill obx-pill--dark">
                  {f.cta} ↗
                </Link>
              </Reveal>
            </div>
          ))}
        </section>

        {/* S5 · Thể loại (carousel) */}
        <section className="obx-panel obx-panel--white obx-cats-section">
          <Reveal className="obx-cats-section__head">
            <h2 className="obx-features__heading">Kệ nào cũng có.</h2>
            <Link href="/books" className="obx-pill">
              Xem tất cả sách
            </Link>
          </Reveal>
          <div className="obx-cats">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                href={`/books?category=${c.slug}`}
                className="obx-cat"
                style={{ background: CAT_COLORS[i % CAT_COLORS.length] }}
              >
                <span className="obx-cat__sticker">{CAT_EMOJIS[i % CAT_EMOJIS.length]}</span>
                <span className="obx-cat__name">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* S6 · Marquee 2 hàng ngược chiều */}
        <section className="obx-panel obx-panel--dark obx-mq2">
          <Marquee duration={26}>
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="obx-mq2__item">
                Đọc cùng Open Boox
                <span className="obx-mq2__sep">✦</span>
              </span>
            ))}
          </Marquee>
          <Marquee duration={34} reverse className="obx-mq2__row--blue">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="obx-mq2__item">
                {['Mượn', 'Mua', 'Giao'][i % 3]}
                <span className="obx-mq2__sep">✦</span>
              </span>
            ))}
          </Marquee>
        </section>

        {/* S9 · Gói mượn */}
        <section className="obx-panel obx-panel--white obx-plans">
          <Reveal className="obx-plans__head">
            <h2 className="obx-plans__title">
              Một gói,
              <br />
              <span className="obx-skew">cả thư viện</span>
            </h2>
            <p className="obx-plans__body">
              Giữ cùng lúc tối đa số cuốn của gói, không hạn trả. Tự gia hạn mỗi 30 ngày; nâng cấp có hiệu lực ngay.
            </p>
          </Reveal>
          <div className="obx-plans__grid">
            {plans.map((p, i) => (
              <Reveal key={p.code} delay={i * 90}>
                <div className="obx-plan" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }}>
                  <span className="obx-plan__label">{p.name}</span>
                  <span className="obx-plan__books">
                    {p.maxBooks} cuốn
                    <br />
                    cùng lúc
                  </span>
                  <span className="obx-plan__spacer" />
                  <span className="obx-plan__price">
                    {formatVnd(p.monthlyPrice)}
                    <span> / 30 ngày</span>
                  </span>
                  <Link href="/plans" className="obx-pill obx-pill--dark obx-plan__cta">
                    Chọn {p.name} ↗
                  </Link>
                  <span className="obx-plan__sticker">{PLAN_EMOJIS[i % PLAN_EMOJIS.length]}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* S12 · Footer */}
        <footer className="obx-panel obx-panel--green obx-footer">
          <div className="obx-footer__top">
            <Reveal>
              <p className="obx-footer__heading">
                Chọn gói.
                <br />
                <span className="obx-skew">Rồi cứ thế mà đọc.</span>
              </p>
            </Reveal>
            <nav className="obx-footer__links">
              <Link href="/books">Sách</Link>
              <Link href="/plans">Gói mượn</Link>
              <Link href="/account/orders">Đơn hàng</Link>
              <Link href="/account">Tài khoản</Link>
            </nav>
          </div>
          <div className="obx-footer__bottom">
            <p className="obx-footer__legal">© 2026 Open Boox</p>
            <p className="obx-footer__legal">Mượn · Mua · Giao tận nơi</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
