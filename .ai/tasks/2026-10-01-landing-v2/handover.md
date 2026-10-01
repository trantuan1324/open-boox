# Landing v2 — Handover

## Done
- Tasks 1–11 of `.ai/tasks/2026-10-01-landing-v2/plan.md` (commit list: `git log --oneline master..landing-v2`, 23 commits, `0c79d9f` … `31e80aa`).

## Verification (2026-10-01)
- lint / typecheck / tests: lint 0 errors (3 pre-existing warnings in untouched files: react-hooks/incompatible-library, no-location-assign-relative-destination in `lib/api/client.ts`, anonymous default export in `postcss.config.mjs`); typecheck clean (5/5 tasks); tests: shared 117 passed (8 files), web 144 passed (22 files), api 275 passed.
- e2e: `20 passed (1.1m)` — the 3 existing specs plus 17 landing tests.
- build: succeeds. Next 16 (Turbopack) does not print a "First Load JS" column for routes; closest figure: the client chunks referenced by `/` (page client-reference manifest, 8 chunks) total 1,175,406 B raw / 288,792 B gzip. `/` is dynamic (ƒ).
- pnpm audit --prod: 1 high advisory, `deepmerge-ts <8.0.0` (GHSA-ggr8-5vv4-36mx) via `apps/api > @prisma/client > prisma > @prisma/config`. No advisory names `gsap` or `@gsap/react`. Pre-existing, unrelated to this branch.
- ScrollTrigger count: `/` N=14 → `/books` 0 → back `/` 14 (not 28; no leak). Measured with a temporary `window.__st` line, since removed (git status clean).
- Spec §6 checklist (headless Chromium, 1440×900 and 375×812, against dev server :3200; the in-app browser pane was hidden so rAF was paused):
  - Black frame, gutters 12/8px, radius 40/30/20/999, no gradient/shadow: pass (1440 and 375).
  - Two eases only (+ power3 cursor), old hand-made transitions removed: pass (code review).
  - Intro order (wordmark roll, chars, blocks, stickers, nav slide): pass (frames 150/700/1400/2600ms).
  - Nav pills hide on scroll down / return up, "+" hover, mobile menu, Escape returns focus: pass.
  - 5 marquees seamless, reverse with scroll direction, px/s equal at 1440 and 375: pass.
  - Features slant + 3D reveal, zig-zag, 1 column <768: pass.
  - Carousel autoplay ≈4s, hover pause, drag with inertia, drag never navigates, dots synced: pass.
  - Tabs Flip pill (click and hover), bg swap, one-time auto-advance, single visible panel, backward switch correct: pass.
  - How-it-works stack drag/pin/bounds/buttons, mobile vertical swipe scrolls page: pass.
  - Cursor pill labels ("KÉO", "XEM SÁCH"), fine pointer only: pass (touch not visually emulated).
  - Hover invert on buttons: pass by CSS review only (not captured in screenshots).
  - Curtain `/` → `/books` and back (intro reruns, one overlay): pass; `/plans`, `/register`, modifier click, double click: covered by e2e.
  - Reduced motion: covered by the e2e reduced-motion tests only (hero visible, reveals end at opacity 1, curtain fades); the in-app browser cannot emulate it: pass.
  - Vietnamese diacritics at 160px display: pass after the line-height ruling (1.2).
  - No horizontal scroll at 375 (scrollWidth 375): pass.
  - API down (web restarted with `API_INTERNAL_URL=http://localhost:4999`): 200, fallback plans/categories, sticker tiles in cover row, no stat card: pass.
  - Console errors in dev: only cover-image proxy timeouts from covers.openlibrary.org: pass.
  - Signed-in seed customer: nav CTA "Tài khoản", no "Đăng nhập" pill, how-it-works CTA "Chọn gói ↗", join card "Vào tài khoản": pass.

## Deviations from the spec
- Display line-height 0.8 → 1.1 → 1.2 (and the 0.8-specific optical trims dropped): spec §6 requires correct Vietnamese diacritics at 160px; the worst stack needs ≈1.17em. Spec §2 amended (d8aa27d, accb15b).
- `.obx-home a` colour reset rewritten as `:where(.obx-home) a` so button classes win (black-on-black CTAs otherwise).
- T2 deleted `reveal.tsx`, `scroll-fx.tsx`, `smooth-scroll.tsx` (spec §4.1 "Xoá"), outside the plan's file list.
- Marquee: word rows repeat ×2, cover row uses ceil(12/n) copies; under reduced motion the paused row scrolls horizontally with inert duplicates hidden; tile text clipping and sticker overhang fixed in CSS.
- Task 5 executed before Task 4 (nav e2e needs a scrollable page); showcase grid padding and even book slice fixed to remove the loop jump. `.obx-phone-wrap` gets `margin-bottom: 144px` at ≥768px.
- Nav: shared CartLink restyled only inside the landing nav via `.obx-nav__li > a:not(.obx-btn)` (shared component untouched); Escape closes the menu and returns focus to "+".
- Carousel: keyboard Enter guard only for pointer clicks (`event.detail > 0`), prev/next from the live loop index, controls hidden with a single category.
- Tabs: art `xPercent` reset on revisit; incoming panel z-index 1 during backward switches.
- How-it-works: cards pin at 85% of travelled distance; tweens killed on cleanup/press; resize only re-measures when width changed; `role="list"` on the `<ul>`.
- Footer: tiles use `repeat(2, minmax(0, 1fr))` with `min-width: 0`; `.obx-footer :focus-visible` outline is paper-coloured.
- Curtain: failed dynamic import recovers by finishing the store and pushing the route without the curtain; `intercept` returns false while 'revealing'.
- Worktree created from local HEAD (native tool would branch from origin/master, which lacks the spec/plan commits).

## Final whole-branch review (opus) and fix wave
- Verdict "with fixes": 0 Critical, 3 Important accessibility gaps traced to plan assumptions. Fixed in `a365011`, re-reviewed clean; landing e2e now 21/21.
  - Split text: hero tagline uses an sr-only copy + `aria: 'none'` split on an aria-hidden span; footer slogan is an `h2`; a space before every `<br />` in split headings keeps word boundaries in accessible names.
  - Moving rows: focusing a carousel slide centres it and pauses autoplay while focus is inside; 8px clip padding keeps focus rings visible; cover-marquee tiles are `tabIndex={-1}` (mouse shortcuts; the catalog stays reachable by keyboard elsewhere).
  - Nav: "+" precedes the pills in the DOM (desktop visual order kept with CSS `order`), so Tab after opening the mobile menu reaches the pills; on desktop "+" focuses the first pill.
  - Also: marquee and showcase loops pause off-screen, `lagSmoothing` restored on unmount, marquee breakpoint seam at 479–480px closed.

## Open items
- Loops that start off-screen run until first scrolled through (one-line fix noted in the review); desktop Tab order (logo, "+", pills, CTA) differs from the visual order.
- Hover invert on buttons verified by CSS review only, not visually.
- Reduced motion verified by e2e only, not in a browser.
- `pnpm audit --prod` high advisory on `deepmerge-ts` (Prisma toolchain), not from this branch; needs a Prisma bump.
- `next build` prints no First Load JS figure (Turbopack); the chunk-size figure above is an approximation.
