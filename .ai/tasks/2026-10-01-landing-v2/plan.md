# Landing v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Open Boox landing page `/` with the 13 sections and the GSAP motion language of slush.app, Vietnamese copy, real catalog data only.

**Architecture:** `app/page.tsx` stays a server component that loads plans, categories and the first page of books, then renders one component per section from `app/_landing/sections/`. Sections that only reveal or parallax are server components carrying `data-*` hooks. One client component, `LandingMotion`, turns those hooks into ScrollTriggers and runs Lenis. Interactive sections (nav, hero, carousel, tabs, stack, marquee) are client components using `useGSAP`. A curtain overlay mounted in the root layout plays when a `CurtainLink` leaves `/`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (tokens only; landing styles live in `app/landing.css`), TypeScript, GSAP 3.15 (ScrollTrigger, SplitText, CustomEase, Draggable, InertiaPlugin, Flip), `@gsap/react` 2.1, Lenis 1.3, Vitest (node env), Playwright.

**Spec:** `.ai/tasks/2026-10-01-landing-v2/spec.md` (motion numbers cite `builder/spec/slush-design-motion-spec.md` as [SM §x]). Read both before starting.

## Global Constraints

- Run `source ~/.nvm/nvm.sh && nvm use 22` before any `pnpm` command (Node 20 breaks the API build).
- Work in a git worktree on branch `landing-v2` (superpowers:using-git-worktrees). In the worktree: `cp .env.example .env`, append `COMPOSE_PROJECT_NAME=open_boox` (shares the main Postgres container on port 5433), copy `DATABASE_URL_E2E` from the main checkout's `.env`, then `pnpm install`, `pnpm --filter @open-boox/shared build`, `pnpm db:setup`.
- Files outside `apps/web/app/page.tsx`, `apps/web/app/landing.css`, `apps/web/app/_landing/**`, `apps/web/components/curtain/**` may only change as listed here: `apps/web/app/layout.tsx` (mount `CurtainOverlay`), `apps/web/app/globals.css` (curtain styles), `apps/web/package.json` + `pnpm-lock.yaml` (`gsap`, `@gsap/react`), `e2e/tests/landing.spec.ts` (new). No API changes.
- Exactly two eases: `slush` = `cubic-bezier(0.65, 0.05, 0, 1)` and `slush-bounce` (the spring in [SM §5]). The cursor alone uses `power3`. CSS hover transitions use `all .5s var(--obx-ease-bounce)`.
- Animate only `transform` and `opacity`/`visibility`. The tab visual's `backgroundColor` is the only exception.
- Colors: `ink #000`, `paper #fff`, `sky #dceeff`, `blue #4da2ff`, `indigo #5c4ade`, `sunburst #ffd731`, `ember #fb4903`, `lilac #e9ccff`, `mint #55db9c` (Tailwind tokens `--color-*` in `app/theme.css`). No gradients, no box-shadow.
- Radius: sheet 40px (30px ≤767), box/tile 30px, card 20px, pill 999px. Borders 1px black, 2px on round buttons. Gap between sheets 12px (8px ≤767).
- Black text on every accent background; white text only on black.
- Fonts already loaded by `app/layout.tsx`: display `var(--font-display)` (Barlow Condensed 800 + italic), UI `var(--font-sans)` (Be Vietnam Pro). Do not load other fonts.
- Vietnamese strings are written in NFC (precomposed). Type them normally; do not paste decomposed text.
- Every GSAP tween, ScrollTrigger, SplitText and Draggable is created inside `useGSAP` and, where it depends on media, inside `gsap.matchMedia()`, and is reverted or killed on unmount.
- Reduced motion (spec §4.3): no Lenis, no cursor, no split text, no 3D, no stagger, marquees paused, parallax off, carousel no autoplay, curtain becomes a 0.3s fade. Content must never stay hidden.
- Breakpoints: CSS `479 / 767 / 991` (max-width); JS `768` (slider/tabs) and `992` (desktop nav).
- Commits: `feat(web): …` / `test(e2e): …` style, **no** `Co-Authored-By` or other attribution trailer.
- Commands used throughout (from the repo root):
  - Unit tests: `pnpm --filter web test`
  - Types: `pnpm --filter web typecheck`
  - Lint: `pnpm --filter web lint`
  - Landing e2e: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts` (rebuilds shared, api and web first; takes a few minutes)
  - Dev server: `pnpm dev`, then open http://localhost:3000 in the in-app browser.

## Review Focus

1. **Browser Back to `/` after a curtain navigation**: the landing re-mounts, the intro plays again, the overlay is idle and does not block clicks. Pinned by the e2e test "back to the landing after a curtain navigation" in Task 11.
2. **Double-clicking a curtain CTA**: exactly one navigation; Back returns to `/`, not to a duplicate history entry. Pinned by "double click navigates once" in Task 11.
3. **Ctrl/Cmd-click on a curtain CTA**: a new tab opens on the target; the current page keeps working and shows no overlay. Pinned by "modifier click opens a new tab without the curtain" in Task 11.
4. **Resizing across the 992px nav breakpoint after the pills were hidden by scrolling**: the pills work at the new size (menu opens on mobile, pills return on desktop). Pinned by "nav still works after resizing across the desktop breakpoint" in Task 4.
5. **Keyboard users on a scrolled page**: tabbing into the nav reveals pills hidden by scrolling. Pinned by "keyboard focus brings hidden nav pills back" in Task 4.

## Spec adjustments made while planning

These are already written into the spec (same commit as this plan):

- Marquee speed: [SM §5.5] multiplies a duration that scales with content width / viewport width, so the 0.5/0.25 factors keep px/s roughly constant on small screens. The acceptance item now says "px/s about the same at 1440 and 375" instead of "slower".
- Wordmark: letters are Barlow glyphs in split-flap cells (outline layer → filled layer) rolled by one tween per letter, instead of hand-drawn SVG paths with a separate second-layer tween.
- No `split.ts`: SplitText ≥3.13 sets `aria-label`/`aria-hidden` itself. Heading 3D uses explicit `[data-line]` spans because the statement holds an inline card.
- Nav is `position: sticky` instead of fixed, and keyboard focus also reveals hidden pills.
- `CurtainLink` swallows clicks while a curtain is already running.
- Tab panels stack in one grid cell, so there is no height tween.
- `howItWorksCards(total)` joins the pure helpers in `data.ts` with its own unit test.
- No explicit `router.prefetch` in `CurtainLink`: `next/link` already prefetches visible links in production.

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/app/page.tsx` | Server: fetch landing data, order the sections |
| `apps/web/app/landing.css` | All landing styles, one block per section, scoped `.obx-*` |
| `apps/web/app/_landing/data.ts` | Fetch with per-source fallback, static copy, pure helpers |
| `apps/web/app/_landing/data.test.ts` | Unit tests for `data.ts` |
| `apps/web/app/_landing/motion/gsap.ts` | Plugin registration, the two eases, defaults, media query strings |
| `apps/web/app/_landing/motion/landing-motion.tsx` | Lenis + scan of `data-*` hooks into ScrollTriggers |
| `apps/web/app/_landing/motion/cursor.tsx` | Custom cursor pill |
| `apps/web/app/_landing/svg/stickers.tsx` | Sticker SVGs |
| `apps/web/app/_landing/svg/illustrations.tsx` | Card illustrations for features and tabs |
| `apps/web/app/_landing/svg/wordmark.tsx` | Split-flap wordmark markup |
| `apps/web/app/_landing/ui/marquee.tsx` | Scroll-reactive infinite marquee |
| `apps/web/app/_landing/ui/horizontal-loop.ts` | Port of GSAP's `horizontalLoop` helper |
| `apps/web/app/_landing/sections/*.tsx` | One file per section |
| `apps/web/components/curtain/curtain-store.ts` (+ `.test.ts`) | Curtain state machine |
| `apps/web/components/curtain/curtain-overlay.tsx` | Overlay in the root layout that plays both phases |
| `apps/web/components/curtain/curtain-link.tsx` | Link that asks the overlay to cover before navigating |
| `e2e/tests/landing.spec.ts` | Landing e2e |

---

### Task 1: Landing data layer

**Files:**
- Create: `apps/web/app/_landing/data.ts`
- Test: `apps/web/app/_landing/data.test.ts`

**Interfaces:**
- Consumes: `BookSummary`, `CategoryDto`, `Paged`, `PlanDto` types from `@open-boox/shared`.
- Produces:
  - `PALETTE: readonly string[]` (yellow, lilac, blue, orange, mint hex)
  - `FALLBACK_PLANS: PlanDto[]`, `FALLBACK_CATEGORIES: CategoryDto[]`
  - `interface LandingData { plans: PlanDto[]; categories: CategoryDto[]; books: BookSummary[]; total: number | null }`
  - `type Fetcher = <T>(path: string) => Promise<T>`
  - `loadLanding(fetcher: Fetcher): Promise<LandingData>`
  - `cheapestPlanPrice(plans: PlanDto[]): number | null`
  - `pickFeaturedBook(books: BookSummary[], rand?: () => number): BookSummary | null`
  - `cycleColor(i: number, palette?: readonly string[]): string`
  - `interface Step { n: number; title: string; body: string }`, `STEPS: Step[]`
  - `type HowCard = { kind: 'step'; step: Step } | { kind: 'stat'; total: number }`
  - `howItWorksCards(total: number | null): HowCard[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/_landing/data.test.ts`:

```ts
import type { BookSummary, PlanDto } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CATEGORIES,
  FALLBACK_PLANS,
  PALETTE,
  STEPS,
  cheapestPlanPrice,
  cycleColor,
  howItWorksCards,
  loadLanding,
  pickFeaturedBook,
  type Fetcher,
} from './data';

const book = (slug: string, coverUrl: string | null): BookSummary => ({
  id: slug,
  slug,
  title: slug,
  author: 'Tác giả',
  isbn: '000',
  coverUrl,
  salePrice: null,
  categoryName: 'Văn học',
  categorySlug: 'van-hoc',
  saleStock: 0,
  availableCopies: 1,
});

const plan = (code: string, monthlyPrice: number): PlanDto => ({ code, name: code, maxBooks: 2, monthlyPrice });

describe('loadLanding', () => {
  it('returns every source when the API answers', async () => {
    const plans = [plan('basic', 79000)];
    const categories = [{ id: 'c', name: 'Văn học', slug: 'van-hoc' }];
    const books = [book('a', null)];
    const fetcher: Fetcher = async <T,>(path: string) =>
      ({ '/plans': plans, '/categories': categories, '/books': { items: books, total: 40, page: 1, pageSize: 12 } })[
        path
      ] as T;
    expect(await loadLanding(fetcher)).toEqual({ plans, categories, books, total: 40 });
  });

  it('falls back per source when calls fail', async () => {
    const fetcher: Fetcher = async () => {
      throw new Error('down');
    };
    expect(await loadLanding(fetcher)).toEqual({
      plans: FALLBACK_PLANS,
      categories: FALLBACK_CATEGORIES,
      books: [],
      total: null,
    });
  });

  it('keeps the sources that worked when only books fail', async () => {
    const plans = [plan('basic', 79000)];
    const fetcher: Fetcher = async <T,>(path: string) => {
      if (path === '/books') throw new Error('down');
      return (path === '/plans' ? plans : []) as T;
    };
    const data = await loadLanding(fetcher);
    expect(data.plans).toBe(plans);
    expect(data.categories).toEqual([]);
    expect(data.total).toBeNull();
  });
});

describe('cheapestPlanPrice', () => {
  it('returns the lowest monthly price', () => {
    expect(cheapestPlanPrice([plan('a', 119000), plan('b', 79000), plan('c', 179000)])).toBe(79000);
  });

  it('returns null without plans', () => {
    expect(cheapestPlanPrice([])).toBeNull();
  });
});

describe('pickFeaturedBook', () => {
  it('only picks books that have a cover', () => {
    const books = [book('a', null), book('b', 'https://x/b.jpg'), book('c', 'https://x/c.jpg')];
    expect(pickFeaturedBook(books, () => 0)?.slug).toBe('b');
    expect(pickFeaturedBook(books, () => 0.99)?.slug).toBe('c');
  });

  it('returns null when no book has a cover', () => {
    expect(pickFeaturedBook([book('a', null)], () => 0)).toBeNull();
    expect(pickFeaturedBook([], () => 0)).toBeNull();
  });
});

describe('cycleColor', () => {
  it('wraps around the palette', () => {
    expect(cycleColor(0)).toBe(PALETTE[0]);
    expect(cycleColor(PALETTE.length + 1)).toBe(PALETTE[1]);
    expect(cycleColor(3, ['#1', '#2'])).toBe('#2');
  });
});

describe('howItWorksCards', () => {
  it('puts the stat card third when there are books', () => {
    const cards = howItWorksCards(120);
    expect(cards.map((c) => c.kind)).toEqual(['step', 'step', 'stat', 'step', 'step']);
    expect(cards[2]).toEqual({ kind: 'stat', total: 120 });
  });

  it('shows only the steps when the total is unknown or zero', () => {
    expect(howItWorksCards(null)).toEqual(STEPS.map((step) => ({ kind: 'step', step })));
    expect(howItWorksCards(0)).toHaveLength(STEPS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- _landing`
Expected: FAIL, `Failed to resolve import "./data"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/app/_landing/data.ts`:

