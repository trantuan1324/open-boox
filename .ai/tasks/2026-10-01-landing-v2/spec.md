# Landing v2 — Spec

> Dựng lại landing `/` của Open Boox theo design & motion language trong `builder/spec/slush-design-motion-spec.md` (gọi tắt **[SM]**, trích theo mục, ví dụ [SM §5.6]).
> Ngày: 2026-10-01. Branch: `landing-v2`. Nguồn chốt: phiên brainstorm 2026-10-01.

## 1. Mục tiêu & phạm vi

**Mục tiêu**: làm lại landing `/` theo đủ 13 section của [SM §4], cả cấu trúc lẫn motion, nội dung tiếng Việt cho Open Boox (mượn theo gói, mua, giao tận nơi). Tham số motion lấy nguyên từ [SM §5], chỉ khác ở những chỗ ghi trong §4.2 của tài liệu này.

**Trong phạm vi**
- Viết lại `apps/web/app/page.tsx`, `landing.css` và thư mục mới `apps/web/app/_landing/`.
- Hệ motion GSAP + Lenis, chỉ chạy ở `/`.
- Custom cursor và nav kiểu Slush, chỉ ở `/`.
- Chuyển trang curtain 3D **chỉ khi rời `/`** qua `CurtainLink`. Overlay gắn trong root layout.
- Sticker và minh hoạ tự vẽ bằng SVG/CSS.
- Unit test cho các hàm dữ liệu thuần và 1 spec Playwright cho landing.

**Ngoài phạm vi**
- Không thêm hoặc sửa API.
- Không đổi các trang khác (header/footer chung, catalog, account, admin…).
- Không dùng Lottie, ảnh render, video hay asset bên ngoài.
- Curtain giữa các trang trong với nhau.
- Testimonials, logo đối tác, newsletter thật: các section này được chuyển nghĩa (§3).

**Tiêu chí thành công**: đạt toàn bộ checklist nghiệm thu ở §6.

## 2. Ràng buộc

- Next.js 16 App Router, React 19, Tailwind v4, TypeScript. Tiếng Việt hiển thị dấu đúng.
- Font: **Barlow Condensed 800 + italic** (display) và **Be Vietnam Pro** (UI), đã load trong `layout.tsx`. Bỏ Anton và Inter Tight trong `page.tsx`.
- Token màu trong `theme.css`, dùng như đang có: `ink #000`, `paper #fff`, `sky #dceeff`, `blue #4da2ff`, `indigo #5c4ade`, `sunburst #ffd731`, `ember #fb4903`, `lilac #e9ccff`, `mint #55db9c`. Không gradient, không box-shadow cho UI.
- Radius: sheet 40px, box/tile 30px, card 20px, pill 999px. Viền 1px đen (2px cho nút tròn). Khoảng cách giữa các sheet 12px (8px khi ≤767).
- Typography: [SM §3.2]. Display UPPERCASE, line-height 0.8, `margin-bottom: -0.1em`; cỡ 160 / 128 (≤991) / 99px (≤767). Heading 64px/1.0, tracking −0.01em. Body 16/1.25. Label nút 16px, 500, UPPER, tracking 0.03em.
- Breakpoint CSS: 479 / 767 / 991. JS: 768 cho slider/tabs, 992 cho nav desktop.
- Dependency mới: `gsap`, `@gsap/react`. `lenis` đã có.
- Landing phải render được khi API lỗi, dùng fallback như hiện tại.

## 3. Nội dung & dữ liệu theo section

### 3.1 Dữ liệu

`page.tsx` (server) gọi song song qua `apiPublic`, cache 60s, tag catalog như hiện tại:
- `GET /plans` → `PlanDto[]`
- `GET /categories` → `CategoryDto[]`
- `GET /books` → `Paged<BookSummary>` (trang 1, `BOOK_PAGE_SIZE` = 12 cuốn, kèm `total`)
- `getCurrentUser()` cho nav.

Mỗi nguồn lỗi độc lập:
- `plans` và `categories` lỗi → dùng `FALLBACK_PLANS` / `FALLBACK_CATEGORIES` (giữ như hiện tại).
- `books` lỗi → `books = []`, `total = null`.

### 3.2 Map section

