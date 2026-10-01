import type { CategoryDto } from '@open-boox/shared';
import Link from 'next/link';
import { apiPublic } from '@/lib/api/server';

const FEATURES = [
  {
    bg: 'bg-sunburst',
    sticker: '📚',
    title: 'Mượn theo gói',
    titleItalic: 'giữ nhiều cuốn',
    body: 'Giữ cùng lúc 2–5 cuốn tuỳ gói, không hạn trả. Trả cuốn này để mượn cuốn khác.',
    cta: 'Xem các gói',
    href: '/plans',
  },
  {
    bg: 'bg-lilac',
    sticker: '🪙',
    title: 'Mua sách',
    titleItalic: 'là của bạn',
    body: 'Thích cuốn nào thì mua luôn. Thanh toán một lần, sách ở lại kệ nhà bạn.',
    cta: 'Vào kho sách',
    href: '/books',
  },
  {
    bg: 'bg-blue',
    sticker: '📦',
    title: 'Giao tận nơi',
    titleItalic: 'lấy lại tận nhà',
    body: 'Chúng tôi giao sách đến cửa và đến lấy lại khi bạn trả.',
    cta: 'Đăng ký ngay',
    href: '/plans',
  },
];

const CARD_COLORS = ['bg-sunburst', 'bg-lilac', 'bg-blue', 'bg-ember', 'bg-mint', 'bg-blush'];
const CARD_STICKERS = ['📖', '👓', '🔖', '✅', '🚀', '☕'];

const DISPLAY_XL = 'display text-[clamp(48px,11vw,170px)]';
const MARQUEE_LINE = 'display shrink-0 whitespace-nowrap pr-[32px] text-[clamp(56px,12vw,190px)]';

