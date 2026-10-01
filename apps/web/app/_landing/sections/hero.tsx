'use client';

import { CurtainLink } from '@/components/curtain/curtain-link';
import { type CSSProperties, useRef, useState } from 'react';
import { FULL, REDUCE, SplitText, gsap, useGSAP } from '../motion/gsap';
import { StickerBook, StickerBookmark, StickerGlasses, StickerParcel } from '../svg/stickers';
import { Wordmark } from '../svg/wordmark';

const STICKERS = [
  { Sticker: StickerBook, style: { top: '10%', left: '5%', width: 'clamp(72px, 10vw, 150px)', rotate: '-8deg' } },
  { Sticker: StickerBookmark, style: { top: '8%', right: '14%', width: 'clamp(56px, 7vw, 110px)', rotate: '12deg' } },
  { Sticker: StickerGlasses, style: { bottom: '22%', right: '5%', width: 'clamp(72px, 9vw, 140px)', rotate: '10deg' } },
  { Sticker: StickerParcel, style: { bottom: '14%', left: '9%', width: 'clamp(64px, 8vw, 120px)', rotate: '-6deg' } },
] satisfies { Sticker: typeof StickerBook; style: CSSProperties }[];

// [SM §5.1] Intro: wordmark roll + tagline chars (from end) at 0, blocks and random stickers at +0.5s,
// nav slides down after 0.6s. Until the timeline exists the hero stays in .obx-hero--pending, which hides the
// animated parts (CSS shows them anyway after 2s if JS never runs).
export function Hero() {
  const root = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(true);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ full: FULL, reduce: REDUCE }, (ctx) => {
        const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };
        if (reduce) {
          setPending(false);
          return;
        }
        const q = gsap.utils.selector(root);
        const nav = document.querySelector('.obx-nav');
        const tagline = SplitText.create(q('.obx-hero__tagline-text'), { type: 'words,chars', aria: 'none' });
        const stickers = q('[data-hero-sticker]');

        const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'slush-bounce' } });
        tl.fromTo(q('.obx-flap__stack'), { y: 0, yPercent: 50 }, { yPercent: -50, duration: 1.25, stagger: 0.15 }, 0)
          .fromTo(
            tagline.chars,
            { x: '-0.25em', autoAlpha: 0 },
            { x: 0, autoAlpha: 1, duration: 0.65, stagger: { each: 0.015, from: 'end' } },
            0,
          )
          .from(q('[data-load-stagger]'), { y: '3em', autoAlpha: 0, duration: 1, stagger: 0.1 }, 0.5)
          .from(stickers, { scale: 0.2, rotation: -90, autoAlpha: 0, duration: 1, stagger: { each: 0.1, from: 'random' } }, 0.5)
          // Stand-in for Slush's Lottie playback: one wobble once each sticker has landed.
          .to(stickers, {
            keyframes: [
              { rotation: 8, duration: 0.15, ease: 'slush' },
              { rotation: 0, duration: 0.6 },
            ],
            stagger: 0.05,
          });
        if (nav) gsap.fromTo(nav, { yPercent: -150 }, { yPercent: 0, duration: 0.8, ease: 'slush', delay: 0.6 });
        setPending(false);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={`obx-hero${pending ? ' obx-hero--pending' : ''}`}>
      <h1 className="sr-only">Open Boox — mượn sách theo gói, mua sách, giao tận nơi</h1>
      <div className="obx-hero__ribbon" data-parallax="trigger" aria-hidden="true">
        <svg
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
          data-parallax="target"
          data-parallax-start="30"
          data-parallax-end="-60"
        >
          <path
            d="M-40 90 Q 260 200 620 120 T 1240 80 L 1240 200 Q 880 280 560 220 T -40 190 Z"
            fill="#4da2ff"
            stroke="#000"
            strokeWidth="4"
          />
        </svg>
      </div>
      <Wordmark />
      <p className="obx-heading obx-hero__tagline">
        <span className="sr-only">Đọc nhiều hơn. Sở hữu ít hơn.</span>
        <span className="obx-hero__tagline-text" aria-hidden="true">
          Đọc nhiều hơn. Sở hữu ít hơn.
        </span>
      </p>
      <p className="obx-body obx-hero__sub" data-load-stagger>
        Mượn sách theo gói, mua khi muốn giữ, và để chúng tôi giao đến tận cửa.
      </p>
      <div className="obx-hero__actions" data-load-stagger>
        <CurtainLink href="/plans" className="obx-btn obx-btn--dark">
          Chọn gói mượn ↗
        </CurtainLink>
        <CurtainLink href="/books" className="obx-btn">
          Xem kho sách
        </CurtainLink>
      </div>
      {STICKERS.map(({ Sticker, style }, i) => (
        <span key={i} className="obx-hero__sticker" style={style} data-hero-sticker>
          <Sticker />
        </span>
      ))}
    </section>
  );
}