| # | Section | Nội dung | Dữ liệu | Thành phần | Motion |
| --- | --- | --- | --- | --- | --- |
| 0 | Banner | Marquee nền lilac, chữ 13px UPPER bold: "Gói mượn từ {giá rẻ nhất}/30 ngày ✦ Giao & nhận sách tận nhà ✦ Trả cuốn này, mượn cuốn khác". Không có giá thì bỏ cụm đầu | plans | `banner.tsx` → `Marquee` | marquee |
| 1 | Nav (fixed) | Trái: logo tròn "OB" viền 2px. Phải: pill **Sách** `/books`, **Gói mượn** `/plans`, **Cách hoạt động** `#cach-hoat-dong`, **Giỏ** (`CartLink`), nút tròn "+", CTA đen: chưa đăng nhập → "Đăng ký ↗" `/register` + pill "Đăng nhập"; đã đăng nhập → "Tài khoản" (+ "Quản trị" nếu ADMIN) | user | `nav.tsx` (client) | [SM §5.2] |
| 2 | Hero (sheet sky) | Wordmark SVG **OPEN BOOX** + `h1` sr-only "Open Boox — mượn sách theo gói, mua sách, giao tận nơi"; tagline 64px "Đọc nhiều hơn. Sở hữu ít hơn."; sub 16px; CTA "Chọn gói mượn ↗" (đen, `CurtainLink` `/plans`) + "Xem kho sách" (trắng, `CurtainLink` `/books`); ribbon SVG xanh phía sau; 4 sticker (sách, kính, bookmark, hộp giao) đè lên chữ | — | `hero.tsx` (client) | [SM §5.1], parallax ribbon 30 → −60 |
| 3 | Showcase (cùng sheet sky) | Mockup điện thoại HTML/CSS, bên trong là lưới 2 cột bìa sách tự cuộn dọc; 2 cặp "mockup nhỏ ↔ text": "Tìm sách theo thể loại", "Theo dõi đơn & lượt mượn" | books (≤8) | `showcase.tsx` (client) | [SM §5.10] trên mockup; parallax 20 → 0 |
| 4 | Feature zig-zag ×3 (trắng) | (a) "GIỮ NHIỀU CUỐN / *CÙNG LÚC*": 2–5 cuốn tuỳ gói. (b) "KHÔNG HẠN TRẢ / *ĐỌC THONG THẢ*": giữ đến khi muốn đổi. (c) "ĐỔI GÓI / *TỨC THÌ*": nâng cấp có hiệu lực ngay, hạ gói vào kỳ sau. Mỗi cái kèm minh hoạ SVG trên card accent (lilac/blue/sunburst) và CTA về `/plans` | — | `features.tsx` (server) | slant [SM §5.6] + card 3D [SM §5.8] |
| 5 | Statement | "MỌI CUỐN SÁCH / GIAO [card bìa nổi bật] / TẬN CỬA". Card indigo radius 20 chèn inline, chứa bìa + tên + tác giả, link `/books/{slug}`. Không có cuốn nổi bật thì card hiện sticker sách | books | `statement.tsx` (server) | heading 3D [SM §5.7], sticker parallax |
| 6 | Carousel thể loại | Tiêu đề "KỆ NÀO / *CŨNG CÓ*" + pill "Xem tất cả sách"; carousel card dọc radius 30, màu theo `cycleColor`, tên thể loại display italic ở đáy, sticker SVG, link `/books?category={slug}`; dot pagination | categories | `category-carousel.tsx` (client) | [SM §5.12] |
| 7 | Word marquee (khung đen) | 2 hàng tile radius 30: hàng 1 "MƯỢN · *MUA* · GIAO · *ĐỌC*" (white/ember/blue), hàng 2 "OPEN BOOX · *TRẢ & MƯỢN TIẾP*" (blue/sunburst/mint/lilac); sticker đè lên tile | — | `word-marquee.tsx` → `Marquee` ×2 | [SM §5.5], 2 hàng ngược chiều |
| 8 | Tabs | Tab **Mượn / Mua / Giao**. Panel: visual SVG trái (nền lilac → sunburst → mint), display + đoạn text + link phải (`/plans`, `/books`, `/account/orders`) | — | `tabs.tsx` (client) | [SM §5.11] |
| 9 | Cách hoạt động (`id="cach-hoat-dong"`) | Trái: display italic "CÁCH / *HOẠT ĐỘNG*" + sub 24px + CTA "Bắt đầu ↗" (`CurtainLink` `/register`, hoặc `/plans` khi đã đăng nhập). Phải: stack kéo được gồm 4 card bước lilac (1 Chọn gói → 2 Chọn sách → 3 Nhận tận nhà → 4 Trả & mượn tiếp) + 1 card stat ember "{total} ĐẦU SÁCH" ở vị trí 3. `total` null thì bỏ card stat | books.total | `how-it-works.tsx` (client) | [SM §5.13] |
| 10 | Gói mượn ×3 | 3 card sunburst/lilac/blue: tên gói, "{maxBooks} CUỐN / *CÙNG LÚC*", giá `formatVnd`/30 ngày, CTA "Chọn {name} ↗" (`CurtainLink` `/plans`), sticker góc | plans | `plans.tsx` (server) | card 3D |
| 11 | Cover marquee (khung đen) | Tile vuông radius 30, màu xoay vòng blue → sunburst → mint → lilac, mỗi tile chứa bìa (hoặc tiêu đề display khi không có bìa) + tác giả. `books` rỗng thì dùng tile sticker | books | `cover-marquee.tsx` → `Marquee` | marquee |
| 12 | Join + FAQ (khung đen) | 2 card sunburst: (a) "TẠO TÀI KHOẢN / *MƯỢN CUỐN ĐẦU TIÊN*" + CTA đen `/register`, hoặc "VÀO TÀI KHOẢN" `/account` khi đã đăng nhập; (b) FAQ gồm 4 `<details>`, chỉ dùng quy tắc có trong `builder/spec/app_design.md`: "Phí giao bao nhiêu?" (nội thành / ngoại thành, đọc từ `SHIPPING_FEES` trong `@open-boox/shared`, không viết cứng); "Có hạn trả sách không?" (không, giữ tối đa N cuốn của gói); "Đổi hoặc huỷ gói thế nào?" (nâng cấp hiệu lực ngay, hạ cấp từ kỳ sau, huỷ gia hạn có thể tiếp tục lại); "Gói hết hạn thì sách đang mượn sao?" (không mượn thêm được nhưng vẫn trả được) | user | `join-faq.tsx` (server) | slant |
| 13 | Footer (khung đen) | Marquee tile ember/blue + huy hiệu tròn indigo "OB"; 2×2 tile trắng radius 30 (Sách, Gói mượn, Đơn hàng, Tài khoản); card mint radius 40: "CHỌN GÓI. / *RỒI CỨ THẾ MÀ ĐỌC.*", link phụ, "© 2026 Open Boox" | — | `footer.tsx` (server) | slant, marquee |

