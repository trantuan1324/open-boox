'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Draggable } from 'gsap/Draggable';
import { Flip } from 'gsap/Flip';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, CustomEase, Draggable, Flip, InertiaPlugin, ScrollTrigger, SplitText);

// The only two eases on the page ([SM §5], [SM §6.1]). slush-bounce is the site's linear() spring as a polyline:
// ~14% overshoot at 24.5%, dip to 0.984 at 58.8%. The same curve is --obx-ease-bounce in landing.css.
CustomEase.create('slush', '0.65,0.05,0,1');
CustomEase.create(
  'slush-bounce',
  'M0,0 L0.076,0.5737 L0.1187,0.8382 L0.1419,0.9463 L0.1654,1.0292 L0.1897,1.0886 L0.2153,1.1258 L0.2297,1.137 ' +
    'L0.2448,1.1424 L0.261,1.1423 L0.2786,1.1366 L0.3101,1.1165 L0.3862,1.0507 L0.4257,1.0219 L0.4699,0.9995 ' +
    'L0.5163,0.9872 L0.5877,0.9842 L0.8126,1.0011 L1,1',
);
gsap.defaults({ ease: 'slush', duration: 0.525 });

export const FULL = '(prefers-reduced-motion: no-preference)';
export const REDUCE = '(prefers-reduced-motion: reduce)';

export { Draggable, Flip, ScrollTrigger, SplitText, gsap, useGSAP };