```ts
import type { BookSummary, CategoryDto, Paged, PlanDto } from '@open-boox/shared';

// Accent runs cycle yellow → lilac → blue → orange → mint (ui_design/landing-ui-spec.md §2.1).
export const PALETTE = ['#ffd731', '#e9ccff', '#4da2ff', '#fb4903', '#55db9c'] as const;

export const FALLBACK_PLANS: PlanDto[] = [
  { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79000 },
  { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119000 },
  { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179000 },
];

export const FALLBACK_CATEGORIES: CategoryDto[] = [
  { id: 'van-hoc', name: 'Văn học', slug: 'van-hoc' },
  { id: 'kinh-te', name: 'Kinh tế', slug: 'kinh-te' },
  { id: 'tam-ly-ky-nang', name: 'Tâm lý – Kỹ năng', slug: 'tam-ly-ky-nang' },
  { id: 'khoa-hoc', name: 'Khoa học', slug: 'khoa-hoc' },
  { id: 'lich-su', name: 'Lịch sử', slug: 'lich-su' },
  { id: 'thieu-nhi', name: 'Thiếu nhi', slug: 'thieu-nhi' },
];

export interface LandingData {
  plans: PlanDto[];
  categories: CategoryDto[];
  books: BookSummary[];
  total: number | null;
}

export type Fetcher = <T>(path: string) => Promise<T>;

// Each source fails on its own: plans and categories fall back to static copies, books to an empty shelf.
export async function loadLanding(fetcher: Fetcher): Promise<LandingData> {
  const [plans, categories, books] = await Promise.allSettled([
    fetcher<PlanDto[]>('/plans'),
    fetcher<CategoryDto[]>('/categories'),
    fetcher<Paged<BookSummary>>('/books'),
  ]);
  return {
    plans: plans.status === 'fulfilled' ? plans.value : FALLBACK_PLANS,
    categories: categories.status === 'fulfilled' ? categories.value : FALLBACK_CATEGORIES,
    books: books.status === 'fulfilled' ? books.value.items : [],
    total: books.status === 'fulfilled' ? books.value.total : null,
  };
}

export function cheapestPlanPrice(plans: PlanDto[]): number | null {
  return plans.length ? Math.min(...plans.map((p) => p.monthlyPrice)) : null;
}

export function pickFeaturedBook(books: BookSummary[], rand: () => number = Math.random): BookSummary | null {
  const withCover = books.filter((b) => b.coverUrl);
  return withCover.length ? withCover[Math.floor(rand() * withCover.length)] : null;
}

export function cycleColor(i: number, palette: readonly string[] = PALETTE): string {
  return palette[i % palette.length];
}

export interface Step {
  n: number;
  title: string;
  body: string;
}

export type HowCard = { kind: 'step'; step: Step } | { kind: 'stat'; total: number };

export const STEPS: Step[] = [
  { n: 1, title: 'Chọn gói', body: 'Basic, Standard hay Premium — khác nhau ở số cuốn được giữ cùng lúc.' },
  { n: 2, title: 'Chọn sách', body: 'Thêm sách vào giỏ mượn rồi xác nhận một lần.' },
  { n: 3, title: 'Nhận tận nhà', body: 'Sách được giao tới địa chỉ bạn chọn.' },
  { n: 4, title: 'Trả & mượn tiếp', body: 'Báo trả, chúng tôi đến lấy. Chỗ trống trong gói sẵn sàng cho cuốn mới.' },
];

// The stat card goes third, between "Chọn sách" and "Nhận tận nhà"; no stat when the total is unknown or zero.
export function howItWorksCards(total: number | null): HowCard[] {
  const cards: HowCard[] = STEPS.map((step) => ({ kind: 'step', step }));
  if (total) cards.splice(2, 0, { kind: 'stat', total });
  return cards;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- _landing`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_landing/data.ts apps/web/app/_landing/data.test.ts
git commit -m "feat(web): landing v2 data layer with per-source fallback"
```

---

### Task 2: Motion foundation, base styles and empty landing shell

Replaces the old landing with an empty frame plus the motion plumbing every later task uses.

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml` (add `gsap`, `@gsap/react`)
- Create: `apps/web/app/_landing/motion/gsap.ts`, `apps/web/app/_landing/motion/landing-motion.tsx`, `apps/web/app/_landing/motion/cursor.tsx`
- Rewrite: `apps/web/app/landing.css`, `apps/web/app/page.tsx`
- Delete: `apps/web/app/reveal.tsx`, `apps/web/app/scroll-fx.tsx`, `apps/web/app/smooth-scroll.tsx`

**Interfaces:**
- Produces from `motion/gsap.ts`: `gsap`, `useGSAP`, `ScrollTrigger`, `SplitText`, `Draggable`, `Flip`; constants `FULL = '(prefers-reduced-motion: no-preference)'`, `REDUCE = '(prefers-reduced-motion: reduce)'`; registered eases `'slush'`, `'slush-bounce'`.
- Produces `<LandingMotion />`, which handles these hooks anywhere inside `.obx-home`:
  - `data-anim-slant`: char reveal
  - `data-heading-reveal` with child `[data-line]` elements: 3D line reveal
  - `data-card-reveal="wrap"` containing `data-card-reveal="card"`: 3D card reveal
  - `data-parallax="trigger"` containing `data-parallax="target"` with `data-parallax-start`, `data-parallax-end` (yPercent numbers) and optional `data-parallax-disable="mobile"`
- Produces `<Cursor />`, which shows the label of the nearest `[data-cursor="label"]` ancestor under the pointer.
- CSS classes from `landing.css` used by later tasks: `.obx-home`, `.obx-sheet`, `.obx-sheet--sky`, `.obx-sheet--frame`, `.obx-display`, `.obx-italic`, `.obx-heading`, `.obx-body`, `.obx-btn`, `.obx-btn--dark`, `.obx-btn--sm`, `.obx-round`, `.obx-sticker`, custom property `--obx-ease-bounce`, `--obx-gap`, `--obx-pad`.

- [ ] **Step 1: Add the dependencies**

```bash
pnpm --filter web add gsap@^3.15.0 @gsap/react@^2.1.2
```

Expected: `apps/web/package.json` lists both under `dependencies`.

- [ ] **Step 2: Create `motion/gsap.ts`**

```ts
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
```

- [ ] **Step 3: Create `motion/landing-motion.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `motion/cursor.tsx`**

```tsx
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
```

- [ ] **Step 5: Rewrite `app/landing.css` with the base block**

Replace the whole file with:

```css
/* Open Boox landing v2 — slush design & motion language.
   Spec: .ai/tasks/2026-10-01-landing-v2/spec.md. Every rule is scoped to .obx-*; sections append blocks below. */

body:has(.obx-home) {
  overflow-x: clip;
}

.obx-home {
  --obx-gap: 12px;
  --obx-pad: clamp(16px, 5vw, 80px);
  --obx-ease-bounce: linear(
    0 0%, 0.5737 7.6%, 0.8382 11.87%, 0.9463 14.19%, 1.0292 16.54%, 1.0886 18.97%, 1.1258 21.53%, 1.137 22.97%,
    1.1424 24.48%, 1.1423 26.1%, 1.1366 27.86%, 1.1165 31.01%, 1.0507 38.62%, 1.0219 42.57%, 0.9995 46.99%,
    0.9872 51.63%, 0.9842 58.77%, 1.0011 81.26%, 1 100%
  );

  display: flex;
  flex-direction: column;
  gap: var(--obx-gap);
  font-family: var(--font-sans);
  color: var(--color-ink);
}

@media (max-width: 767px) {
  .obx-home {
    --obx-gap: 8px;
  }
}

.obx-home a {
  color: inherit;
  text-decoration: none;
}

.obx-home :focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 3px;
}

/* ---------- Sheets ---------- */

.obx-sheet {
  position: relative;
  overflow: clip;
  border-radius: 40px;
  background: var(--color-paper);
  padding: clamp(48px, 7vw, 112px) var(--obx-pad);
}

.obx-sheet--sky {
  background: var(--color-sky);
}

/* Black band: no fill, so the body frame shows through. */
.obx-sheet--frame {
  background: transparent;
  border-radius: 0;
  padding: 0;
  overflow: visible;
}

.obx-sheet--frame :focus-visible {
  outline-color: var(--color-paper);
}

@media (max-width: 767px) {
  .obx-sheet {
    border-radius: 30px;
  }
}

/* ---------- Type ---------- */

.obx-display {
  font-family: var(--font-display);
  font-weight: 800;
  text-transform: uppercase;
  line-height: 0.8;
  margin-bottom: -0.1em;
  padding-top: 0.08em;
  font-size: 160px;
}

.obx-display em,
.obx-italic {
  font-style: italic;
}

@media (max-width: 991px) {
  .obx-display {
    font-size: 128px;
  }
}

@media (max-width: 767px) {
  .obx-display {
    font-size: 99px;
  }
}

@media (max-width: 479px) {
  .obx-display {
    font-size: 20vw;
  }
}

.obx-heading {
  font-size: clamp(32px, 4.44vw, 64px);
  line-height: 1;
  letter-spacing: -0.01em;
  font-weight: 500;
}

.obx-body {
  font-size: 16px;
  line-height: 1.25;
  font-weight: 500;
}

/* ---------- Buttons ---------- */

.obx-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: 16px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-btn:hover {
  background: var(--color-ink);
  color: var(--color-paper);
  transform: translateY(-2px);
}

.obx-btn--dark {
  background: var(--color-ink);
  color: var(--color-paper);
}

.obx-btn--dark:hover {
  background: var(--color-paper);
  color: var(--color-ink);
}

.obx-btn--sm {
  padding: 12px 18px;
  font-size: 13px;
}

.obx-round {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 2px solid var(--color-ink);
  border-radius: 50%;
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-round:hover {
  background: var(--color-ink);
  color: var(--color-paper);
}

.obx-sticker {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/* ---------- Cursor ---------- */

.obx-cursor {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  padding: 10px 16px;
  border: 1.5px solid var(--color-ink);
  border-radius: 1500px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: 700 15px/1 var(--font-sans);
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
}
```

- [ ] **Step 6: Replace `app/page.tsx` with the shell**

```tsx
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import './landing.css';

export default function HomePage() {
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
    </div>
  );
}
```

- [ ] **Step 7: Delete the old motion helpers**

```bash
git rm apps/web/app/reveal.tsx apps/web/app/scroll-fx.tsx apps/web/app/smooth-scroll.tsx
```

- [ ] **Step 8: Verify**

Run `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test`.
Expected: typecheck clean; lint shows no errors (the 3 existing warnings may remain); all web tests pass.

Then `pnpm dev`, open http://localhost:3000 in the in-app browser:
- Expected: a black page, no errors in the console (`read_console_messages` with `onlyErrors`).
- `/books` still renders with the normal site header and footer.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/app/_landing/motion apps/web/app/landing.css apps/web/app/page.tsx
git commit -m "feat(web): GSAP motion foundation and empty landing v2 shell"
```

---

### Task 3: Marquee, stickers, banner, word and cover marquees, landing e2e smoke

**Files:**
- Create: `apps/web/app/_landing/ui/marquee.tsx`, `apps/web/app/_landing/svg/stickers.tsx`, `apps/web/app/_landing/sections/banner.tsx`, `apps/web/app/_landing/sections/word-marquee.tsx`, `apps/web/app/_landing/sections/cover-marquee.tsx`, `e2e/tests/landing.spec.ts`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append)

**Interfaces:**
- Consumes: `loadLanding`, `cheapestPlanPrice`, `cycleColor` (Task 1); `gsap`, `useGSAP`, `ScrollTrigger`, `REDUCE` (Task 2).
- Produces:
  - `<Marquee speed: number; reverse?: boolean; repeat?: number; label?: string; className?: string>{children}</Marquee>`. `speed` is seconds for a viewport-wide stretch; `repeat` copies `children` inside each half so a half is wider than the viewport plus 20vw.
  - Stickers: `StickerBook`, `StickerGlasses`, `StickerBookmark`, `StickerParcel`, `StickerCoin`, `StickerCheck`, `StickerStar`, each `(props: { className?: string; style?: CSSProperties }) => JSX.Element`, and `STICKERS` (array of those components).
  - CSS: `.obx-tile`, `.obx-tile--{paper,ember,blue,sunburst,mint,lilac}`, `.obx-tile__text`.

- [ ] **Step 1: Write the failing e2e smoke test**

Create `e2e/tests/landing.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';

// 404s from the cover image host are not landing bugs.
const IGNORED = /Failed to load resource/;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !IGNORED.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.mouse.move(200, 200);
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
}

test('landing renders and scrolls to the bottom without errors', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('region', { name: 'Thông báo' })).toBeVisible();
  await scrollToBottom(page);
  expect(errors).toEqual([]);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await scrollToBottom(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: FAIL on `getByRole('region', { name: 'Thông báo' })` (no banner yet). The 375px test passes already; that is fine.

- [ ] **Step 3: Create `ui/marquee.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `svg/stickers.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react';

type StickerProps = { className?: string; style?: CSSProperties };

// Flat stickers with a heavy black outline, drawn for Open Boox (no third-party art).
function Sticker({ children, className = '', style }: StickerProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`obx-sticker ${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="#000"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function StickerBook(props: StickerProps) {
  return (
    <Sticker {...props}>
      <rect x="28" y="16" width="66" height="88" rx="8" fill="#ffd731" />
      <path d="M42 16v88" />
      <circle cx="60" cy="54" r="5" fill="#000" />
      <circle cx="80" cy="54" r="5" fill="#000" />
      <path d="M60 70q10 9 20 0" />
    </Sticker>
  );
}

export function StickerGlasses(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="36" cy="64" r="22" fill="#e9ccff" />
      <circle cx="84" cy="64" r="22" fill="#e9ccff" />
      <path d="M58 60q2-6 4 0M14 58 6 44M106 58l8-14" />
      <path d="M28 56q6-6 12 0M76 56q6-6 12 0" />
    </Sticker>
  );
}

export function StickerBookmark(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="M36 10h48v98L60 88l-24 20z" fill="#55db9c" />
      <path d="m60 32 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff" />
    </Sticker>
  );
}

export function StickerParcel(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="m16 42 44-22 44 22v50l-44 22-44-22z" fill="#4da2ff" />
      <path d="m16 42 44 22 44-22M60 64v50M38 31l44 22v14" />
    </Sticker>
  );
}

export function StickerCoin(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="60" cy="60" r="42" fill="#ffd731" />
      <circle cx="60" cy="60" r="30" />
      <path d="M66 40v34M56 50h16M66 62q-14-8-16 4t16 6" />
    </Sticker>
  );
}

export function StickerCheck(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="60" cy="60" r="42" fill="#55db9c" />
      <path d="m40 62 14 14 28-30" strokeWidth={8} />
    </Sticker>
  );
}

export function StickerStar(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="M60 8c6 38 14 46 52 52-38 6-46 14-52 52-6-38-14-46-52-52 38-6 46-14 52-52z" fill="#fb4903" />
    </Sticker>
  );
}

export const STICKERS = [StickerBook, StickerGlasses, StickerBookmark, StickerParcel, StickerCoin, StickerCheck];
```

- [ ] **Step 5: Create `sections/banner.tsx`**

```tsx
import type { PlanDto } from '@open-boox/shared';
import { formatVnd } from '@/lib/format';
import { cheapestPlanPrice } from '../data';
import { Marquee } from '../ui/marquee';

