'use client';

import type { BookSummary, CategoryDto } from '@open-boox/shared';
import { useRef } from 'react';
import { BookCover } from '@/components/books/book-cover';
import { FULL, gsap, useGSAP } from '../motion/gsap';
import { STICKERS } from '../svg/stickers';

// Section 3: a phone mockup built in HTML whose screen scrolls real covers (stand-in for Slush's app video),
// plus two small mockup ↔ text pairs. The phone scales in at "top center" ([SM §5.10]).
export function Showcase({ books, categories }: { books: BookSummary[]; categories: CategoryDto[] }) {
  const root = useRef<HTMLElement>(null);
  const shown = books.slice(0, Math.min(8, books.length - (books.length % 2)));

  useGSAP(
    () => {
      const phone = root.current!.querySelector<HTMLElement>('.obx-phone')!;
      const grid = root.current!.querySelector<HTMLElement>('.obx-phone__grid')!;
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        gsap.from(phone, {
          scale: 0.75,
          yPercent: 40,
          autoAlpha: 0,
          duration: 1.2,
          ease: 'slush-bounce',
          scrollTrigger: { trigger: phone, start: 'top center', once: true },
        });
        gsap.to(grid, { yPercent: -50, duration: 20, ease: 'none', repeat: -1 });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const screen = (copy: number) =>
    shown.length
      ? shown.map((book) => (
          <BookCover key={`${copy}-${book.id}`} src={book.coverUrl} title={book.title} sizes="140px" />
        ))
      : STICKERS.map((Sticker, i) => <Sticker key={`${copy}-${i}`} className="obx-phone__sticker" />);

  return (
    <section ref={root} className="obx-showcase" aria-labelledby="obx-showcase-title">
      <h2 id="obx-showcase-title" className="obx-heading obx-showcase__title">
        Cả kho sách, gọn trong một màn hình.
      </h2>
      <div className="obx-phone-wrap" data-parallax="trigger">
        <div data-parallax="target" data-parallax-start="20" data-parallax-end="0" data-parallax-disable="mobile">
          <div className="obx-phone" aria-hidden="true">
            <div className="obx-phone__screen">
              <div className="obx-phone__grid">
                {screen(0)}
                {screen(1)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="obx-showcase__pairs">
        <div className="obx-pair">
          <div className="obx-mini" aria-hidden="true">
            {categories.slice(0, 4).map((c) => (
              <span key={c.id} className="obx-mini__chip">
                {c.name}
              </span>
            ))}
          </div>
          <div>
            <h3 className="obx-pair__title">Tìm sách theo thể loại</h3>
            <p className="obx-body">Lọc theo thể loại, tìm theo tên hoặc tác giả, xem còn bao nhiêu cuốn cho mượn.</p>
          </div>
        </div>
        <div className="obx-pair">
          <div className="obx-mini" aria-hidden="true">
            <span className="obx-mini__step obx-mini__step--done">Đã thanh toán</span>
            <span className="obx-mini__step obx-mini__step--now">Đang giao</span>
            <span className="obx-mini__step">Đã nhận</span>
          </div>
          <div>
            <h3 className="obx-pair__title">Theo dõi đơn & lượt mượn</h3>
            <p className="obx-body">Xem từng chặng giao và những cuốn bạn đang giữ.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