export default async function HomePage() {
  const categories = await apiPublic<CategoryDto[]>('/categories');

  return (
    <>
      <section className="sheet relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden bg-sky px-[16px] py-[80px] text-center md:min-h-[calc(100vh-96px)]">
        <div aria-hidden className="absolute left-[-10%] top-[42%] h-[16vw] max-h-[220px] w-[120%] rotate-[-6deg] rounded-full bg-blue" />
        <div
          aria-hidden
          className="absolute left-[4%] top-[10%] flex h-[80px] w-[80px] rotate-[-8deg] items-center justify-center rounded-full border border-ink bg-sunburst text-[36px] md:left-[8%] md:h-[130px] md:w-[130px] md:text-[56px]"
        >
          📚
        </div>
        <div
          aria-hidden
          className="absolute right-[6%] top-[52%] flex h-[72px] w-[72px] rotate-[10deg] items-center justify-center rounded-full border border-ink bg-lilac text-[32px] md:right-[10%] md:h-[120px] md:w-[120px] md:text-[48px]"
        >
          👓
        </div>
        <div
          aria-hidden
          className="absolute right-[18%] top-[10%] hidden h-[90px] w-[90px] rotate-[-12deg] items-center justify-center rounded-[22px] border border-ink bg-mint text-[40px] md:flex"
        >
          🔖
        </div>
        <h1 className="display relative text-[clamp(72px,19vw,280px)]">Open Boox</h1>
        <div className="relative mt-[48px] flex flex-col items-center gap-[16px]">
          <p className="text-[24px] font-bold tracking-[-0.01em] md:text-[34px]">Đọc nhiều hơn. Sở hữu ít hơn.</p>
          <p className="max-w-[560px] text-[16px] leading-[1.4] md:text-[18px]">
            Mượn sách theo gói, mua khi muốn giữ, và để chúng tôi giao đến tận cửa.
          </p>
          <div className="mt-[8px] flex flex-wrap justify-center gap-[8px]">
            <Link
              href="/plans"
              className="inline-block rounded-full bg-ink px-[28px] py-[16px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-paper transition hover:scale-[1.03]"
            >
              Chọn gói mượn ↗
            </Link>
            <Link href="/books" className="inline-block rounded-full border border-ink bg-paper px-[28px] py-[16px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition hover:scale-[1.03]">
              Xem kho sách
            </Link>
          </div>
        </div>
      </section>

      <section className="sheet flex flex-col items-center bg-sky px-[16px] py-[80px] text-center md:py-[160px]">
        <p className={DISPLAY_XL}>Mọi cuốn sách</p>
        <div className="flex items-center justify-center gap-[12px] md:gap-[24px]">
          <p className={DISPLAY_XL}>Giao</p>
          <span
            aria-hidden
            className="flex h-[52px] w-[100px] items-center justify-center rounded-full border border-ink bg-sunburst text-[28px] md:h-[110px] md:w-[230px] md:text-[56px]"
          >
            📚
          </span>
          <p className={DISPLAY_XL}>tận cửa</p>
        </div>
        <p className={DISPLAY_XL}>
          <em>Trong một gói</em>
        </p>
      </section>

      <section className="sheet flex flex-col gap-[64px] px-[20px] py-[72px] md:gap-[80px] md:px-[80px] md:py-[110px]">
        <h2 className="text-[34px] font-medium leading-[1.05] tracking-[-0.01em] md:text-[64px]">Mượn hay mua — tuỳ bạn.</h2>
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className={`flex flex-col gap-[24px] md:items-center md:gap-[80px] ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
            <div
              aria-hidden
              className={`flex h-[240px] w-full shrink-0 items-center justify-center rounded-[22px] border border-ink text-[64px] md:h-[480px] md:w-[560px] md:text-[96px] ${feature.bg}`}
            >
              {feature.sticker}
            </div>
            <div className="flex flex-col gap-[24px]">
              <p className="display text-[56px] md:text-[110px]">
                {feature.title}
                <br />
                <em>{feature.titleItalic}</em>
              </p>
              <p className="max-w-[460px] text-[16px] leading-[1.4] md:text-[22px]">{feature.body}</p>
              <Link
                href={feature.href}
                className="inline-block self-start rounded-full bg-ink px-[26px] py-[15px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-paper transition hover:scale-[1.03]"
              >
                {feature.cta} ↗
              </Link>
            </div>
          </div>
        ))}
      </section>

      {categories.length > 0 && (
        <section className="sheet flex flex-col gap-[32px] overflow-hidden px-[20px] pb-[56px] pt-[72px] md:pl-[80px] md:pt-[100px]">
          <div className="flex flex-wrap items-end justify-between gap-[16px] md:pr-[80px]">
            <h2 className="text-[34px] font-medium leading-[1.05] tracking-[-0.01em] md:text-[64px]">Kệ nào cũng có.</h2>
            <Link
              href="/books"
              className="inline-block rounded-full border border-ink bg-paper px-[26px] py-[15px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition hover:scale-[1.03]"
            >
              Xem tất cả sách
            </Link>
          </div>
          <div className="flex gap-[12px] overflow-x-auto pb-[8px] md:gap-[16px]">
            {categories.map((category, i) => (
              <Link
                key={category.id}
                href={`/books?category=${category.slug}`}
                className={`flex h-[300px] w-[240px] shrink-0 flex-col justify-between rounded-[20px] border border-ink p-[18px] transition hover:-translate-y-1 md:h-[380px] md:w-[300px] md:p-[24px] ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <span
                  aria-hidden
                  className="flex h-[56px] w-[56px] items-center justify-center self-end rounded-full border border-ink bg-paper text-[24px] md:h-[90px] md:w-[90px] md:text-[40px]"
                >
                  {CARD_STICKERS[i % CARD_STICKERS.length]}
                </span>
                <span className="display text-[40px] md:text-[64px]">
                  <em>{category.name}</em>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-hidden className="sheet overflow-hidden border border-[#333] bg-ink py-[36px] md:py-[80px]">
        <div className="marquee-track marquee-slow">
          {[0, 1].map((copy) => (
            <p key={copy} className={`${MARQUEE_LINE} text-paper`}>
              Đọc cùng Open Boox • Đọc cùng Open Boox •
            </p>
          ))}
        </div>
        <div className="marquee-track marquee-slow marquee-reverse">
          {[0, 1].map((copy) => (
            <p key={copy} className={`${MARQUEE_LINE} text-blue`}>
              <em>Mượn • Mua • Giao • Mượn • Mua • Giao •</em>
            </p>
          ))}
        </div>
      </section>
    </>
  );
}