export function Banner({ plans }: { plans: PlanDto[] }) {
  const price = cheapestPlanPrice(plans);
  const items = [
    ...(price === null ? [] : [`Gói mượn từ ${formatVnd(price)}/30 ngày`]),
    'Giao & nhận sách tận nhà',
    'Trả cuốn này, mượn cuốn khác',
  ];
  return (
    <div className="obx-banner">
      <Marquee speed={25} repeat={3} label="Thông báo">
        {items.map((text) => (
          <span key={text} className="obx-banner__item">
            {text}
            <span aria-hidden="true">✦</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
```

- [ ] **Step 6: Create `sections/word-marquee.tsx`**

```tsx
import { StickerCoin, StickerStar } from '../svg/stickers';
import { Marquee } from '../ui/marquee';

type Tile = { text: string; italic: boolean; tone: 'paper' | 'ember' | 'blue' | 'sunburst' | 'mint' | 'lilac' };

const ROW_1: Tile[] = [
  { text: 'Mượn', italic: false, tone: 'paper' },
  { text: 'Mua', italic: true, tone: 'ember' },
  { text: 'Giao', italic: false, tone: 'blue' },
  { text: 'Đọc', italic: true, tone: 'paper' },
];

const ROW_2: Tile[] = [
  { text: 'Open Boox', italic: false, tone: 'blue' },
  { text: 'Trả & mượn tiếp', italic: true, tone: 'sunburst' },
  { text: 'Open Boox', italic: false, tone: 'mint' },
  { text: 'Trả & mượn tiếp', italic: true, tone: 'lilac' },
];

function Tiles({ tiles, sticker }: { tiles: Tile[]; sticker: 'coin' | 'star' }) {
  return tiles.map((tile, i) => (
    <span key={i} className={`obx-tile obx-tile--${tile.tone}`}>
      <span className={`obx-display obx-tile__text${tile.italic ? ' obx-italic' : ''}`}>{tile.text}</span>
      {i === 1 && (sticker === 'coin' ? <StickerCoin /> : <StickerStar />)}
    </span>
  ));
}

// Section 7 [SM §4 #7]: two rows of display tiles on the black frame, running in opposite directions.
export function WordMarquee() {
  return (
    <section className="obx-sheet obx-sheet--frame obx-words" aria-label="Mượn, mua, giao, đọc">
      <Marquee speed={15}>
        <Tiles tiles={ROW_1} sticker="coin" />
      </Marquee>
      <Marquee speed={20} reverse>
        <Tiles tiles={ROW_2} sticker="star" />
      </Marquee>
    </section>
  );
}
```

- [ ] **Step 7: Create `sections/cover-marquee.tsx`**

```tsx
import type { BookSummary } from '@open-boox/shared';
import Link from 'next/link';
import { BookCover } from '@/components/books/book-cover';
import { cycleColor } from '../data';
import { STICKERS } from '../svg/stickers';
import { Marquee } from '../ui/marquee';

const TILE_PALETTE = ['#4da2ff', '#ffd731', '#55db9c', '#e9ccff'];

// Section 11: book covers and authors from the catalog instead of partner logos. Sticker tiles when the API is down.
export function CoverMarquee({ books }: { books: BookSummary[] }) {
  return (
    <section className="obx-sheet obx-sheet--frame obx-covers" aria-label="Sách trong kho">
      <Marquee speed={25} repeat={books.length ? Math.max(1, Math.ceil(8 / books.length)) : 2}>
        {books.length
          ? books.map((book, i) => (
              <Link
                key={book.id}
                href={`/books/${book.slug}`}
                className="obx-cover-tile"
                style={{ background: cycleColor(i, TILE_PALETTE) }}
                data-cursor="Xem sách"
              >
                <span className="obx-cover-tile__cover">
                  <BookCover src={book.coverUrl} title={book.title} sizes="120px" />
                </span>
                <span className="obx-cover-tile__author">{book.author}</span>
              </Link>
            ))
          : STICKERS.map((Sticker, i) => (
              <span key={i} className="obx-cover-tile" style={{ background: cycleColor(i, TILE_PALETTE) }}>
                <Sticker className="obx-cover-tile__sticker" />
              </span>
            ))}
      </Marquee>
    </section>
  );
}
```

- [ ] **Step 8: Update `app/page.tsx`**

```tsx
import { apiPublic } from '@/lib/api/server';
import { loadLanding } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const data = await loadLanding(apiPublic);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <WordMarquee />
      <CoverMarquee books={data.books} />
    </div>
  );
}
```

- [ ] **Step 9: Append the marquee styles to `landing.css`**

```css
/* ---------- Marquee ---------- */

.obx-marquee {
  overflow: clip;
}

/* Buffer for the ±10vw drift; dropped under reduced motion so the first item is not cut. */
@media (prefers-reduced-motion: no-preference) {
  .obx-marquee__drift {
    margin-left: -10vw;
  }
}

.obx-marquee__track,
.obx-marquee__half,
.obx-marquee__chunk {
  display: flex;
  flex-shrink: 0;
}

.obx-marquee__track {
  width: max-content;
}

/* ---------- 0 · Banner ---------- */

.obx-banner {
  margin-inline: calc(-1 * var(--obx-gap));
  background: var(--color-lilac);
}

.obx-banner__item {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  padding-right: 24px;
  font-size: 13px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* ---------- 7 · Word marquee, 11 · Cover marquee ---------- */

.obx-words,
.obx-covers {
  display: flex;
  flex-direction: column;
  gap: var(--obx-gap);
}

.obx-tile {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-right: var(--obx-gap);
  padding: 0.14em 0.3em 0.06em;
  border-radius: 30px;
  font-size: clamp(72px, 10vw, 150px);
  white-space: nowrap;
}

.obx-tile__text {
  font-size: 1em;
}

.obx-tile--paper { background: var(--color-paper); }
.obx-tile--ember { background: var(--color-ember); }
.obx-tile--blue { background: var(--color-blue); }
.obx-tile--sunburst { background: var(--color-sunburst); }
.obx-tile--mint { background: var(--color-mint); }
.obx-tile--lilac { background: var(--color-lilac); }

.obx-tile .obx-sticker {
  position: absolute;
  top: -0.12em;
  right: -0.08em;
  width: 0.7em;
  rotate: 12deg;
}

.obx-cover-tile {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 249px;
  aspect-ratio: 1;
  margin-right: var(--obx-gap);
  padding: 20px;
  border-radius: 30px;
}

.obx-cover-tile__cover {
  width: 112px;
}

.obx-cover-tile__sticker {
  width: 120px;
}

.obx-cover-tile__author {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}
```

- [ ] **Step 10: Run the e2e smoke test to verify it passes**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 11: Browser check**

`pnpm dev`, open http://localhost:3000:
- The lilac banner runs full width (edge to edge, no black gutter at the sides); the word rows run in opposite directions; the cover row shows real covers.
- Scroll down, then up: every row reverses direction while scrolling up and drifts sideways with the scroll; the loops never show a gap.
- `resize_window` to 375: rows still loop without gaps, and the pixel speed looks about the same as at desktop size.
- Reduced motion is covered by the e2e tests added in Tasks 5, 6 and 11.

- [ ] **Step 12: Commit**

```bash
git add apps/web/app/_landing e2e/tests/landing.spec.ts apps/web/app/page.tsx apps/web/app/landing.css
git commit -m "feat(web): scroll-reactive marquees, stickers, banner and cover rows for landing v2"
```

---

### Task 4: Nav

**Files:**
- Create: `apps/web/app/_landing/sections/nav.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `getCurrentUser` (`@/lib/api/server`), `PublicUser` (`@open-boox/shared`), `CartLink` (`@/components/cart/cart-link`), `gsap`, `useGSAP`, `FULL`, `REDUCE`.
- Produces: `<Nav user={PublicUser | null} />`; DOM `header.obx-nav` (the hero intro in Task 5 slides it), `nav[aria-label="Chính"]`, pill items `.obx-nav__li`, button labelled "Mở menu"/"Đóng menu".

- [ ] **Step 1: Write the failing e2e tests**

Append to `e2e/tests/landing.spec.ts`:

```ts
const navPill = (page: Page) =>
  page.getByRole('navigation', { name: 'Chính' }).getByRole('link', { name: 'Sách', exact: true });

async function scrollBy(page: Page, dy: number): Promise<void> {
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(1200);
}

test.describe('nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(1500); // hero intro
  });

  test('nav pills hide on scroll down and come back on scroll up', async ({ page }) => {
    await expect(navPill(page)).toBeInViewport();
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await scrollBy(page, -300);
    await expect(navPill(page)).toBeInViewport();
  });

  test('keyboard focus brings hidden nav pills back', async ({ page }) => {
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await navPill(page).focus();
    await expect(navPill(page)).toBeInViewport();
  });

  test('nav still works after resizing across the desktop breakpoint', async ({ page }) => {
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(navPill(page)).toBeInViewport();
    await page.setViewportSize({ width: 1440, height: 900 });
    await scrollBy(page, -6000);
    await expect(navPill(page)).toBeInViewport();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: the 3 nav tests FAIL (no `navigation` named "Chính").

- [ ] **Step 3: Create `sections/nav.tsx`**

```tsx
'use client';

import type { PublicUser } from '@open-boox/shared';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { CartLink } from '@/components/cart/cart-link';
import { FULL, REDUCE, gsap, useGSAP } from '../motion/gsap';

const DESKTOP = '(min-width: 992px)';
const PILL = 'obx-btn obx-btn--sm';

// [SM §5.2] Desktop: pills hide on scroll down, return on scroll up; hovering "+" or tabbing into the nav reveals
// them. Below 992px the pills live in a menu opened by "+".
export function Nav({ user }: { user: PublicUser | null }) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useGSAP(() => {
    const header = root.current!;
    const items = gsap.utils.toArray<HTMLElement>('.obx-nav__li', header);
    const plus = header.querySelector<HTMLElement>('.obx-nav__plus')!;
    const mm = gsap.matchMedia();

    mm.add(DESKTOP, () => {
      setOpen(false);
      gsap.set(items, { clearProps: 'transform' }); // drop leftovers from the mobile menu animation
    });

    mm.add(`${DESKTOP} and ${FULL}`, () => {
      let shown = true;
      let lastY = window.scrollY;
      const show = (next: boolean) => {
        if (next === shown) return;
        shown = next;
        gsap.to(items, {
          yPercent: next ? 0 : -300,
          duration: 0.75,
          ease: 'slush-bounce',
          stagger: { each: 0.03, from: next ? 'end' : 'start' },
          overwrite: true,
        });
      };
      const onScroll = () => {
        const y = window.scrollY;
        if (Math.abs(y - lastY) < 10) return;
        show(y <= 50 || y < lastY);
        lastY = y;
      };
      const reveal = () => show(true);
      const leave = () => {
        if (window.scrollY > 50 && !header.contains(document.activeElement)) show(false);
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      plus.addEventListener('pointerenter', reveal);
      header.addEventListener('focusin', reveal);
      header.addEventListener('pointerleave', leave);
      return () => {
        window.removeEventListener('scroll', onScroll);
        plus.removeEventListener('pointerenter', reveal);
        header.removeEventListener('focusin', reveal);
        header.removeEventListener('pointerleave', leave);
      };
    });

    return () => mm.revert();
  });

  // Mobile menu: pills slide in from the right, last one first.
  useGSAP(
    () => {
      if (!open || window.matchMedia(DESKTOP).matches || window.matchMedia(REDUCE).matches) return;
      gsap.fromTo(
        '.obx-nav__li',
        { xPercent: 300 },
        { xPercent: 0, duration: 0.75, ease: 'slush-bounce', stagger: { each: 0.03, from: 'end' } },
      );
    },
    { dependencies: [open], scope: root },
  );

  const toggle = () => {
    if (!window.matchMedia(DESKTOP).matches) setOpen((value) => !value);
  };

  return (
    <header
      ref={root}
      className="obx-nav"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <Link href="/" className="obx-nav__logo" aria-label="Open Boox — trang chủ">
        OB
      </Link>
      <nav className="obx-nav__right" aria-label="Chính">
        <ul id="obx-nav-pills" className="obx-nav__pills" data-open={open} onClick={() => setOpen(false)}>
          <li className="obx-nav__li">
            <Link href="/books" className={PILL}>
              Sách
            </Link>
          </li>
          <li className="obx-nav__li">
            <Link href="/plans" className={PILL}>
              Gói mượn
            </Link>
          </li>
          <li className="obx-nav__li">
            <a href="#cach-hoat-dong" className={PILL}>
              Cách hoạt động
            </a>
          </li>
          {user?.role === 'ADMIN' && (
            <li className="obx-nav__li">
              <Link href="/admin" className={PILL}>
                Quản trị
              </Link>
            </li>
          )}
          {!user && (
            <li className="obx-nav__li">
              <Link href="/login" className={PILL}>
                Đăng nhập
              </Link>
            </li>
          )}
          <li className="obx-nav__li">
            <CartLink />
          </li>
        </ul>
        <button
          type="button"
          className="obx-nav__plus"
          aria-expanded={open}
          aria-controls="obx-nav-pills"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={toggle}
        >
          <span className="obx-nav__plus-h" />
          <span className="obx-nav__plus-v" />
        </button>
        {user ? (
          <Link href="/account" className={`${PILL} obx-btn--dark`}>
            Tài khoản
          </Link>
        ) : (
          <Link href="/register" className={`${PILL} obx-btn--dark`}>
            Đăng ký ↗
          </Link>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Update `app/page.tsx`**

```tsx
import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { loadLanding } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Nav } from './_landing/sections/nav';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadLanding(apiPublic)]);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <Nav user={user} />
      <WordMarquee />
      <CoverMarquee books={data.books} />
    </div>
  );
}
```

- [ ] **Step 5: Append the nav styles to `landing.css`**

```css
/* ---------- 1 · Nav ---------- */

/* Sticky over the first sheet; the negative margin lets the hero sit under it. */
.obx-nav {
  position: sticky;
  top: 12px;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: calc(-56px - var(--obx-gap));
  padding: 0 12px;
  pointer-events: none;
}

.obx-nav > * {
  pointer-events: auto;
}

.obx-nav__logo {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border: 2px solid var(--color-ink);
  border-radius: 50%;
  background: var(--color-paper);
  font: 800 22px/1 var(--font-display);
  transition: all 1s var(--obx-ease-bounce);
}

.obx-nav__logo:hover {
  background: var(--color-ink);
  color: var(--color-paper);
}

.obx-nav__right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.obx-nav__pills {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.obx-nav__plus {
  position: relative;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border: 2px solid var(--color-ink);
  border-radius: 50%;
  background: var(--color-paper);
  cursor: pointer;
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-nav__plus-h,
.obx-nav__plus-v {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 2px;
  background: var(--color-ink);
  translate: -50% -50%;
  transition: scale 0.5s var(--obx-ease-bounce);
}

.obx-nav__plus-v {
  rotate: 90deg;
}

.obx-nav__plus[aria-expanded='true'] {
  rotate: 90deg;
}

.obx-nav__plus[aria-expanded='true'] .obx-nav__plus-h {
  scale: 0 1;
}

@media (max-width: 991px) {
  .obx-nav__pills {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    flex-direction: column;
    align-items: flex-end;
    visibility: hidden;
  }

  .obx-nav__pills[data-open='true'] {
    visibility: visible;
  }
}
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Browser check**

`pnpm dev`, http://localhost:3000 at 1440: hover "+" after scrolling down reveals the pills, moving away hides them again; "Cách hoạt động" does nothing yet (anchor arrives in Task 9). At 375: "+" rotates and its horizontal bar shrinks, pills slide in from the right, Escape closes the menu. Signed in as the seed customer (`/login`), the CTA reads "Tài khoản" and "Đăng nhập" is gone.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/_landing/sections/nav.tsx apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 nav with scroll-aware pills and mobile menu"
```

---

### Task 5: Hero intro and device showcase

**Files:**
- Create: `apps/web/app/_landing/svg/wordmark.tsx`, `apps/web/app/_landing/sections/hero.tsx`, `apps/web/app/_landing/sections/showcase.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: stickers (Task 3), `BookCover`, `gsap`, `useGSAP`, `SplitText`, `FULL`, `REDUCE`, `header.obx-nav` (Task 4).
- Produces: `<Wordmark />`, `<Hero />`, `<Showcase books={BookSummary[]} categories={CategoryDto[]} />`; CSS `.obx-sheet--hero`.

- [ ] **Step 1: Write the failing e2e tests**

Append to `e2e/tests/landing.spec.ts`:

```ts
test('hero has the page heading and shows its tagline after the intro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Open Boox');
  await expect(page.locator('.obx-hero__tagline')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chọn gói mượn ↗' })).toBeVisible();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hero content is visible straight away', async ({ page }) => {
    await page.goto('/');
    // Shorter than the 2s CSS fallback, so this proves nothing was hidden in the first place.
    await expect(page.getByRole('link', { name: 'Chọn gói mượn ↗' })).toBeVisible({ timeout: 500 });
    await expect(page.locator('.obx-nav')).toBeVisible({ timeout: 500 });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: the 2 new tests FAIL (no `h1`, no hero CTA).

- [ ] **Step 3: Create `svg/wordmark.tsx`**

```tsx
const WORDS = ['OPEN', 'BOOX'];

// Split-flap wordmark ([SM §5.1]): each letter is a clipped cell holding an outline layer above a filled layer.
// The hero intro rolls each stack from empty, past the outline, to the filled letter. Decorative; the h1 carries
// the name.
export function Wordmark() {
  return (
    <div className="obx-wordmark" aria-hidden="true">
      {WORDS.map((word) => (
        <span key={word} className="obx-wordmark__word">
          {[...word].map((letter, i) => (
            <span key={i} className="obx-flap">
              <span className="obx-flap__stack">
                <span className="obx-flap__cell obx-flap__cell--outline">{letter}</span>
                <span className="obx-flap__cell">{letter}</span>
              </span>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `sections/hero.tsx`**

```tsx
'use client';

import Link from 'next/link';
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
        const tagline = SplitText.create(q('.obx-hero__tagline'), { type: 'words,chars' });
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
      <p className="obx-heading obx-hero__tagline">Đọc nhiều hơn. Sở hữu ít hơn.</p>
      <p className="obx-body obx-hero__sub" data-load-stagger>
        Mượn sách theo gói, mua khi muốn giữ, và để chúng tôi giao đến tận cửa.
      </p>
      <div className="obx-hero__actions" data-load-stagger>
        <Link href="/plans" className="obx-btn obx-btn--dark">
          Chọn gói mượn ↗
        </Link>
        <Link href="/books" className="obx-btn">
          Xem kho sách
        </Link>
      </div>
      {STICKERS.map(({ Sticker, style }, i) => (
        <span key={i} className="obx-hero__sticker" style={style} data-hero-sticker>
          <Sticker />
        </span>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Create `sections/showcase.tsx`**

```tsx
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
  const shown = books.slice(0, 8);

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
```

- [ ] **Step 6: Update `app/page.tsx`**

Add the imports and the hero sheet right after `<Nav user={user} />`:

```tsx
import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { loadLanding } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Hero } from './_landing/sections/hero';
import { Nav } from './_landing/sections/nav';
import { Showcase } from './_landing/sections/showcase';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadLanding(apiPublic)]);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <Nav user={user} />
      <div className="obx-sheet obx-sheet--sky obx-sheet--hero">
        <Hero />
        <Showcase books={data.books} categories={data.categories} />
      </div>
      <WordMarquee />
      <CoverMarquee books={data.books} />
    </div>
  );
}
```

- [ ] **Step 7: Append the hero and showcase styles to `landing.css`**

```css
/* ---------- 2 · Hero ---------- */

.obx-sheet--hero {
  padding-top: calc(56px + 48px);
}

.obx-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  min-height: calc(100svh - 2 * var(--obx-gap) - 20px - 104px);
  text-align: center;
}

.obx-hero__ribbon {
  position: absolute;
  inset: -8% -12% auto;
  height: 70%;
  pointer-events: none;
}

.obx-hero__ribbon svg {
  width: 100%;
  height: 100%;
}

.obx-wordmark {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: 0.18em;
  font: 800 21vw/0.9 var(--font-display);
  text-transform: uppercase;
}

.obx-wordmark__word {
  display: inline-flex;
}

.obx-flap {
  display: block;
  height: 0.9em;
  overflow: clip;
}

.obx-flap__stack {
  display: flex;
  flex-direction: column;
  transform: translateY(-50%);
}

.obx-flap__cell {
  display: block;
  height: 0.9em;
}

.obx-flap__cell--outline {
  color: transparent;
  -webkit-text-stroke: 0.015em var(--color-ink);
}

@media (max-width: 767px) {
  .obx-wordmark {
    font-size: 38vw;
  }

  .obx-wordmark__word {
    flex-basis: 100%;
    justify-content: center;
  }
}

.obx-hero__tagline,
.obx-hero__sub,
.obx-hero__actions {
  position: relative;
}

.obx-hero__sub {
  max-width: 36ch;
}

.obx-hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.obx-hero__sticker {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

/* Hidden until the intro timeline takes over; visible after 2s if JS never runs. */
@media (prefers-reduced-motion: no-preference) {
  .obx-hero--pending :is(.obx-flap__stack, .obx-hero__tagline, [data-load-stagger], [data-hero-sticker]),
  .obx-home:has(.obx-hero--pending) .obx-nav {
    visibility: hidden;
    animation: obx-intro-fallback 0s 2s forwards;
  }
}

@keyframes obx-intro-fallback {
  to {
    visibility: visible;
  }
}

/* ---------- 3 · Showcase ---------- */

.obx-showcase {
  display: grid;
  justify-items: center;
  gap: 64px;
  padding-top: 112px;
}

.obx-showcase__title {
  max-width: 16ch;
  text-align: center;
}

.obx-phone-wrap {
  width: min(340px, 78vw);
}

.obx-phone {
  aspect-ratio: 9 / 19;
  padding: 14px;
  overflow: clip;
  border: 2px solid var(--color-ink);
  border-radius: 44px;
  background: var(--color-paper);
}

.obx-phone__screen {
  height: 100%;
  overflow: clip;
  border-radius: 32px;
  background: var(--color-sky);
}

.obx-phone__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 10px;
}

.obx-showcase__pairs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  width: 100%;
  max-width: 1100px;
}

.obx-pair {
  display: flex;
  align-items: center;
  gap: 24px;
}

.obx-pair__title {
  margin-bottom: 8px;
  font-size: 24px;
  font-weight: 700;
}

.obx-mini {
  display: flex;
  flex: 0 0 180px;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--color-ink);
  border-radius: 20px;
  background: var(--color-paper);
}

.obx-mini__chip,
.obx-mini__step {
  padding: 6px 10px;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.obx-mini__chip:nth-child(odd) { background: var(--color-sunburst); }
.obx-mini__chip:nth-child(even) { background: var(--color-lilac); }
.obx-mini__step--done { background: var(--color-mint); }
.obx-mini__step--now { background: var(--color-ink); color: var(--color-paper); }

@media (max-width: 767px) {
  .obx-showcase__pairs {
    grid-template-columns: 1fr;
  }

  .obx-pair {
    flex-direction: column;
    text-align: center;
  }
}
```

- [ ] **Step 8: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 7 tests.

- [ ] **Step 9: Browser check**

`pnpm dev`, http://localhost:3000 at 1440 and 375:
- Intro order: wordmark letters roll left to right past the outline into filled letters; tagline chars come in from the last char; sub and buttons rise at +0.5s with stickers popping in random order and wobbling once; nav slides down last. Nothing flashes before the intro.
- Wordmark letters are not clipped at the top or bottom (adjust `.obx-flap` height in 0.05em steps if they are, at both sizes).
- The ribbon drifts up as you scroll; the phone scales in when its top reaches the middle of the screen; covers scroll inside the screen.
- At 375 the wordmark breaks into OPEN / BOOX and there is no horizontal scroll.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/_landing apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 hero intro with split-flap wordmark and device showcase"
```

---

### Task 6: Features, statement and plans

**Files:**
- Create: `apps/web/app/_landing/svg/illustrations.tsx`, `apps/web/app/_landing/sections/features.tsx`, `apps/web/app/_landing/sections/statement.tsx`, `apps/web/app/_landing/sections/plans.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `pickFeaturedBook`, `cycleColor` (Task 1); `data-anim-slant`, `data-heading-reveal` + `data-line`, `data-card-reveal` hooks (Task 2); stickers (Task 3); `formatVnd`; `isOptimizedCoverHost` (`@/lib/books/cover`).
- Produces: `ArtStack`, `ArtCalendar`, `ArtSwap`, `ArtBorrow`, `ArtBuy`, `ArtDeliver`, each `(props: { className?: string }) => JSX.Element` (Task 8 uses the last three); `<Features plans />`, `<Statement book />`, `<Plans plans />`.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/tests/landing.spec.ts`:

```ts
test.describe('reduced motion scroll reveals', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every revealed heading ends fully visible', async ({ page }) => {
    await page.goto('/');
    const headings = page.locator('[data-anim-slant], [data-heading-reveal]');
    expect(await headings.count()).toBeGreaterThan(0);
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toHaveCSS('opacity', '1');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: the new test FAILS on `toBeGreaterThan(0)` (no reveal hooks on the page yet).

- [ ] **Step 3: Create `svg/illustrations.tsx`**

```tsx
import type { ReactNode } from 'react';

type ArtProps = { className?: string };

function Art({ children, className = '' }: ArtProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={`obx-art ${className}`}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="#000"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// Giữ nhiều cuốn cùng lúc
export function ArtStack(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="70" y="160" width="180" height="40" rx="8" fill="#ffd731" />
      <rect x="86" y="120" width="160" height="40" rx="8" fill="#fb4903" />
      <rect x="60" y="80" width="170" height="40" rx="8" fill="#55db9c" />
      <rect x="96" y="40" width="130" height="40" rx="8" fill="#fff" />
      <path d="M90 80v40M112 120v40M96 160v40M120 40v40" />
    </Art>
  );
}

// Không hạn trả
export function ArtCalendar(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="80" y="50" width="160" height="150" rx="16" fill="#fff" />
      <path d="M80 92h160M118 34v32M202 34v32" />
      <path d="M130 146c0-16 22-16 30 0s30 16 30 0-22-16-30 0-30 16-30 0z" strokeWidth={7} />
    </Art>
  );
}

// Đổi gói tức thì
export function ArtSwap(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="50" y="64" width="96" height="124" rx="14" fill="#e9ccff" />
      <rect x="174" y="52" width="96" height="124" rx="14" fill="#55db9c" />
      <path d="M118 214c44 18 96 10 124-28M242 186v-26M242 186h-26" />
      <path d="M202 30c-44-18-96-10-124 28M78 58v26M78 58h26" />
    </Art>
  );
}

// Tab "Mượn"
export function ArtBorrow(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="96" y="40" width="110" height="150" rx="10" fill="#ffd731" />
      <path d="M116 40v150" />
      <path d="M236 92c34 18 34 62 0 80M236 172h22M236 172v-22" strokeWidth={6} />
    </Art>
  );
}

// Tab "Mua"
export function ArtBuy(props: ArtProps) {
  return (
    <Art {...props}>
      <path d="M86 92h148l-12 116H98z" fill="#fff" />
      <path d="M126 92V76a34 34 0 0 1 68 0v16" />
      <rect x="128" y="120" width="64" height="62" rx="6" fill="#fb4903" />
      <path d="M142 120v62" />
    </Art>
  );
}

// Tab "Giao"
export function ArtDeliver(props: ArtProps) {
  return (
    <Art {...props}>
      <path d="M60 84h130v96H60z" fill="#4da2ff" />
      <path d="M190 112h44l26 32v36h-70z" fill="#fff" />
      <circle cx="98" cy="186" r="16" fill="#fff" />
      <circle cx="226" cy="186" r="16" fill="#fff" />
      <path d="M90 84v32h40V84" />
    </Art>
  );
}
```

- [ ] **Step 4: Create `sections/features.tsx`**

```tsx
import type { PlanDto } from '@open-boox/shared';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArtCalendar, ArtStack, ArtSwap } from '../svg/illustrations';

type Feature = { line1: string; line2: string; body: string; tone: string; Art: ComponentType<{ className?: string }> };

function features(plans: PlanDto[]): Feature[] {
  const counts = plans.map((p) => p.maxBooks);
  const range = counts.length ? `${Math.min(...counts)}–${Math.max(...counts)}` : 'nhiều';
  return [
    {
      line1: 'Giữ nhiều cuốn',
      line2: 'cùng lúc',
      body: `Mỗi gói cho giữ ${range} cuốn cùng lúc. Đọc xong cuốn nào thì trả cuốn đó.`,
      tone: 'lilac',
      Art: ArtStack,
    },
    {
      line1: 'Không hạn trả',
      line2: 'đọc thong thả',
      body: 'Không có ngày phải trả. Cuốn sách ở với bạn tới khi bạn muốn đổi.',
      tone: 'blue',
      Art: ArtCalendar,
    },
    {
      line1: 'Đổi gói',
      line2: 'tức thì',
      body: 'Nâng cấp có hiệu lực ngay. Hạ gói hay huỷ gia hạn thì áp dụng từ kỳ sau.',
      tone: 'sunburst',
      Art: ArtSwap,
    },
  ];
}

// Section 4: zig-zag rows; char reveal on the heading, 3D reveal on the card ([SM §5.6], [SM §5.8]).
export function Features({ plans }: { plans: PlanDto[] }) {
  return (
    <section className="obx-sheet obx-features" aria-label="Vì sao Open Boox">
      {features(plans).map(({ line1, line2, body, tone, Art }, i) => (
        <article key={line1} className={`obx-feature${i % 2 ? ' obx-feature--flip' : ''}`}>
          <div className="obx-feature__text">
            <h2 className="obx-display obx-feature__title" data-anim-slant>
              {line1}
              <br />
              <em>{line2}</em>
            </h2>
            <p className="obx-body">{body}</p>
            <Link href="/plans" className="obx-btn obx-btn--dark">
              Xem các gói ↗
            </Link>
          </div>
          <div className="obx-feature__visual" data-card-reveal="wrap">
            <div className={`obx-card obx-card--${tone}`} data-card-reveal="card">
              <Art />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Create `sections/statement.tsx`**

```tsx
import type { BookSummary } from '@open-boox/shared';
import Image from 'next/image';
import Link from 'next/link';
import { isOptimizedCoverHost } from '@/lib/books/cover';
import { StickerBook } from '../svg/stickers';

// Section 5: three display lines with a featured book card set inline between words ([SM §4 #5], [SM §5.7]).
// Only phrasing content inside the h2: the card is a link around an <img> and spans.
export function Statement({ book }: { book: BookSummary | null }) {
  return (
    <section className="obx-sheet obx-statement">
      <h2 className="obx-display obx-statement__text" data-heading-reveal>
        <span className="obx-statement__line" data-line>
          Mọi cuốn sách
        </span>
        <span className="obx-statement__line" data-line>
          Giao{' '}
          {book?.coverUrl ? (
            <Link href={`/books/${book.slug}`} className="obx-featured" data-cursor="Xem sách">
              <Image
                src={book.coverUrl}
                alt={`Bìa sách ${book.title}`}
                width={120}
                height={180}
                className="obx-featured__cover"
                unoptimized={!isOptimizedCoverHost(book.coverUrl)}
              />
              <span className="obx-featured__meta">
                <span className="obx-featured__title">{book.title}</span>
                <span>{book.author}</span>
              </span>
            </Link>
          ) : (
            <span className="obx-featured" aria-hidden="true">
              <StickerBook className="obx-featured__sticker" />
            </span>
          )}{' '}
          tận cửa
        </span>
      </h2>
    </section>
  );
}
```

- [ ] **Step 6: Create `sections/plans.tsx`**

```tsx
import type { PlanDto } from '@open-boox/shared';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import { cycleColor } from '../data';
import { StickerBook, StickerCoin, StickerStar } from '../svg/stickers';

const PLAN_PALETTE = ['#ffd731', '#e9ccff', '#4da2ff'];
const PLAN_STICKERS = [StickerBook, StickerCoin, StickerStar];

// Section 10: the three plans in place of Slush's persona cards.
export function Plans({ plans }: { plans: PlanDto[] }) {
  return (
    <section className="obx-sheet obx-plans" aria-labelledby="obx-plans-title">
      <h2 id="obx-plans-title" className="obx-display obx-plans__title" data-anim-slant>
        Một gói,
        <br />
        <em>cả thư viện</em>
      </h2>
      <div className="obx-plans__grid" data-card-reveal="wrap">
        {plans.map((plan, i) => {
          const Sticker = PLAN_STICKERS[i % PLAN_STICKERS.length];
          return (
            <article
              key={plan.code}
              className="obx-plan"
              style={{ background: cycleColor(i, PLAN_PALETTE) }}
              data-card-reveal="card"
            >
              <h3 className="obx-plan__name">{plan.name}</h3>
              <p className="obx-display obx-plan__books">
                {plan.maxBooks} cuốn
                <br />
                <em>cùng lúc</em>
              </p>
              <p className="obx-plan__price">
                {formatVnd(plan.monthlyPrice)} <span>/ 30 ngày</span>
              </p>
              <Link href="/plans" className="obx-btn obx-btn--dark obx-btn--sm">
                Chọn {plan.name} ↗
              </Link>
              <Sticker className="obx-plan__sticker" />
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Update `app/page.tsx`**

```tsx
import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { loadLanding, pickFeaturedBook } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Features } from './_landing/sections/features';
import { Hero } from './_landing/sections/hero';
import { Nav } from './_landing/sections/nav';
import { Plans } from './_landing/sections/plans';
import { Showcase } from './_landing/sections/showcase';
import { Statement } from './_landing/sections/statement';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadLanding(apiPublic)]);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <Nav user={user} />
      <div className="obx-sheet obx-sheet--sky obx-sheet--hero">
        <Hero />
        <Showcase books={data.books} categories={data.categories} />
      </div>
      <Features plans={data.plans} />
      <Statement book={pickFeaturedBook(data.books)} />
      <WordMarquee />
      <Plans plans={data.plans} />
      <CoverMarquee books={data.books} />
    </div>
  );
}
```

- [ ] **Step 8: Append the styles to `landing.css`**

```css
/* ---------- 4 · Features ---------- */

.obx-features {
  display: flex;
  flex-direction: column;
  gap: clamp(64px, 8vw, 128px);
}

.obx-feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: clamp(24px, 4vw, 64px);
}

.obx-feature--flip .obx-feature__visual {
  order: -1;
}

.obx-feature__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}

.obx-feature__title {
  font-size: clamp(64px, 9vw, 160px);
}

.obx-card {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  padding: 24px;
  border: 1px solid var(--color-ink);
  border-radius: 20px;
}

.obx-card--lilac { background: var(--color-lilac); }
.obx-card--blue { background: var(--color-blue); }
.obx-card--sunburst { background: var(--color-sunburst); }

.obx-art {
  width: 100%;
  height: auto;
}

@media (max-width: 767px) {
  .obx-feature {
    grid-template-columns: 1fr;
  }

  .obx-feature__visual {
    order: -1;
  }
}

/* ---------- 5 · Statement ---------- */

.obx-statement__text {
  font-size: clamp(56px, 11.1vw, 160px);
  text-align: center;
}

.obx-statement__line {
  display: block;
}

.obx-featured {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  height: 0.8em;
  margin: 0 0.05em;
  padding: 0.06em 0.12em 0.06em 0.06em;
  vertical-align: middle;
  border: 1px solid var(--color-ink);
  border-radius: 20px;
  background: var(--color-indigo);
  color: var(--color-paper);
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-featured:hover {
  rotate: -3deg;
}

.obx-featured__cover {
  width: auto;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
}

.obx-featured__sticker {
  width: auto;
  height: 100%;
}

.obx-featured__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 14ch;
  font: 500 16px/1.2 var(--font-sans);
  text-align: left;
  text-transform: none;
}

.obx-featured__title {
  font-weight: 700;
}

@media (max-width: 767px) {
  .obx-featured__meta {
    display: none;
  }
}

/* ---------- 10 · Plans ---------- */

.obx-plans {
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.obx-plans__title {
  font-size: clamp(56px, 11.1vw, 160px);
}

.obx-plans__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.obx-plan {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  min-height: 420px;
  padding: 28px;
  overflow: clip;
  border: 1px solid var(--color-ink);
  border-radius: 30px;
}

.obx-plan__name {
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.obx-plan__books {
  font-size: clamp(56px, 6vw, 96px);
}

.obx-plan__price {
  margin-top: auto;
  font-size: 24px;
  font-weight: 700;
}

.obx-plan__price span {
  font-size: 16px;
  font-weight: 500;
}

.obx-plan__sticker {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 72px;
  rotate: 10deg;
}

@media (max-width: 991px) {
  .obx-plans__grid {
    grid-template-columns: 1fr;
  }

  .obx-plan {
    min-height: 320px;
  }
}
```

- [ ] **Step 9: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 10: Browser check**

`pnpm dev`, http://localhost:3000:
- Feature headings slant in from the last char at 80% viewport; cards swing in in 3D; rows alternate sides; at 375 the card sits above the text.
- Statement lines rotate in one after another; the indigo card sits between "Giao" and "tận cửa" at line height and links to the book.
- Plan cards swing in; prices match `/plans`.
- Vietnamese diacritics are intact in the 160px headings (e.g. "KHÔNG HẠN TRẢ", "TỨC THÌ"), no clipped accents.

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/_landing apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 features, inline-card statement and plan cards"
```

---

### Task 7: Category carousel

**Files:**
- Create: `apps/web/app/_landing/ui/horizontal-loop.ts`, `apps/web/app/_landing/sections/category-carousel.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `cycleColor`, stickers, `gsap`, `Draggable`, `ScrollTrigger`, `useGSAP`, `FULL`, `REDUCE`.
- Produces: `horizontalLoop(items: HTMLElement[], config?: LoopConfig): HorizontalLoop` where `LoopConfig = { paused?: boolean; center?: boolean; draggable?: boolean; onChange?: (el: HTMLElement, index: number) => void }` and `HorizontalLoop` is a `gsap.core.Timeline` with `toIndex(i, vars?)`, `next(vars?)`, `previous(vars?)`, `current(): number`, `closestIndex(setCurrent?): number`, `destroy(): void`; `<CategoryCarousel categories />`.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/tests/landing.spec.ts`:

```ts
test('category dots select a slide', async ({ page }) => {
  await page.goto('/');
  const dots = page.getByRole('tablist', { name: 'Chọn thể loại' }).getByRole('tab');
  await dots.nth(2).scrollIntoViewIfNeeded();
  await dots.nth(2).click();
  await expect(dots.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Thể loại trước' }).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: FAIL, no tablist "Chọn thể loại".

- [ ] **Step 3: Create `ui/horizontal-loop.ts`**

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
// Seamless, centered, draggable loop. Port of GSAP's official helper
// https://gsap.com/docs/v3/HelperFunctions/helpers/seamlessLoop (horizontalLoop), trimmed to the options the
// category carousel uses and with destroy() so React can unmount it. Logic kept as upstream on purpose.
import { Draggable, gsap } from '../motion/gsap';

export interface LoopConfig {
  paused?: boolean;
  center?: boolean;
  draggable?: boolean;
  onChange?: (el: HTMLElement, index: number) => void;
}

export interface HorizontalLoop extends gsap.core.Timeline {
  toIndex(index: number, vars?: gsap.TweenVars): any;
  next(vars?: gsap.TweenVars): any;
  previous(vars?: gsap.TweenVars): any;
  current(): number;
  closestIndex(setCurrent?: boolean): number;
  destroy(): void;
}

export function horizontalLoop(items: HTMLElement[], config: LoopConfig = {}): HorizontalLoop {
  const length = items.length;
  const container = items[0].parentNode as HTMLElement;
  const startX = items[0].offsetLeft;
  const times: number[] = [];
  const widths: number[] = [];
  const spaceBefore: number[] = [];
  const xPercents: number[] = [];
  const pixelsPerSecond = 100;
  const snap = gsap.utils.snap(1);
  let lastIndex = 0;
  let curIndex = 0;
  let indexIsDirty = false;
  let totalWidth = 0;
  let timeOffset = 0;
  let timeWrap: (value: number) => number = (value) => value;
  let draggable: Draggable | null = null;
  const proxy = document.createElement('div');

  const tl = gsap.timeline({
    paused: config.paused,
    defaults: { ease: 'none' },
    onUpdate: () => {
      if (!config.onChange) return;
      const i = tl.closestIndex();
      if (lastIndex !== i) {
        lastIndex = i;
        config.onChange(items[i], i);
      }
    },
    onReverseComplete: () => {
      tl.totalTime(tl.rawTime() + tl.duration() * 100);
    },
  }) as HorizontalLoop;

  const scaleX = (el: HTMLElement) => Number(gsap.getProperty(el, 'scaleX'));
  const getTotalWidth = () =>
    items[length - 1].offsetLeft +
    (xPercents[length - 1] / 100) * widths[length - 1] -
    startX +
    spaceBefore[0] +
    items[length - 1].offsetWidth * scaleX(items[length - 1]);

  const populateWidths = () => {
    let b1 = container.getBoundingClientRect();
    items.forEach((el, i) => {
      widths[i] = parseFloat(String(gsap.getProperty(el, 'width', 'px')));
      xPercents[i] = snap(
        (parseFloat(String(gsap.getProperty(el, 'x', 'px'))) / widths[i]) * 100 + Number(gsap.getProperty(el, 'xPercent')),
      );
      const b2 = el.getBoundingClientRect();
      spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
      b1 = b2;
    });
    gsap.set(items, { xPercent: (i: number) => xPercents[i] });
    totalWidth = getTotalWidth();
  };

  const populateOffsets = () => {
    timeOffset = config.center ? (tl.duration() * (container.offsetWidth / 2)) / totalWidth : 0;
    if (config.center) {
      times.forEach((_, i) => {
        times[i] = timeWrap(tl.labels['label' + i] + (tl.duration() * widths[i]) / 2 / totalWidth - timeOffset);
      });
    }
  };

  const getClosest = (values: number[], value: number, wrap: number) => {
    let closest = 1e10;
    let index = 0;
    values.forEach((v, i) => {
      let d = Math.abs(v - value);
      if (d > wrap / 2) d = wrap - d;
      if (d < closest) {
        closest = d;
        index = i;
      }
    });
    return index;
  };

  const populateTimeline = () => {
    tl.clear();
    items.forEach((item, i) => {
      const curX = (xPercents[i] / 100) * widths[i];
      const distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
      const distanceToLoop = distanceToStart + widths[i] * scaleX(item);
      tl.to(
        item,
        { xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100), duration: distanceToLoop / pixelsPerSecond },
        0,
      )
        .fromTo(
          item,
          { xPercent: snap(((curX - distanceToLoop + totalWidth) / widths[i]) * 100) },
          {
            xPercent: xPercents[i],
            duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
            immediateRender: false,
          },
          distanceToLoop / pixelsPerSecond,
        )
        .add('label' + i, distanceToStart / pixelsPerSecond);
      times[i] = distanceToStart / pixelsPerSecond;
    });
    timeWrap = gsap.utils.wrap(0, tl.duration());
  };

  const refresh = (deep?: boolean) => {
    const progress = tl.progress();
    tl.progress(0, true);
    populateWidths();
    if (deep) populateTimeline();
    populateOffsets();
    if (deep && draggable) tl.time(times[curIndex], true);
    else tl.progress(progress, true);
  };
  const onResize = () => refresh(true);

  gsap.set(items, { x: 0 });
  populateWidths();
  populateTimeline();
  populateOffsets();
  window.addEventListener('resize', onResize);

  const toIndex = (index: number, vars: gsap.TweenVars = {}) => {
    if (Math.abs(index - curIndex) > length / 2) index += index > curIndex ? -length : length;
    const newIndex = gsap.utils.wrap(0, length, index);
    let time = times[newIndex];
    if (time > tl.time() !== index > curIndex && index !== curIndex) {
      time += tl.duration() * (index > curIndex ? 1 : -1);
    }
    if (time < 0 || time > tl.duration()) vars.modifiers = { time: timeWrap };
    curIndex = newIndex;
    vars.overwrite = true;
    gsap.killTweensOf(proxy);
    return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
  };

  tl.toIndex = toIndex;
  tl.closestIndex = (setCurrent?: boolean) => {
    const index = getClosest(times, tl.time(), tl.duration());
    if (setCurrent) {
      curIndex = index;
      indexIsDirty = false;
    }
    return index;
  };
  tl.current = () => (indexIsDirty ? tl.closestIndex(true) : curIndex);
  tl.next = (vars) => toIndex(tl.current() + 1, vars);
  tl.previous = (vars) => toIndex(tl.current() - 1, vars);
  tl.progress(1, true).progress(0, true);

  if (config.draggable) {
    const wrap = gsap.utils.wrap(0, 1);
    let ratio = 0;
    let startProgress = 0;
    let lastSnap = 0;
    let initChangeX = 0;
    const align = () => tl.progress(wrap(startProgress + (draggable!.startX - draggable!.x) * ratio));
    const syncIndex = () => tl.closestIndex(true);
    draggable = Draggable.create(proxy, {
      trigger: container,
      type: 'x',
      inertia: true,
      overshootTolerance: 0,
      onPressInit() {
        const x = draggable!.x;
        gsap.killTweensOf(tl);
        tl.pause();
        startProgress = tl.progress();
        refresh();
        ratio = 1 / totalWidth;
        initChangeX = startProgress / -ratio - x;
        gsap.set(proxy, { x: startProgress / -ratio });
      },
      onDrag: align,
      onThrowUpdate: align,
      snap(value: number) {
        if (Math.abs(startProgress / -ratio - draggable!.x) < 10) return lastSnap + initChangeX;
        const time = -(value * ratio) * tl.duration();
        const wrappedTime = timeWrap(time);
        const snapTime = times[getClosest(times, wrappedTime, tl.duration())];
        let dif = snapTime - wrappedTime;
        if (Math.abs(dif) > tl.duration() / 2) dif += dif < 0 ? tl.duration() : -tl.duration();
        lastSnap = (time + dif) / tl.duration() / -ratio;
        return lastSnap;
      },
      onRelease() {
        syncIndex();
        if (draggable!.isThrowing) indexIsDirty = true;
      },
      onThrowComplete: syncIndex,
    })[0];
  }

  tl.closestIndex(true);
  lastIndex = curIndex;
  config.onChange?.(items[curIndex], curIndex);

  tl.destroy = () => {
    window.removeEventListener('resize', onResize);
    draggable?.kill();
    tl.kill();
  };
  return tl;
}
```

- [ ] **Step 4: Create `sections/category-carousel.tsx`**

```tsx
'use client';

import type { CategoryDto } from '@open-boox/shared';
import Link from 'next/link';
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
        const tick = gsap.delayedCall(4, () => {
          if (onScreen && !hovering) carousel.next({ duration: 0.725, ease: 'slush-bounce' });
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
        root.current!.addEventListener('pointerenter', enter);
        root.current!.addEventListener('pointerleave', leave);
        return () => {
          root.current?.removeEventListener('pointerenter', enter);
          root.current?.removeEventListener('pointerleave', leave);
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
          <br />
          <em>cũng có</em>
        </h2>
        <Link href="/books" className="obx-btn">
          Xem tất cả sách
        </Link>
      </div>
      <div className="obx-cats__viewport">
        <div className="obx-cats__track">
          {categories.map((category, i) => {
            const Sticker = STICKERS[i % STICKERS.length];
            return (
              <Link
                key={category.id}
                id={`obx-cat-${i}`}
                href={`/books?category=${category.slug}`}
                className={`obx-cat${i === active ? ' is-active' : ''}`}
                style={{ background: cycleColor(i) }}
                data-cursor="Kéo"
                draggable={false}
                onPointerDown={(event) => {
                  pressX.current = event.clientX;
                }}
                onClick={(event) => {
                  if (Math.abs(event.clientX - pressX.current) > 5) event.preventDefault();
                }}
              >
                <Sticker className="obx-cat__sticker" />
                <span className="obx-display obx-italic obx-cat__name">{category.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="obx-cats__controls">
        <button type="button" className="obx-round" aria-label="Thể loại trước" onClick={() => go(active - 1)}>
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
              aria-selected={i === active}
              aria-controls={`obx-cat-${i}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="obx-round" aria-label="Thể loại tiếp" onClick={() => go(active + 1)}>
          →
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Update `app/page.tsx`**

Add `import { CategoryCarousel } from './_landing/sections/category-carousel';` (keep imports alphabetical) and render `<CategoryCarousel categories={data.categories} />` between `<Statement … />` and `<WordMarquee />`.

- [ ] **Step 6: Append the carousel styles to `landing.css`**

```css
/* ---------- 6 · Category carousel ---------- */

.obx-cats {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.obx-cats__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.obx-cats__title {
  font-size: clamp(56px, 11.1vw, 160px);
}

.obx-cats__viewport {
  margin-inline: calc(-1 * var(--obx-pad));
  overflow: clip;
}

.obx-cats__track {
  display: flex;
  touch-action: pan-y;
}

.obx-cat {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  width: min(340px, 72vw);
  aspect-ratio: 3 / 4;
  margin-right: 16px;
  padding: 24px;
  border: 1px solid var(--color-ink);
  border-radius: 30px;
  user-select: none;
}

.obx-cat__name {
  font-size: clamp(44px, 5vw, 72px);
}

.obx-cat__sticker {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 96px;
  rotate: 8deg;
}

.obx-cats__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.obx-cats__dots {
  display: flex;
}

.obx-dot {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.obx-dot::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c4c4c4;
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-dot[aria-selected='true']::before {
  background: var(--color-ink);
  scale: 1.3;
}
```

- [ ] **Step 7: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Browser check**

`pnpm dev`, http://localhost:3000:
- The active category sits in the middle; every 4s it moves one slide with a bounce; hovering stops it; scrolling it off screen stops it.
- Drag with the mouse and flick: it keeps moving with inertia and snaps to a slide; letting go after a drag does not open the category; a plain click opens `/books?category=…`.
- Dots and arrows stay in sync after dragging. The cursor pill reads "KÉO" over slides.
- At 375 the slides still loop without blank gaps.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/_landing apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 draggable category carousel with autoplay"
```

---

### Task 8: Tabs

**Files:**
- Create: `apps/web/app/_landing/sections/tabs.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `ArtBorrow`, `ArtBuy`, `ArtDeliver` (Task 6); `gsap`, `Flip`, `SplitText`, `ScrollTrigger`, `useGSAP`, `FULL`, `REDUCE`.
- Produces: `<Tabs />`.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/tests/landing.spec.ts`:

```ts
test('tabs follow the arrow keys', async ({ page }) => {
  await page.goto('/');
  const tablist = page.getByRole('tablist', { name: 'Cách dùng Open Boox' });
  await tablist.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // the one-time auto-advance has fired by now
  await tablist.getByRole('tab', { name: 'Mượn' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(tablist.getByRole('tab', { name: 'Mua' })).toHaveAttribute('aria-selected', 'true');
  await expect(tablist.getByRole('tab', { name: 'Mua' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(tablist.getByRole('tab', { name: 'Giao' })).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: FAIL, no tablist "Cách dùng Open Boox".

- [ ] **Step 3: Create `sections/tabs.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { type KeyboardEvent, useRef, useState } from 'react';
import { FULL, Flip, REDUCE, ScrollTrigger, SplitText, gsap, useGSAP } from '../motion/gsap';
import { ArtBorrow, ArtBuy, ArtDeliver } from '../svg/illustrations';

const TABS = [
  {
    id: 'muon',
    label: 'Mượn',
    title: ['Mượn theo gói', 'trả khi xong'],
    body: 'Chọn gói, thêm sách vào giỏ mượn rồi xác nhận. Giữ tối đa số cuốn của gói, không hạn trả.',
    href: '/plans',
    link: 'Xem các gói',
    color: '#e9ccff',
    Art: ArtBorrow,
  },
  {
    id: 'mua',
    label: 'Mua',
    title: ['Mua đứt', 'giữ trên kệ'],
    body: 'Thích cuốn nào thì mua luôn. Thanh toán một lần, sách là của bạn.',
    href: '/books',
    link: 'Vào kho sách',
    color: '#ffd731',
    Art: ArtBuy,
  },
  {
    id: 'giao',
    label: 'Giao',
    title: ['Giao tận cửa', 'lấy tận nhà'],
    body: 'Đơn mua và sách mượn đều được giao tận nơi. Khi trả, chúng tôi đến tận nhà lấy lại.',
    href: '/account/orders',
    link: 'Theo dõi đơn',
    color: '#55db9c',
    Art: ArtDeliver,
  },
];

// Section 8 ([SM §5.11]): the black pill follows the active tab with Flip; the old panel fades out while the new
// one's title chars, text and art come in from 0.2s. Panels share one grid cell, so no height tween. Auto-advances
// to the second tab once when scrolled into view.
export function Tabs() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const previous = useRef(0);
  const flipState = useRef<Flip.FlipState | null>(null);
  const splits = useRef<SplitText[]>([]);
  const running = useRef<gsap.core.Timeline | null>(null);

  const select = (index: number) => {
    if (index === activeRef.current) return;
    flipState.current = Flip.getState(root.current!.querySelector('.obx-tabs__pill'));
    activeRef.current = index;
    setActive(index);
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        splits.current = gsap.utils
          .toArray<HTMLElement>('.obx-tab-panel__title', root.current)
          .map((el) => SplitText.create(el, { type: 'words,chars' }));
        ScrollTrigger.create({
          trigger: root.current,
          start: 'center 75%',
          once: true,
          onEnter: () => {
            if (activeRef.current === 0) select(1);
          },
        });
        return () => {
          splits.current = [];
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      const from = previous.current;
      previous.current = active;
      const state = flipState.current;
      flipState.current = null;
      if (from === active || window.matchMedia(REDUCE).matches) return;

      running.current?.progress(1);
      const panels = gsap.utils.toArray<HTMLElement>('.obx-tab-panel', root.current);
      const oldPanel = panels[from];
      const newPanel = panels[active];
      const find = (panel: HTMLElement, selector: string) => panel.querySelector<HTMLElement>(selector)!;

      if (state) {
        Flip.from(state, { targets: root.current!.querySelector('.obx-tabs__pill'), duration: 0.5, ease: 'slush' });
      }

      const tl = gsap.timeline({ defaults: { ease: 'slush', duration: 0.65 } });
      tl.set(oldPanel, { visibility: 'visible' }, 0)
        .to(find(oldPanel, '.obx-tab-panel__text'), { autoAlpha: 0, yPercent: 10 }, 0)
        .to(find(oldPanel, '.obx-tab-panel__art'), { autoAlpha: 0, xPercent: -15 }, 0)
        .fromTo(
          find(newPanel, '.obx-tab-panel__visual'),
          { backgroundColor: TABS[from].color },
          { backgroundColor: TABS[active].color },
          0,
        )
        .set(find(newPanel, '.obx-tab-panel__text'), { autoAlpha: 0, yPercent: 0 }, 0)
        .set(find(newPanel, '.obx-tab-panel__text'), { autoAlpha: 1 }, 0.2)
        .fromTo(
          splits.current[active]?.chars ?? [],
          { x: '-0.25em', autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: 'slush-bounce', stagger: { each: 0.015, from: 'end' } },
          0.2,
        )
        .fromTo(
          newPanel.querySelectorAll('.obx-tab-panel__body, .obx-tab-panel__link'),
          { x: '-3em', autoAlpha: 0 },
          { x: 0, autoAlpha: 1 },
          0.275,
        )
        .fromTo(find(newPanel, '.obx-tab-panel__art'), { yPercent: 10, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1 }, 0.2)
        .set(oldPanel, { clearProps: 'visibility' });
      running.current = tl;
    },
    { dependencies: [active], scope: root },
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
    const next = (activeRef.current + step) % TABS.length;
    select(next);
    root.current?.querySelector<HTMLButtonElement>(`#obx-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <section ref={root} className="obx-sheet obx-tabs" aria-labelledby="obx-tabs-title">
      <h2 id="obx-tabs-title" className="sr-only">
        Mượn, mua hay giao
      </h2>
      <div role="tablist" aria-label="Cách dùng Open Boox" className="obx-tabs__list" onKeyDown={onKeyDown}>
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            id={`obx-tab-${tab.id}`}
            type="button"
            role="tab"
            className="obx-tabs__tab"
            aria-selected={i === active}
            aria-controls={`obx-panel-${tab.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') select(i);
            }}
          >
            {i === active && <span className="obx-tabs__pill" data-flip-id="tab-pill" aria-hidden="true" />}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="obx-tabs__panels">
        {TABS.map((tab, i) => (
          <div
            key={tab.id}
            id={`obx-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`obx-tab-${tab.id}`}
            className="obx-tab-panel"
            data-active={i === active}
            inert={i !== active}
          >
            <div className="obx-tab-panel__visual" style={{ backgroundColor: tab.color }}>
              <tab.Art className="obx-tab-panel__art" />
            </div>
            <div className="obx-tab-panel__text">
              <h3 className="obx-display obx-tab-panel__title">
                {tab.title[0]}
                <br />
                <em>{tab.title[1]}</em>
              </h3>
              <p className="obx-body obx-tab-panel__body">{tab.body}</p>
              <Link href={tab.href} className="obx-btn obx-btn--dark obx-tab-panel__link">
                {tab.link} ↗
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Update `app/page.tsx`**

Add `import { Tabs } from './_landing/sections/tabs';` and render `<Tabs />` right after `<WordMarquee />`.

- [ ] **Step 5: Append the tab styles to `landing.css`**

```css
/* ---------- 8 · Tabs ---------- */

.obx-tabs {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.obx-tabs__list {
  display: inline-flex;
  align-self: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-ink);
  border-radius: 999px;
  background: var(--color-paper);
}

.obx-tabs__tab {
  position: relative;
  z-index: 0;
  padding: 14px 28px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--color-ink);
  font: 500 16px/1 var(--font-sans);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
}

.obx-tabs__tab[aria-selected='true'] {
  color: var(--color-paper);
}

.obx-tabs__pill {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 999px;
  background: var(--color-ink);
}

.obx-tabs__panels {
  display: grid;
}

.obx-tab-panel {
  grid-area: 1 / 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: clamp(24px, 4vw, 64px);
}

.obx-tab-panel[data-active='false'] {
  visibility: hidden;
}

.obx-tab-panel__visual {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  padding: 24px;
  overflow: clip;
  border: 1px solid var(--color-ink);
  border-radius: 30px;
}

.obx-tab-panel__text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}

.obx-tab-panel__title {
  font-size: clamp(56px, 8vw, 128px);
}

@media (max-width: 767px) {
  .obx-tab-panel {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 7: Browser check**

`pnpm dev`, http://localhost:3000:
- Scrolling the tabs into view switches once to "Mua". The black pill glides to the hovered/clicked tab; the visual background blends lilac → yellow → mint; the title chars come in from the last char; text and link slide in from the left; the art rises.
- Moving the mouse quickly across all three tabs leaves exactly one panel visible and no half-faded text.
- Tab only reaches the active tab; ←/→ move selection and focus.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/_landing/sections/tabs.tsx apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 borrow/buy/deliver tabs with Flip pill"
```

---

### Task 9: How it works (stacking drag)

**Files:**
- Create: `apps/web/app/_landing/sections/how-it-works.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `howItWorksCards`, `HowCard` (Task 1); `StickerBook`; `gsap`, `Draggable`, `useGSAP`, `FULL`, `REDUCE`.
- Produces: `<HowItWorks total={number | null} signedIn={boolean} />`, anchor `#cach-hoat-dong` (target of the nav pill from Task 4).

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/tests/landing.spec.ts`:

```ts
test('how it works: the nav anchor scrolls there and the next button moves the stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.getByRole('navigation', { name: 'Chính' }).getByRole('link', { name: 'Cách hoạt động' }).click();
  const section = page.locator('#cach-hoat-dong');
  await expect(section).toBeInViewport();
  const track = section.locator('.obx-how__track');
  const trackX = () => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(await trackX()).toBe(0);
  await section.getByRole('button', { name: 'Bước tiếp' }).click();
  await expect.poll(trackX).toBeLessThan(-100);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: FAIL, `#cach-hoat-dong` not found.

- [ ] **Step 3: Create `sections/how-it-works.tsx`**

```tsx
'use client';

import Link from 'next/link';
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
                : { x: Math.max(0, p - i) * step, scale: 1 - 0.4 * d, rotation: -10 * d, zIndex: i },
            );
          });
        };

        measure();
        const [drag] = Draggable.create(track, {
          type: 'x',
          inertia: !reduce,
          bounds: { minX: -(n - 1) * step, maxX: 0 },
          snap: (x: number) => Math.round(x / step) * step,
          onDrag: update,
          onThrowUpdate: update,
        });

        go.current = (delta) => {
          const index = gsap.utils.clamp(0, n - 1, Math.round(position()) + delta);
          gsap.to(track, {
            x: -index * step,
            duration: reduce ? 0 : 0.725,
            ease: 'slush-bounce',
            onUpdate: () => {
              drag.update();
              update();
            },
          });
        };

        const onResize = () => {
          measure();
          gsap.set(track, { x: 0 });
          drag.applyBounds({ minX: -(n - 1) * step, maxX: 0 });
          drag.update();
          update();
        };
        window.addEventListener('resize', onResize);
        update();

        return () => {
          window.removeEventListener('resize', onResize);
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
          <br />
          <em>hoạt động</em>
        </h2>
        <p className="obx-how__sub">Bốn bước từ lúc chọn gói tới lúc sách nằm trên tay bạn.</p>
        <Link href={signedIn ? '/plans' : '/register'} className="obx-btn obx-btn--dark">
          {signedIn ? 'Chọn gói ↗' : 'Bắt đầu ↗'}
        </Link>
      </div>
      <div className="obx-how__stage">
        <ul className="obx-how__track" data-cursor="Kéo" aria-label="Các bước">
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
```

- [ ] **Step 4: Update `app/page.tsx`**

Add `import { HowItWorks } from './_landing/sections/how-it-works';` and render `<HowItWorks total={data.total} signedIn={!!user} />` right after `<Tabs />`.

- [ ] **Step 5: Append the styles to `landing.css`**

```css
/* ---------- 9 · How it works ---------- */

.obx-how {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  align-items: center;
  gap: 48px;
  scroll-margin-top: 88px;
}

.obx-how__intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
}

.obx-how__title {
  font-size: clamp(64px, 9vw, 140px);
}

.obx-how__sub {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.2;
}

.obx-how__stage {
  min-width: 0;
}

.obx-how__track {
  display: flex;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  touch-action: pan-y;
  cursor: grab;
}

.obx-how-card {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(340px, 78vw);
  aspect-ratio: 3 / 4;
  padding: 28px;
  border: 1px solid var(--color-ink);
  border-radius: 30px;
  background: var(--color-lilac);
  user-select: none;
}

.obx-how-card--stat {
  background: var(--color-ember);
}

.obx-how-card__n {
  font: 800 96px/0.8 var(--font-display);
}

.obx-how-card__title {
  font-size: 24px;
  font-weight: 700;
}

.obx-how-card__stat {
  margin-top: auto;
  font-size: clamp(56px, 6vw, 96px);
}

.obx-how-card__sticker {
  width: 96px;
  rotate: -8deg;
}

.obx-how__controls {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 991px) {
  .obx-how {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 7: Browser check**

`pnpm dev`, http://localhost:3000:
- "Cách hoạt động" in the nav scrolls smoothly (Lenis) to the section with the title below the nav.
- Dragging the row left pins passed cards at the left edge, shrinking and tilting them; a flick snaps to a whole card; it never drags past the first or last card.
- With the seed data the ember card shows the same total as `/books`; the no-total case is covered by the unit test and by the "API down" check in Task 12.
- At 375 the page scrolls vertically while touching the cards (emulate with `resize_window` preset mobile; vertical swipe is not blocked).

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/_landing/sections/how-it-works.tsx apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 how-it-works stacking drag"
```

---

### Task 10: Join + FAQ and footer

**Files:**
- Create: `apps/web/app/_landing/sections/join-faq.tsx`, `apps/web/app/_landing/sections/footer.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/landing.css` (append), `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `SHIPPING_FEES`, `WAREHOUSE_PROVINCE` (`@open-boox/shared`), `formatVnd`, `Marquee`, `.obx-tile*` classes (Task 3).
- Produces: `<JoinFaq signedIn={boolean} />`, `<Footer />`. After this task `page.tsx` has its final section order.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/tests/landing.spec.ts`:

```ts
test('FAQ answers the shipping question with the configured fees', async ({ page }) => {
  await page.goto('/');
  const question = page.getByText('Phí giao bao nhiêu?');
  await question.scrollIntoViewIfNeeded();
  await question.click();
  await expect(page.getByText(/Hà Nội 20\.000 đ, các tỉnh khác 35\.000 đ/)).toBeVisible();
  // The footer sits inside <main>, so it has no contentinfo role; select it by class.
  await expect(page.locator('footer.obx-footer')).toContainText('© 2026 Open Boox');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: FAIL, text "Phí giao bao nhiêu?" not found.

- [ ] **Step 3: Create `sections/join-faq.tsx`**

```tsx
import { SHIPPING_FEES, WAREHOUSE_PROVINCE } from '@open-boox/shared';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';

// Rules from builder/spec/app_design.md only; fees come from the shared constants so they cannot drift.
const FAQ = [
  {
    q: 'Phí giao bao nhiêu?',
    a: `Đơn mua sách tính phí giao theo địa chỉ nhận: ${WAREHOUSE_PROVINCE} ${formatVnd(SHIPPING_FEES.INNER)}, các tỉnh khác ${formatVnd(SHIPPING_FEES.OUTER)}.`,
  },
  {
    q: 'Có hạn trả sách không?',
    a: 'Không. Bạn giữ tối đa số cuốn của gói và trả khi đọc xong; trả cuốn nào thì có chỗ mượn cuốn khác.',
  },
  {
    q: 'Đổi hoặc huỷ gói thế nào?',
    a: 'Nâng cấp có hiệu lực ngay, giá mới tính từ lần gia hạn kế tiếp. Hạ gói áp dụng từ kỳ sau. Huỷ gia hạn thì gói vẫn dùng đến hết kỳ, và bạn có thể bật lại trước khi kỳ kết thúc.',
  },
  {
    q: 'Gói hết hạn thì sách đang mượn sao?',
    a: 'Bạn không mượn thêm được, nhưng vẫn trả được những cuốn đang giữ.',
  },
];

// Section 12: sign-up card + FAQ in place of Slush's newsletter and support cards.
export function JoinFaq({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="obx-sheet obx-sheet--frame obx-join" aria-label="Bắt đầu và câu hỏi thường gặp">
      <div className="obx-join__card">
        <h2 className="obx-display obx-join__title" data-anim-slant>
          {signedIn ? 'Vào tài khoản' : 'Tạo tài khoản'}
          <br />
          <em>{signedIn ? 'xem sách đang giữ' : 'mượn cuốn đầu tiên'}</em>
        </h2>
        <Link href={signedIn ? '/account' : '/register'} className="obx-btn obx-btn--dark">
          {signedIn ? 'Tài khoản ↗' : 'Đăng ký ↗'}
        </Link>
      </div>
      <div className="obx-join__card">
        <h2 className="obx-display obx-join__title" data-anim-slant>
          Hỏi nhanh
          <br />
          <em>đáp gọn</em>
        </h2>
        <div className="obx-faq">
          {FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p className="obx-body">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `sections/footer.tsx`**

```tsx
import Link from 'next/link';
import { Marquee } from '../ui/marquee';

const LINKS = [
  { href: '/books', label: 'Sách' },
  { href: '/plans', label: 'Gói mượn' },
  { href: '/account/orders', label: 'Đơn hàng' },
  { href: '/account', label: 'Tài khoản' },
];

const WORDS = ['Mượn', 'Mua', 'Giao', 'Đọc'];

// Section 13: tile marquee + indigo badge, 2×2 link tiles, mint card with the slogan.
export function Footer() {
  return (
    <footer className="obx-footer">
      <div className="obx-footer__band">
        <Marquee speed={20} repeat={2}>
          {WORDS.map((word, i) => (
            <span key={word} className={`obx-tile obx-tile--${i % 2 ? 'blue' : 'ember'}`}>
              <span className={`obx-display obx-tile__text${i % 2 ? ' obx-italic' : ''}`}>{word}</span>
            </span>
          ))}
        </Marquee>
        <span className="obx-footer__badge" aria-hidden="true">
          OB
        </span>
      </div>
      <div className="obx-footer__grid">
        <nav className="obx-footer__tiles" aria-label="Chân trang">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="obx-footer__tile">
              <span aria-hidden="true">↗</span>
              <span className="obx-display">{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="obx-footer__card">
          <p className="obx-display obx-footer__slogan" data-anim-slant>
            Chọn gói.
            <br />
            <em>Rồi cứ thế mà đọc.</em>
          </p>
          <div className="obx-footer__meta">
            <span>© 2026 Open Boox</span>
            <span>Mượn · Mua · Giao tận nơi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Final `app/page.tsx`**

```tsx
import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { loadLanding, pickFeaturedBook } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CategoryCarousel } from './_landing/sections/category-carousel';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Features } from './_landing/sections/features';
import { Footer } from './_landing/sections/footer';
import { Hero } from './_landing/sections/hero';
import { HowItWorks } from './_landing/sections/how-it-works';
import { JoinFaq } from './_landing/sections/join-faq';
import { Nav } from './_landing/sections/nav';
import { Plans } from './_landing/sections/plans';
import { Showcase } from './_landing/sections/showcase';
import { Statement } from './_landing/sections/statement';
import { Tabs } from './_landing/sections/tabs';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadLanding(apiPublic)]);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <Nav user={user} />
      <div className="obx-sheet obx-sheet--sky obx-sheet--hero">
        <Hero />
        <Showcase books={data.books} categories={data.categories} />
      </div>
      <Features plans={data.plans} />
      <Statement book={pickFeaturedBook(data.books)} />
      <CategoryCarousel categories={data.categories} />
      <WordMarquee />
      <Tabs />
      <HowItWorks total={data.total} signedIn={!!user} />
      <Plans plans={data.plans} />
      <CoverMarquee books={data.books} />
      <JoinFaq signedIn={!!user} />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 6: Append the styles to `landing.css`**

```css
/* ---------- 12 · Join + FAQ ---------- */

.obx-join {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--obx-gap);
}

.obx-join__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 32px;
  padding: clamp(28px, 4vw, 56px);
  border-radius: 40px;
  background: var(--color-sunburst);
}

.obx-join__card :focus-visible {
  outline-color: var(--color-ink);
}

.obx-join__title {
  font-size: clamp(56px, 6vw, 112px);
}

.obx-faq {
  width: 100%;
}

.obx-faq details {
  padding: 16px 0;
  border-top: 1px solid var(--color-ink);
}

.obx-faq summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 18px;
  font-weight: 700;
  list-style: none;
  cursor: pointer;
}

.obx-faq summary::-webkit-details-marker {
  display: none;
}

.obx-faq summary::after {
  content: '+';
  transition: rotate 0.5s var(--obx-ease-bounce);
}

.obx-faq details[open] summary::after {
  rotate: 45deg;
}

.obx-faq p {
  margin-top: 12px;
}

@media (max-width: 991px) {
  .obx-join {
    grid-template-columns: 1fr;
  }
}

/* ---------- 13 · Footer ---------- */

.obx-footer {
  display: flex;
  flex-direction: column;
  gap: var(--obx-gap);
}

.obx-footer__band {
  position: relative;
}

.obx-footer__badge {
  position: absolute;
  top: 50%;
  right: 24px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  border: 2px solid var(--color-paper);
  border-radius: 50%;
  background: var(--color-indigo);
  color: var(--color-paper);
  font: 800 48px/1 var(--font-display);
  translate: 0 -50%;
}

.obx-footer__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: var(--obx-gap);
}

.obx-footer__tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--obx-gap);
}

.obx-footer__tile {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  aspect-ratio: 1;
  padding: 20px;
  border-radius: 30px;
  background: var(--color-paper);
  transition: all 0.5s var(--obx-ease-bounce);
}

.obx-footer__tile:hover {
  background: var(--color-lilac);
}

.obx-footer__tile .obx-display {
  font-size: clamp(28px, 3.5vw, 56px);
}

.obx-footer__card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 48px;
  padding: clamp(28px, 5vw, 80px);
  border-radius: 40px;
  background: var(--color-mint);
}

.obx-footer__slogan {
  font-size: clamp(56px, 8vw, 150px);
}

.obx-footer__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 991px) {
  .obx-footer__grid {
    grid-template-columns: 1fr;
  }

  .obx-footer__badge {
    width: 80px;
    height: 80px;
    font-size: 32px;
  }
}
```

- [ ] **Step 7: Run all landing e2e tests**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: PASS, 12 tests (including the 375px overflow test, now over the full page).

- [ ] **Step 8: Browser check**

`pnpm dev`, http://localhost:3000: all 13 sections in the spec §3.2 order (banner, nav, hero + showcase, features, statement, carousel, word marquee, tabs, how it works, plans, cover marquee, join + FAQ, footer). FAQ `+` turns into `×` with a bounce. Footer tiles turn lilac on hover. Signed in, the join card says "Vào tài khoản".

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/_landing/sections/join-faq.tsx apps/web/app/_landing/sections/footer.tsx apps/web/app/page.tsx apps/web/app/landing.css e2e/tests/landing.spec.ts
git commit -m "feat(web): landing v2 join/FAQ cards and footer"
```

---

### Task 11: Curtain transition when leaving `/`

**Files:**
- Create: `apps/web/components/curtain/curtain-store.ts`, `apps/web/components/curtain/curtain-store.test.ts`, `apps/web/components/curtain/curtain-overlay.tsx`, `apps/web/components/curtain/curtain-link.tsx`
- Modify: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, every section file under `apps/web/app/_landing/sections/` that imports `next/link`, `e2e/tests/landing.spec.ts` (append)

**Interfaces:**
- Consumes: `motion/gsap.ts` (imported dynamically by the overlay; already loaded on `/`).
- Produces:
  - `type CurtainState = 'idle' | 'covering' | 'covered' | 'revealing'`
  - `createCurtainStore()` returning `{ get(): CurtainState; subscribe(listener: (state: CurtainState, href: string | null) => void): () => void; intercept(href: string): boolean; markCovered(): void; beginReveal(): boolean; finish(): void }`; singleton `curtainStore`.
  - `<CurtainLink href: string …LinkProps />`, `<CurtainOverlay />` (DOM: `div[data-curtain][data-state]`).

- [ ] **Step 1: Write the failing unit test**

Create `apps/web/components/curtain/curtain-store.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createCurtainStore } from './curtain-store';

describe('curtain store', () => {
  it('lets the link navigate normally when no overlay is listening', () => {
    const store = createCurtainStore();
    expect(store.intercept('/plans')).toBe(false);
    expect(store.get()).toBe('idle');
  });

  it('starts covering and tells the overlay where to go', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.intercept('/plans')).toBe(true);
    expect(store.get()).toBe('covering');
    expect(listener).toHaveBeenCalledWith('covering', '/plans');
  });

  it('swallows clicks while a curtain is running', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.intercept('/plans');
    expect(store.intercept('/books')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reveals only once, and only after covering finished', () => {
    const store = createCurtainStore();
    store.subscribe(() => {});
    expect(store.beginReveal()).toBe(false);
    store.intercept('/plans');
    expect(store.beginReveal()).toBe(false);
    store.markCovered();
    expect(store.get()).toBe('covered');
    expect(store.beginReveal()).toBe(true);
    expect(store.beginReveal()).toBe(false);
    store.finish();
    expect(store.get()).toBe('idle');
  });

  it('stops notifying after unsubscribe', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    expect(store.intercept('/plans')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test -- curtain`
Expected: FAIL, `Failed to resolve import "./curtain-store"`.

- [ ] **Step 3: Create `curtain-store.ts`**

```ts
export type CurtainState = 'idle' | 'covering' | 'covered' | 'revealing';
type Listener = (state: CurtainState, href: string | null) => void;

// idle → covering (link clicked) → covered (panels cover the screen, router.push sent)
// → revealing (route changed or 3s timeout) → idle.
export function createCurtainStore() {
  let state: CurtainState = 'idle';
  let href: string | null = null;
  const listeners = new Set<Listener>();

  const set = (next: CurtainState) => {
    state = next;
    listeners.forEach((listener) => listener(state, href));
  };

  return {
    get: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** true = the click is handled here (preventDefault); false = navigate normally. */
    intercept(target: string): boolean {
      if (!listeners.size) return false;
      if (state !== 'idle') return true;
      href = target;
      set('covering');
      return true;
    },
    markCovered() {
      if (state === 'covering') set('covered');
    },
    beginReveal(): boolean {
      if (state !== 'covered') return false;
      set('revealing');
      return true;
    },
    finish() {
      href = null;
      set('idle');
    },
  };
}

export const curtainStore = createCurtainStore();
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test -- curtain`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing e2e tests**

Append to `e2e/tests/landing.spec.ts`:

```ts
test.describe('curtain', () => {
  const cta = (page: Page) => page.getByRole('link', { name: 'Chọn gói mượn ↗' });
  const curtain = (page: Page) => page.locator('[data-curtain]');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
  });

  test('CTA plays the curtain and lands on a usable /plans', async ({ page }) => {
    await cta(page).click();
    await expect(curtain(page)).not.toHaveAttribute('data-state', 'idle');
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.getByRole('link', { name: 'Sách', exact: true }).first().click({ trial: true });
  });

  test('back to the landing after a curtain navigation', async ({ page }) => {
    await cta(page).click();
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.locator('.obx-hero__tagline')).toBeVisible();
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle');
    await cta(page).click({ trial: true });
  });

  test('double click navigates once', async ({ page }) => {
    await cta(page).dblclick();
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/');
  });

  test('modifier click opens a new tab without the curtain', async ({ page, context }) => {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      cta(page).click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await popup.waitForLoadState();
    expect(new URL(popup.url()).pathname).toBe('/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle');
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('curtain with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('fades instead and still lands on /plans', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Chọn gói mượn ↗' }).click();
    await page.waitForURL('**/plans');
    await expect(page.locator('[data-curtain]')).toHaveAttribute('data-state', 'idle', { timeout: 3000 });
  });
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts`
Expected: the curtain tests FAIL (`[data-curtain]` not found).

- [ ] **Step 7: Create `curtain-overlay.tsx`**

```tsx
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
```

- [ ] **Step 8: Create `curtain-link.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { curtainStore } from './curtain-store';

type CurtainLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

// Plays the curtain before leaving the landing page. New-tab clicks (modifiers, middle button) and clicks already
// cancelled by the caller (e.g. the end of a carousel drag) behave like a plain link.
export function CurtainLink({ href, onClick, ...rest }: CurtainLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (curtainStore.intercept(href)) event.preventDefault();
  };
  return <Link {...rest} href={href} onClick={handleClick} />;
}
```

- [ ] **Step 9: Mount the overlay and add its styles**

In `apps/web/app/layout.tsx` add `import { CurtainOverlay } from '@/components/curtain/curtain-overlay';` and render `<CurtainOverlay />` as the last child of `<body>`, after the second `HeaderGate`:

```tsx
        <HeaderGate>
          <SiteFooter />
        </HeaderGate>
        <CurtainOverlay />
      </body>
```

Append to `apps/web/app/globals.css`:

```css
/* Curtain transition when leaving the landing page (components/curtain). Hidden and click-through unless running. */
.obx-curtain {
  position: fixed;
  inset: 0;
  z-index: 1000;
  perspective: 1200px;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
}

.obx-curtain[data-state='covering'],
.obx-curtain[data-state='covered'] {
  pointer-events: auto;
}

.obx-curtain__fade {
  position: absolute;
  inset: 0;
  background: var(--color-ink);
}

.obx-curtain__panel {
  position: absolute;
  inset: -4vh -4vw;
  border-radius: 2em;
}
```

- [ ] **Step 10: Switch the landing links to `CurtainLink`**

In each file below, replace `import Link from 'next/link';` with `import { CurtainLink } from '@/components/curtain/curtain-link';` and rename every `<Link` / `</Link>` to `<CurtainLink` / `</CurtainLink>`:

- `sections/hero.tsx`, `sections/features.tsx`, `sections/statement.tsx`, `sections/plans.tsx`, `sections/category-carousel.tsx`, `sections/tabs.tsx`, `sections/how-it-works.tsx`, `sections/cover-marquee.tsx`, `sections/join-faq.tsx`, `sections/footer.tsx`.

In `sections/nav.tsx` keep `import Link from 'next/link';` for the logo (`href="/"` stays a plain `Link`), add the `CurtainLink` import, and use `CurtainLink` for every other `Link` (Sách, Gói mượn, Quản trị, Đăng nhập, Tài khoản, Đăng ký). `CartLink` and the `#cach-hoat-dong` anchor stay as they are.

Check that nothing was missed:

```bash
grep -rn "from 'next/link'" apps/web/app/_landing/sections
```

Expected: only `sections/nav.tsx`.

- [ ] **Step 11: Run unit, type, lint and e2e checks**

Run:

```bash
pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web lint
docker compose up -d --wait db && pnpm --filter e2e test:e2e landing.spec.ts
```

Expected: web tests pass (existing + 10 data + 5 curtain); typecheck clean; lint 0 errors; landing e2e PASS, 17 tests.

- [ ] **Step 12: Browser check**

`pnpm dev`, http://localhost:3000:
- "Chọn gói mượn" → three colored panels swing in from the right with a bounce, the URL changes to `/plans`, the panels swing out to the left last-first, and `/plans` is clickable.
- "Xem kho sách" → `/books`; a footer tile → its page; a category slide → filtered `/books`; colors differ between runs.
- Browser Back → landing intro plays again. In the console: `document.querySelectorAll('.obx-curtain').length === 1`.
- Cmd-click a CTA opens a new tab and the current tab stays put.

- [ ] **Step 13: Commit**

```bash
git add apps/web/components/curtain apps/web/app/layout.tsx apps/web/app/globals.css apps/web/app/_landing/sections e2e/tests/landing.spec.ts
git commit -m "feat(web): curtain transition when leaving the landing page"
```

---

### Task 12: Acceptance, quality gates and handover

**Files:**
- Create: `.ai/tasks/2026-10-01-landing-v2/handover.md`

**Interfaces:** none.

- [ ] **Step 1: Full quality gates**

From the worktree root:

```bash
pnpm lint
pnpm typecheck
pnpm test
docker compose up -d --wait db && pnpm test:e2e
pnpm build
pnpm audit --prod
```

Expected: lint 0 errors; typecheck clean; api/web/shared tests all pass (web count = previous 128 + 15 new); e2e = the 3 existing specs + all landing tests pass; build succeeds; `pnpm audit --prod` shows no advisory that names `gsap` or `@gsap/react`. Record the `/` route's "First Load JS" from the `next build` output.

- [ ] **Step 2: Leak check across navigations**

ScrollTrigger is not reachable from the console, so expose it temporarily: add
`(window as unknown as { __st: typeof ScrollTrigger }).__st = ScrollTrigger;` as the first line of `LandingMotion`'s
`full` branch. With `pnpm dev` running, in the in-app browser (`javascript_tool`):
1. Load `/`, scroll to the bottom, read `window.__st.getAll().length` → N.
2. Click "Xem kho sách" (curtain to `/books`), read `window.__st.getAll().length` → expected `0`.
3. Browser Back, scroll to the bottom again, read the count → expected N (not 2N).

Remove the temporary line afterwards and confirm `git status` shows no change to `landing-motion.tsx`.

- [ ] **Step 3: Run the spec §6 checklist in the browser**

At 1440×900 and at 375×812 (`resize_window`), using screenshots, check every box in spec §6 except the gates already run in Step 1. The in-app browser cannot emulate `prefers-reduced-motion`, so the reduced-motion box is checked by the e2e reduced-motion tests (hero, scroll reveals, curtain) that passed in Step 1; say so in the handover.

For "API down", stop the API process only (leave the web dev server running), reload `/`, confirm the landing renders with fallback plans and categories, sticker tiles in the cover row and no stat card, then start the API again.

- [ ] **Step 4: Write `handover.md`**

```markdown
# Landing v2 — Handover

## Done
- Tasks 1–11 of `.ai/tasks/2026-10-01-landing-v2/plan.md` (commit list: `git log --oneline master..landing-v2`).

## Verification (2026-10-xx)
- lint / typecheck / tests: <paste counts>
- e2e: <paste summary line>
- build: `/` First Load JS = <value>
- pnpm audit --prod: <result>
- ScrollTrigger count: `/` N=<n> → `/books` 0 → back `/` <n>
- Spec §6 checklist: <one line per item: pass / fail + note, with viewport>

## Deviations from the spec
- <none, or what and why>

## Open items
- <anything left>
```

Fill every `<…>` with the real output; leave no placeholder.

- [ ] **Step 5: Commit**

```bash
git add .ai/tasks/2026-10-01-landing-v2/handover.md
git commit -m "docs(landing-v2): handover"
```