Quy tắc chung: link sang trang trong dùng `CurtainLink`; anchor `#…` và link `/` dùng `<a>`/`Link` thường. Chữ đen trên mọi nền accent; chữ trắng chỉ trong nút đen.

## 4. Kiến trúc & motion

### 4.1 Cấu trúc file

```
apps/web/app/
  page.tsx                    # server: fetch + ghép section; import './landing.css'
  landing.css                 # viết lại toàn bộ (prefix .obx-)
  _landing/
    data.ts                   # fetch + fallback + hàm thuần (§5.1)
    data.test.ts
    motion/
      gsap.ts                 # 'use client'; registerPlugin, 2 ease, defaults; export gsap & plugin
      landing-motion.tsx      # client, mount 1 lần trong page: Lenis↔ticker + quét data-* (§4.3)
      split.ts                # splitChars/splitLines + aria
      cursor.tsx              # client
    svg/
      wordmark.tsx  stickers.tsx  illustrations.tsx
    sections/
      banner.tsx nav.tsx hero.tsx showcase.tsx features.tsx statement.tsx
      category-carousel.tsx word-marquee.tsx tabs.tsx how-it-works.tsx
      plans.tsx cover-marquee.tsx join-faq.tsx footer.tsx
    ui/
      marquee.tsx             # client
      horizontal-loop.ts      # helper horizontalLoop chính thức của GSAP (kèm ghi chú nguồn)
apps/web/components/curtain/
  curtain-overlay.tsx         # client, gắn trong app/layout.tsx
  curtain-link.tsx            # client
  curtain-store.ts            # trạng thái module: idle | covering | covered
e2e/tests/landing.spec.ts
```

Xoá: `app/reveal.tsx`, `app/scroll-fx.tsx`, `app/smooth-scroll.tsx`. Giữ `header-gate.tsx`.

