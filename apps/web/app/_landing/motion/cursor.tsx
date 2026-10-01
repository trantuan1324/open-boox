'use client';

import { useRef } from 'react';
import { FULL, gsap, useGSAP } from './gsap';

// [SM §5.4] White pill that follows the pointer and shows the data-cursor label of what it hovers.
// Fine pointers with motion allowed only; touch screens never see it.
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current!;
    const mm = gsap.matchMedia();
    mm.add(`(hover: hover) and (pointer: fine) and ${FULL}`, () => {
      gsap.set(el, { xPercent: 6, yPercent: 50, autoAlpha: 0 });
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      let label = '';
      let flipX = false;
      let flipY = false;

      const onMove = (event: PointerEvent) => {
        xTo(event.clientX);
        yTo(event.clientY);
        const nearRight = event.clientX > window.innerWidth - el.offsetWidth - 48;
        const nearBottom = event.clientY > window.innerHeight - el.offsetHeight - 64;
        if (nearRight !== flipX) {
          flipX = nearRight;
          gsap.to(el, { xPercent: nearRight ? -100 : 6, duration: 0.9, ease: 'power3' });
        }
        if (nearBottom !== flipY) {
          flipY = nearBottom;
          gsap.to(el, { yPercent: nearBottom ? -120 : 50, duration: 0.9, ease: 'power3' });
        }
        const target = (event.target as Element | null)?.closest<HTMLElement>('[data-cursor]');
        const next = target?.dataset.cursor ?? '';
        if (next !== label) {
          label = next;
          if (next) el.textContent = next;
          gsap.to(el, { autoAlpha: next ? 1 : 0, duration: 0.3, ease: 'power3' });
        }
      };

      window.addEventListener('pointermove', onMove);
      return () => window.removeEventListener('pointermove', onMove);
    });
    return () => mm.revert();
  });

  return <div ref={ref} className="obx-cursor" aria-hidden="true" />;
}
