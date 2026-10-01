'use client';

import { CurtainLink } from '@/components/curtain/curtain-link';
import { useRef } from 'react';
import { howItWorksCards } from '../data';
import { Draggable, FULL, REDUCE, gsap, useGSAP } from '../motion/gsap';
import { StickerBook } from '../svg/stickers';

// Section 9 ([SM §5.13]) in place of testimonials: drag the row sideways; cards dragged past stay pinned at the
// left edge, shrinking to 0.6 and tilting to -10°. Buttons do the same for people who do not drag.
export function HowItWorks({ total, signedIn }: { total: number | null; signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);
  const go = useRef<(delta: number) => void>(() => {});
  const cards = howItWorksCards(total);

  useGSAP(
    () => {
      const track = root.current!.querySelector<HTMLElement>('.obx-how__track')!;
      const items = gsap.utils.toArray<HTMLElement>('.obx-how-card', track);
      const n = items.length;
      const mm = gsap.matchMedia();

      mm.add({ full: FULL, reduce: REDUCE }, (ctx) => {
        const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };
        let step = 0;
        const measure = () => {
          step = items[1].offsetLeft - items[0].offsetLeft;
        };
        const position = () => -Number(gsap.getProperty(track, 'x')) / step;
        const update = () => {
          const p = gsap.utils.clamp(0, n - 1, position());
          items.forEach((card, i) => {
            const d = gsap.utils.clamp(0, 1, p - i);
            gsap.set(
              card,
              reduce
                ? { zIndex: i }
                : { x: Math.max(0, p - i) * step * 0.85, scale: 1 - 0.4 * d, rotation: -10 * d, zIndex: i },
            );
          });
        };

        measure();
        const [drag] = Draggable.create(track, {
          type: 'x',
          inertia: !reduce,
          bounds: { minX: -(n - 1) * step, maxX: 0 },
          snap: (x: number) => Math.round(x / step) * step,
          onPress: () => gsap.killTweensOf(track),
          onDrag: update,
          onThrowUpdate: update,
        });

        go.current = (delta) => {
          const index = gsap.utils.clamp(0, n - 1, Math.round(position()) + delta);
          gsap.to(track, {
            x: -index * step,
            duration: reduce ? 0 : 0.725,
            ease: 'slush-bounce',
            overwrite: 'auto',
            onUpdate: () => {
              drag.update();
              update();
            },
          });
        };

        let lastWidth = window.innerWidth;
        const onResize = () => {
          if (window.innerWidth === lastWidth) return;
          lastWidth = window.innerWidth;
          const index = Math.round(position());
          measure();
          drag.applyBounds({ minX: -(n - 1) * step, maxX: 0 });
          gsap.set(track, { x: -index * step });
          drag.update();
          update();
        };
        window.addEventListener('resize', onResize);
        update();

        return () => {
          window.removeEventListener('resize', onResize);
          gsap.killTweensOf(track);
          drag.kill();
          go.current = () => {};
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="cach-hoat-dong" ref={root} className="obx-sheet obx-how" aria-labelledby="obx-how-title">
      <div className="obx-how__intro">
        <h2 id="obx-how-title" className="obx-display obx-how__title" data-anim-slant>
          Cách
          {' '}
          <br />
          <em>hoạt động</em>
        </h2>
        <p className="obx-how__sub">Bốn bước từ lúc chọn gói tới lúc sách nằm trên tay bạn.</p>
        <CurtainLink href={signedIn ? '/plans' : '/register'} className="obx-btn obx-btn--dark">
          {signedIn ? 'Chọn gói ↗' : 'Bắt đầu ↗'}
        </CurtainLink>
      </div>
      <div className="obx-how__stage">
        <ul className="obx-how__track" role="list" data-cursor="Kéo" aria-label="Các bước">
          {cards.map((card) =>
            card.kind === 'step' ? (
              <li key={card.step.n} className="obx-how-card">
                <span className="obx-how-card__n" aria-hidden="true">
                  {card.step.n}
                </span>
                <h3 className="obx-how-card__title">{card.step.title}</h3>
                <p className="obx-body">{card.step.body}</p>
              </li>
            ) : (
              <li key="stat" className="obx-how-card obx-how-card--stat">
                <StickerBook className="obx-how-card__sticker" />
                <p className="obx-display obx-italic obx-how-card__stat">{card.total} đầu sách</p>
                <p className="obx-body">đang chờ trong kho.</p>
              </li>
            ),
          )}
        </ul>
        <div className="obx-how__controls">
          <button type="button" className="obx-round" aria-label="Bước trước" onClick={() => go.current(-1)}>
            ←
          </button>
          <button type="button" className="obx-round" aria-label="Bước tiếp" onClick={() => go.current(1)}>
            →
          </button>
        </div>
      </div>
    </section>
  );
}