Section **server** chỉ gắn attribute (`data-anim-slant`, `data-heading-reveal`, `data-card-reveal="wrap|card"`, `data-parallax="trigger|target"` + `data-parallax-start/end/disable`, `data-cursor="nhãn"`). Mọi tween tạo trong `useGSAP` / `gsap.context` để `revert()` khi unmount.

### 4.2 Bảng motion

Nền tảng (`motion/gsap.ts`):
- `CustomEase.create('slush', '0.65,0.05,0,1')`.
- `slush-bounce` là path SVG chuyển từ chuỗi `linear()` [SM §5]. Chuỗi `linear()` đó cũng là biến `--ease-bounce` trong `landing.css`.
- `gsap.defaults({ ease: 'slush', duration: 0.525 })`. Chỉ dùng 2 ease này, riêng cursor dùng `power3`.
- Lenis: `lerp: 0.12`, `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`.
- Khi `document.fonts.ready` resolve thì gọi `ScrollTrigger.refresh()`.

| Hiệu ứng | Tham số | Khác [SM] |
| --- | --- | --- |
| Intro hero | [SM §5.1]: wordmark split-flap (mỗi chữ `yPercent −100`, 1.25s, stagger 0.15, tầng 2 +0.5s); tagline chars x −0.25em, 0.65s, stagger 0.015 from end; `[data-load-stagger]` y 3em, 1s, stagger 0.1 tại +0.5s; sticker scale 0.2 / rotate −90 / autoAlpha 0, 1s, stagger 0.1 random; nav `yPercent 0`, 0.8s slush, delay 0.6 (trạng thái đầu `yPercent −100`) | Sticker SVG: sau khi vào, thêm 1 nhịp wobble rotate ±6° bằng slush-bounce (thay cho việc "play" Lottie) |
| Nav ẩn/hiện | [SM §5.2]: pill `yPercent −300`/0, 0.75s bounce, stagger 0.03 (xuống: from start, lên: from end), deadzone 10px, chỉ khi scrollY > 50, chỉ ≥992; hover "+" thì reveal; mobile "+" mở menu (pill `xPercent 300 → 0` from end, nút rotate 90°, gạch ngang scaleX 0) | Nav đặt trong sheet hero ở trạng thái đầu, fixed khi cuộn |
| Slant chars | [SM §5.6] | — |
| Heading 3D | [SM §5.7] | — |
| Card 3D | [SM §5.8] | — |
| Parallax | [SM §5.9] | — |
| Mockup vào | [SM §5.10]: scale 0.75, yPercent 40, autoAlpha 0, 1.2s bounce, `top center` once | Áp cho mockup HTML. Lưới bìa trong mockup cuộn `yPercent` loop linear 20s |
| Marquee | [SM §5.5]: nhân đôi track, xPercent loop linear; hệ số 1 / 0.5 (≤991) / 0.25 (≤479); đảo `timeScale` theo `self.direction`; trôi ±10vw scrub. Speed: banner 25s, word hàng 1 15s, word hàng 2 20s (ngược chiều), cover 25s, footer 20s | Speed từng hàng tự gán ([SM §9.5] chưa xác định) |
| Tabs | [SM §5.11] | — |
| Carousel | [SM §5.12] | — |
| Stack | [SM §5.13] | — |
| Cursor | [SM §5.4] | Chỉ chạy khi `(hover: hover) and (pointer: fine)` |
| Hover nút/pill | `transition: all .5s var(--ease-bounce)`, đảo trắng ↔ đen | — |
| Curtain | §4.4 | Không bọc trang cũ trong container 3D |

### 4.3 `landing-motion.tsx` và reduced motion

Component mount 1 lần, dùng `gsap.matchMedia()` với 2 điều kiện `full: (prefers-reduced-motion: no-preference)` và `reduce: (prefers-reduced-motion: reduce)`.

- **full**: khởi tạo Lenis, cursor, và quét `data-*` trong root `.obx-home` để tạo các ScrollTrigger.
- **reduce**:
  - Không Lenis, không cursor, không split chữ, không 3D, không stagger.
  - Phần tử có `data-anim-*` chỉ fade (autoAlpha 0 → 1, 0.3s, `top 90%`).
  - Parallax tắt. Marquee đứng yên (`paused`), vẫn hiện đủ nội dung và không bị cắt mất chữ đầu.
  - Intro hero: hiện ngay, không timeline.
  - Carousel không autoplay, kéo vẫn được. Tabs đổi panel không animate.
  - Curtain thay bằng crossfade 0.3s.

