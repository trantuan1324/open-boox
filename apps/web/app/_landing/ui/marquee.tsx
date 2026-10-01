'use client';

import { type ReactNode, useRef } from 'react';
import { REDUCE, ScrollTrigger, gsap, useGSAP } from '../motion/gsap';

interface MarqueeProps {
  children: ReactNode;
  /** Seconds to travel one viewport width at desktop size ([SM §5.5] data-marquee-speed). */
  speed: number;
  reverse?: boolean;
  /** Copies of children inside each half; a half must be wider than the viewport + 20vw. */
  repeat?: number;
  label?: string;
  className?: string;
}

// [SM §5.5] Two identical halves loop by xPercent -50. Scrolling up flips the direction, and the whole row
// drifts ±10vw with the scroll. Duration scales with content/viewport width times a device factor, which keeps
// px/s roughly constant on small screens.
export function Marquee({ children, speed, reverse = false, repeat = 1, label, className = '' }: MarqueeProps) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = root.current!;
    const drift = el.querySelector<HTMLElement>('.obx-marquee__drift')!;
    const track = el.querySelector<HTMLElement>('.obx-marquee__track')!;
    const half = track.firstElementChild as HTMLElement;
    const mm = gsap.matchMedia();

    mm.add(
      {
        desktop: '(min-width: 992px)',
        tablet: '(min-width: 480px) and (max-width: 991px)',
        phone: '(max-width: 479px)',
        reduce: REDUCE,
      },
      (ctx) => {
        const { tablet, phone, reduce } = ctx.conditions as Record<string, boolean>;
        if (reduce) return;
        const factor = phone ? 0.25 : tablet ? 0.5 : 1;
        const duration = speed * (half.offsetWidth / window.innerWidth) * factor;
        const loop = gsap.fromTo(
          track,
          { xPercent: reverse ? -50 : 0 },
          { xPercent: reverse ? 0 : -50, duration, ease: 'none', repeat: -1 },
        );
        // Start far from time 0 so reversing (scrolling up) never runs out of repeats.
        loop.totalTime(loop.duration() * 1000);

        let direction = 1;
        ScrollTrigger.create({
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            if (self.direction === direction) return;
            direction = self.direction;
            gsap.to(loop, { timeScale: direction, duration: 0.3, overwrite: true });
          },
        });
        gsap.fromTo(
          drift,
          { x: 0 },
          {
            x: reverse ? '10vw' : '-10vw',
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
      },
    );
    return () => mm.revert();
  });

  const half = (copy: number) => (
    <div key={copy} className="obx-marquee__half" inert={copy > 0}>
      {Array.from({ length: repeat }, (_, i) => (
        <div key={i} className="obx-marquee__chunk" inert={i > 0}>
          {children}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={root} className={`obx-marquee ${className}`} role={label ? 'region' : undefined} aria-label={label}>
      <div className="obx-marquee__drift">
        <div className="obx-marquee__track">{[0, 1].map(half)}</div>
      </div>
    </div>
  );
}
