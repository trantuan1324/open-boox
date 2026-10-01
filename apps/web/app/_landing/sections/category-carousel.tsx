'use client';

import type { CategoryDto } from '@open-boox/shared';
import { CurtainLink } from '@/components/curtain/curtain-link';
import { useRef, useState } from 'react';
import { cycleColor } from '../data';
import { FULL, REDUCE, ScrollTrigger, gsap, useGSAP } from '../motion/gsap';
import { STICKERS } from '../svg/stickers';
import { type HorizontalLoop, horizontalLoop } from '../ui/horizontal-loop';

// Section 6 ([SM §5.12]): infinite centered loop, drag with inertia, autoplay every 4s while on screen and not
// hovered, dots + prev/next. Slides are links; a drag never counts as a click.
export function CategoryCarousel({ categories }: { categories: CategoryDto[] }) {
  const root = useRef<HTMLElement>(null);
  const loop = useRef<HorizontalLoop | null>(null);
  const pressX = useRef(0);
  const [active, setActive] = useState(0);
  const n = categories.length;
  // A seamless loop needs a track wider than the viewport plus one slide; otherwise slides wrap inside the visible
  // area (uneven gaps, flicker while dragging). Repeat the categories until there are at least 12 slides
  // (12 × 356px ≈ 4270px, enough for 2× a 1920px screen).
  const copies = n > 1 ? Math.ceil(12 / n) : 1;
  const slides = Array.from({ length: copies }, (_, copy) => categories.map((category, i) => ({ category, i, copy }))).flat();
  const activeCategory = n ? active % n : 0;

  useGSAP(
    () => {
      const slides = gsap.utils.toArray<HTMLElement>('.obx-cat', root.current);
      if (slides.length < 2) return;
      const mm = gsap.matchMedia();
      mm.add({ full: FULL, reduce: REDUCE }, (ctx) => {
        const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };
        const carousel = horizontalLoop(slides, {
          paused: true,
          center: true,
          draggable: true,
          onChange: (_el, index) => setActive(index),
        });
        loop.current = carousel;
        if (reduce) {
          return () => {
            carousel.destroy();
            loop.current = null;
          };
        }

        let onScreen = false;
        let hovering = false;
        let focused = false;
        const tick = gsap.delayedCall(4, () => {
          if (onScreen && !hovering && !focused) carousel.next({ duration: 0.725, ease: 'slush-bounce' });
          tick.restart(true);
        });
        ScrollTrigger.create({
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => {
            onScreen = self.isActive;
          },
        });
        const enter = () => (hovering = true);
        const leave = () => (hovering = false);
        const focusIn = () => (focused = true);
        const focusOut = (event: FocusEvent) => (focused = root.current!.contains(event.relatedTarget as Node | null));
        root.current!.addEventListener('pointerenter', enter);
        root.current!.addEventListener('pointerleave', leave);
        root.current!.addEventListener('focusin', focusIn);
        root.current!.addEventListener('focusout', focusOut);
        return () => {
          root.current?.removeEventListener('pointerenter', enter);
          root.current?.removeEventListener('pointerleave', leave);
          root.current?.removeEventListener('focusin', focusIn);
          root.current?.removeEventListener('focusout', focusOut);
          carousel.destroy();
          loop.current = null;
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const go = (index: number) => {
    const reduce = window.matchMedia(REDUCE).matches;
    loop.current?.toIndex(index, { duration: reduce ? 0 : 0.725, ease: 'slush-bounce' });
  };

  return (
    <section ref={root} className="obx-sheet obx-cats" aria-labelledby="obx-cats-title">
      <div className="obx-cats__head">
        <h2 id="obx-cats-title" className="obx-display obx-cats__title" data-anim-slant>
          Kệ nào
          {' '}
          <br />
          <em>cũng có</em>
        </h2>
        <CurtainLink href="/books" className="obx-btn">
          Xem tất cả sách
        </CurtainLink>
      </div>
      <div className="obx-cats__viewport">
        <div className="obx-cats__track">
          {slides.map(({ category, i, copy }, slideIndex) => {
            const Sticker = STICKERS[i % STICKERS.length];
            return (
              <CurtainLink
                key={`${category.id}-${copy}`}
                id={copy === 0 ? `obx-cat-${i}` : undefined}
                aria-hidden={copy > 0 || undefined}
                tabIndex={copy > 0 ? -1 : undefined}
                href={`/books?category=${category.slug}`}
                className={`obx-cat${slideIndex === active ? ' is-active' : ''}`}
                style={{ background: cycleColor(i) }}
                data-cursor="Kéo"
                draggable={false}
                onFocus={(event) => {
                  // Keyboard focus only: a mouse press also focuses the link, and a toIndex tween started then
                  // fights the drag (the whole strip jumps).
                  if (event.currentTarget.matches(':focus-visible')) go(slideIndex);
                }}
                onPointerDown={(event) => {
                  pressX.current = event.clientX;
                }}
                onClick={(event) => {
                  if (event.detail > 0 && Math.abs(event.clientX - pressX.current) > 5) event.preventDefault();
                }}
              >
                <Sticker className="obx-cat__sticker" />
                <span className="obx-display obx-italic obx-cat__name">{category.name}</span>
              </CurtainLink>
            );
          })}
        </div>
      </div>
      {categories.length > 1 && (
        <div className="obx-cats__controls">
          <button type="button" className="obx-round" aria-label="Thể loại trước" onClick={() => go((loop.current?.current() ?? active) - 1)}>
            ←
          </button>
          <div className="obx-cats__dots" role="tablist" aria-label="Chọn thể loại">
            {categories.map((category, i) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                className="obx-dot"
                aria-label={category.name}
                aria-selected={i === activeCategory}
                aria-controls={`obx-cat-${i}`}
                onClick={() => {
                  // Go to the copy of category i nearest to the current slide.
                  const current = loop.current?.current() ?? active;
                  go(current - (current % n) + i);
                }}
              />
            ))}
          </div>
          <button type="button" className="obx-round" aria-label="Thể loại tiếp" onClick={() => go((loop.current?.current() ?? active) + 1)}>
            →
          </button>
        </div>
      )}
    </section>
  );
}
