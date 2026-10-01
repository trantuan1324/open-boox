'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { curtainStore } from './curtain-store';

const COLORS = ['#4da2ff', '#ffd731', '#e9ccff', '#55db9c', '#fb4903', '#5c4ade'];
type Motion = typeof import('@/app/_landing/motion/gsap');

// [SM §5.16], spec §4.4. Lives in the root layout so it survives the route change it covers. Phase 1: three
// palette panels swing in and cover the screen, then router.push. Phase 2 starts when the pathname changes (or
// after 3s, so a failed navigation never leaves the screen covered).
export function CurtainOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<Motion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const m = motion.current;
    const el = root.current;
    if (!m || !el || !curtainStore.beginReveal()) return;
    const { gsap, REDUCE } = m;
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(el, { autoAlpha: 0 });
        curtainStore.finish();
      },
    });
    if (window.matchMedia(REDUCE).matches) {
      tl.to(el.querySelector('[data-curtain-fade]'), { autoAlpha: 0, duration: 0.3 });
    } else {
      tl.to(el.querySelectorAll('[data-curtain-panel]'), {
        xPercent: -120,
        rotateY: 45,
        z: -300,
        duration: 1.25,
        ease: 'slush-bounce',
        stagger: { each: 0.08, from: 'end' },
      });
    }
  }, []);

  useEffect(
    () =>
      curtainStore.subscribe((state, href) => {
        const el = root.current;
        if (el) el.dataset.state = state;
        if (state !== 'covering' || !href || !el) return;
        void (async () => {
          const m = (motion.current ??= await import('@/app/_landing/motion/gsap'));
          const { gsap, REDUCE } = m;
          const fade = el.querySelector('[data-curtain-fade]');
          const panels = el.querySelectorAll('[data-curtain-panel]');
          const colors = gsap.utils.shuffle([...COLORS]);
          gsap.set(el, { autoAlpha: 1 });
          const tl = gsap.timeline({
            onComplete: () => {
              curtainStore.markCovered();
              router.push(href);
              timer.current = setTimeout(reveal, 3000);
            },
          });
          if (window.matchMedia(REDUCE).matches) {
            gsap.set(panels, { autoAlpha: 0 });
            tl.fromTo(fade, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
          } else {
            gsap.set(fade, { autoAlpha: 0 });
            tl.fromTo(
              panels,
              { autoAlpha: 1, backgroundColor: (i: number) => colors[i], xPercent: 120, rotateY: -45, z: -300 },
              { xPercent: 0, rotateY: 0, z: 0, duration: 0.8, ease: 'slush-bounce', stagger: 0.08 },
            );
          }
        })();
      }),
    [router, reveal],
  );

  useEffect(() => {
    if (curtainStore.get() === 'covered') reveal();
  }, [pathname, reveal]);

  return (
    <div ref={root} className="obx-curtain" data-curtain data-state="idle" aria-hidden="true">
      <div className="obx-curtain__fade" data-curtain-fade />
      {[0, 1, 2].map((i) => (
        <div key={i} className="obx-curtain__panel" data-curtain-panel />
      ))}
    </div>
  );
}
