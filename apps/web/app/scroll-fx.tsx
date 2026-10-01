'use client';

import { useEffect } from 'react';

// Scroll-driven effects for the landing: a --vel custom property (scroll
// velocity, used to skew the big marquee rows) and data-parallax elements
// that drift vertically relative to the viewport center.
export function ScrollFX() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));

    // offsetTop chain is layout position, unaffected by the transforms we set
    // (no measurement feedback loop).
    const docTop = (el: HTMLElement) => {
      let top = 0;
      let node: HTMLElement | null = el;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return top;
    };

    let lastY = window.scrollY;
    let vel = 0;
    let raf = 0;

    const loop = () => {
      const y = window.scrollY;
      const target = Math.max(-14, Math.min(14, (y - lastY) * 0.4));
      lastY = y;
      vel += (target - vel) * 0.12;
      root.style.setProperty('--vel', vel.toFixed(2));

      const viewportCenter = y + window.innerHeight / 2;
      for (const el of els) {
        const speed = parseFloat(el.dataset.parallax ?? '0');
        const offset = (docTop(el) + el.offsetHeight / 2 - viewportCenter) * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      root.style.removeProperty('--vel');
    };
  }, []);

  return null;
}
