'use client';

import Lenis from 'lenis';
import { FULL, REDUCE, ScrollTrigger, SplitText, gsap, useGSAP } from './gsap';

// Mounted once by the landing page. Runs Lenis and turns the data-* hooks that server sections render into
// ScrollTriggers ([SM §5.3, §5.6–5.9]). Everything lives inside gsap.matchMedia, so leaving / or flipping
// prefers-reduced-motion reverts it.
export function LandingMotion() {
  useGSAP(() => {
    const root = document.querySelector<HTMLElement>('.obx-home');
    if (!root) return;
    const all = (selector: string) => gsap.utils.toArray<HTMLElement>(root.querySelectorAll(selector));
    const mm = gsap.matchMedia();

    mm.add({ full: FULL, reduce: REDUCE }, (ctx) => {
      const { reduce } = ctx.conditions as { full: boolean; reduce: boolean };

      if (reduce) {
        for (const el of all('[data-anim-slant], [data-heading-reveal], [data-card-reveal="card"]')) {
          gsap.from(el, { autoAlpha: 0, duration: 0.3, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
        }
        return;
      }

      const lenis = new Lenis({ lerp: 0.12, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      const raf = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      // [SM §5.6] slant chars. autoSplit re-splits once the display font has loaded.
      for (const el of all('[data-anim-slant]')) {
        SplitText.create(el, {
          type: 'words,chars',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.chars, {
              x: '-0.25em',
              autoAlpha: 0,
              duration: 0.65,
              ease: 'slush-bounce',
              stagger: { each: 0.015, from: 'end' },
              scrollTrigger: { trigger: el, start: 'top 80%', once: true },
            }),
        });
      }

      // [SM §5.7] 3D line reveal; lines are marked up as [data-line].
      for (const el of all('[data-heading-reveal]')) {
        gsap.set(el, { perspective: 1000 });
        gsap.from(el.querySelectorAll('[data-line]'), {
          z: '5em',
          rotateY: -45,
          autoAlpha: 0,
          duration: 0.85,
          ease: 'slush-bounce',
          stagger: 0.15,
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        });
      }

      // [SM §5.8] 3D card reveal.
      for (const wrap of all('[data-card-reveal="wrap"]')) {
        gsap.set(wrap, { perspective: 1000 });
        gsap.from(wrap.querySelectorAll('[data-card-reveal="card"]'), {
          x: '5em',
          z: '20em',
          rotateY: -30,
          scale: 0.75,
          autoAlpha: 0,
          duration: 0.85,
          ease: 'slush-bounce',
          stagger: { amount: 0.2 },
          scrollTrigger: { trigger: wrap, start: 'top 80%', once: true },
        });
      }

      // [SM §5.9] parallax scrub.
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      for (const trigger of all('[data-parallax="trigger"]')) {
        const target = trigger.querySelector<HTMLElement>('[data-parallax="target"]');
        if (!target || (mobile && target.dataset.parallaxDisable === 'mobile')) continue;
        gsap.fromTo(
          target,
          { yPercent: Number(target.dataset.parallaxStart ?? 0) },
          {
            yPercent: Number(target.dataset.parallaxEnd ?? 0),
            ease: 'none',
            scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 1 },
          },
        );
      }

      document.fonts.ready.then(() => ScrollTrigger.refresh());

      return () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    });

    return () => mm.revert();
  });

  return null;
}