Ẩn nội dung trước khi JS chạy:
- **Dưới fold**: CSS không ẩn sẵn. Trạng thái ẩn do GSAP đặt trong `useGSAP` (layout effect), vì lúc hydrate các phần tử này chưa nằm trong viewport nên không bị nháy. Nếu JS lỗi thì nội dung vẫn hiện.
- **Hero (ngoại lệ duy nhất)**: HTML từ server đã hiện trong viewport trước khi hydrate. Để tránh nháy "hiện → ẩn → intro", root có class `obx-intro-pending`. CSS ẩn các phần tử intro khi có class này, kèm `animation: obx-intro-fallback 0s 2s forwards` để tự hiện lại nếu sau 2s JS vẫn chưa gỡ class. Timeline intro gỡ class ngay khi bắt đầu. Khi reduced motion thì không ẩn.

### 4.4 Curtain

- `CurtainOverlay` render trong `app/layout.tsx`, nằm ngoài `HeaderGate`. Bình thường là `null` hoặc `display: none`, không tải GSAP.
- `CurtainLink` (`href`, `children`, `className`):
  - Click thường (không modifier, button 0, cùng origin) thì `preventDefault`. Prefetch route bằng `router.prefetch`.
  - Gọi `curtainStore.cover()`: overlay `import('gsap')` động, xáo 3 màu từ palette, chạy **pha 1** (0.8s): 3 tấm radius 2em bay vào phủ màn hình theo choreography [SM §5.16]. Xong thì `router.push(href)`.
  - Modifier-click, chuột giữa hoặc khi đang ở trạng thái `covering`: để hành vi mặc định.
- Overlay theo dõi `usePathname()`. Pathname đổi khi đang `covered` thì chạy **pha 2** (1.25s bounce): các tấm bay ra, radius 2em → 0, overlay về 0 trong 0.8s slush, rồi `idle`.
- **Lối thoát**: sau 3s ở `covered` mà pathname chưa đổi thì tự chạy pha 2. Overlay không bao giờ chặn tương tác khi `idle` (`pointer-events: none`).
- Reduced motion: overlay màu `ink` fade in/out 0.3s.

### 4.5 Accessibility

- Mỗi phần tử được split có `aria-label` bằng text gốc; các wrapper do split tạo ra có `aria-hidden`.
- Wordmark SVG có `aria-hidden`, `h1` sr-only mô tả trang.
- Sticker và minh hoạ có `aria-hidden`. Bản sao trong marquee có `aria-hidden`.
- Cursor có `pointer-events: none`, `aria-hidden`.
- Tabs dùng `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, phím ←/→.
- Carousel: dot là `button` có `aria-label` + `aria-selected`; nút prev/next.
- Stack: thêm nút "Tiếp" / "Trước" để không bắt buộc phải kéo.
- Mọi phần tử tương tác có `:focus-visible` rõ ràng (viền 2px đen + offset).

## 5. Test

### 5.1 Unit (vitest, env node) — `_landing/data.test.ts`

- `cheapestPlanPrice(plans): number | null`: trả giá thấp nhất; mảng rỗng → `null`.
- `pickFeaturedBook(books, rand = Math.random): BookSummary | null`: chọn ngẫu nhiên trong các cuốn có `coverUrl`; không có cuốn nào → `null`. Test bằng `rand` cố định.
- `cycleColor(i, palette)`: xoay vòng, đúng với `i ≥ palette.length`.
- `loadLanding(fetcher)`: mỗi nguồn lỗi độc lập; `plans`/`categories` lỗi → fallback; `books` lỗi → `books: []`, `total: null`. Test bằng fetcher giả.

Motion không unit test, kiểm bằng trình duyệt (§5.3).

### 5.2 E2E — `e2e/tests/landing.spec.ts`

Chạy trên production build có sẵn của harness, không ghi DB.

1. `GET /` trả 200; `h1` chứa "Open Boox"; không có `console.error` hay `pageerror`.
2. Viewport 375×812: `document.documentElement.scrollWidth <= 375`.
3. Bấm CTA "Chọn gói mượn" thì URL thành `/plans`; overlay curtain bị gỡ hoặc `pointer-events: none` và một link trên `/plans` bấm được.
4. `reducedMotion: 'reduce'`: các phần tử `[data-anim-slant]` có opacity 1 sau khi cuộn tới (dùng `scrollIntoViewIfNeeded`). Hero hiện ngay khi load.
5. Bàn phím: Tab tới được tablist; ←/→ đổi `aria-selected`.

### 5.3 Checklist trình duyệt (in-app browser, chụp ở 1440 và 375)

Như §6. Kết quả ghi vào `handover.md`, kèm số `ScrollTrigger.getAll().length` trước và sau khi đi `/` → `/books` → back `/`.

## 6. Nghiệm thu

- [ ] Khung đen, các sheet cách nhau đều 12px (8px khi ≤767); radius 40/30/20/999 đúng chỗ; không gradient, không shadow.
- [ ] Chỉ có 2 ease (cộng `power3` cho cursor); không còn transition hay keyframe tự chế cũ.
- [ ] Intro đúng thứ tự: wordmark lăn → chars chạy from end → khối +0.5s → sticker random → nav trượt xuống.
- [ ] Nav: pill ẩn khi cuộn xuống, hiện khi cuộn lên (stagger 0.03); hover "+" reveal; mobile "+" mở menu.
- [ ] Có 5 marquee; nối vòng không giật; đảo chiều khi đổi hướng cuộn; chậm lại ở ≤991 và ≤479.
- [ ] Features: slant và card 3D chạy ở `top 80%` once; zig-zag đảo chiều; xuống 1 cột khi <768.
- [ ] Carousel kéo có quán tính, autoplay 4s, dừng khi hover và khi ra khỏi viewport; dot đồng bộ.
- [ ] Tabs: pill di chuyển bằng Flip khi click và hover; nền visual đổi màu; tự chuyển 1 lần khi cuộn tới.
- [ ] Stack "Cách hoạt động" kéo được, card sau scale/rotate; nút Tiếp/Trước hoạt động.
- [ ] Cursor pill có nhãn trên các phần tử `data-cursor`; không xuất hiện trên thiết bị cảm ứng.
- [ ] Hover nút: đảo màu với spring 0.5s.
- [ ] Curtain chạy từ `/` → `/plans`, `/books`, `/register`; modifier-click mở tab mới bình thường; back về `/` thì intro chạy lại; `ScrollTrigger.getAll().length` không tăng sau vòng đi-về.
- [ ] Reduced motion: mọi nội dung hiện ra, không 3D, không marquee chạy, curtain chỉ crossfade.
- [ ] Dấu tiếng Việt đúng ở display 160px và body.
- [ ] Không scroll ngang ở 375px.
- [ ] Tắt API: landing vẫn render (fallback gói và thể loại, tile sticker, không có card stat).
- [ ] Không có lỗi console ở dev và prod.
- [ ] `pnpm lint`, `pnpm typecheck`, test web (cũ + mới), `pnpm test:e2e` (3 spec cũ + landing), `pnpm build` đều xanh; `pnpm audit` không có advisory mới do `gsap` / `@gsap/react`.
- [ ] Kích thước JS route `/` (theo output của `next build`) ghi vào handover làm mốc.

## 7. Rủi ro & quyết định

| Rủi ro | Xử lý |
| --- | --- |
| Overlay curtain kẹt nếu `router.push` lỗi, bị redirect sang cùng pathname, hoặc lag | Timeout 3s tự chạy pha 2; `pointer-events: none` khi idle; e2e kiểm tra mục 3 |
| `/register` redirect khi đã đăng nhập (proxy) nên pathname đổi sang trang khác | Pha 2 chạy với mọi lần pathname đổi, không so với `href` |
| ScrollTrigger rò rỉ sau khi unmount landing | Mọi tween nằm trong `useGSAP`/`gsap.context`; kiểm số trigger ở checklist |
| Lenis xung đột với scroll của các trang khác | Lenis chỉ khởi tạo trong `landing-motion` và `destroy()` khi unmount |
| Font load muộn làm lệch SplitText/ScrollTrigger | Split và tạo trigger sau `document.fonts.ready`; refresh lại |
| Nội dung bị ẩn nếu JS lỗi | Trạng thái ẩn chỉ do GSAP đặt; hero có fallback CSS sau 2s (§4.3) |
| `horizontalLoop` là helper copy từ docs GSAP | Giữ nguyên, ghi nguồn ở đầu file, có test thủ công trong checklist |
