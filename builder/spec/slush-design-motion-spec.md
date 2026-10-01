# Slush.app — Design & Motion Spec

> Tài liệu cho coding agent dựng lại trang mới theo phong cách slush.app mà không cần xem lại trang gốc.
> Phương pháp phân tích: (1) tải HTML/CSS/JS veröffentlicht của slush.app bằng curl và đọc trực tiếp file JS custom (toàn bộ tham số motion đọc được từ source, không phải đo màn hình); (2) mở trang thật bằng trình duyệt headless ở viewport 1440×900, chụp ảnh và đọc computed styles; (3) đối chiếu với tài liệu `landing-ui-spec.md`, `DESIGN.md` có sẵn.
> Ngày phân tích: 2026-10-01. Viewport đối chiếu: 1440×900. Chiều cao trang: ~13.376px.

**Chú giải độ tin cậy**
- [XÁC NHẬN] — thấy trực tiếp trong code/JS/CSS/computed style/screenshot.
- [SUY LUẬN] — suy ra từ dấu hiệu gián tiếp (ghi rõ dấu hiệu).
- [KHÔNG CHẮC] — cần kiểm tra thêm.

---

## 1. Tổng quan

- **Mục đích trang**: landing page của Slush — ví tiền mã hoá trên blockchain Sui ("Your money. Unstuck."). Mục tiêu chính: tải app (extension/iOS/Android) + đăng ký waitlist thẻ. [XÁC NHẬN]
- **Đối tượng**: người dùng crypto/Gen-Z, quen ngôn ngữ meme/sticker. [SUY LUẬN — từ tone chữ, illustration và sản phẩm]
- **Cảm giác tổng thể (4 tính từ)**: *playful-bold* (nửa poster thể thao, nửa sticker Gen-Z), *sculptural* (chữ display khổng lồ như vật thể), *candy* (bảng màu kẹo trên nền pastel), *springy* (mọi chuyển động nảy có overshoot). [XÁC NHẬN từ visual + code]
- **Mô hình tương tác chính**: scroll-driven là chủ đạo (reveal on-enter, parallax scrub, marquee đảo chiều theo hướng cuộn) + smooth scroll quán trang (Lenis) + cursor-driven (custom cursor pill có nhãn) + click/drag (carousel kéo được, tab Flip) + chuyển trang SPA có curtain 3D (Barba). Không có pin/pinned section; không có horizontal-scroll section. [XÁC NHẬN]
- Hiệu ứng được quan tâm đặc biệt:
  - **Hero intro**: nav trượt xuống + wordmark "cuộn chữ" split-flap (SVG) + chars reveal + sticker Lottie rơi vào ngẫu nhiên. [XÁC NHẬN]
  - **Scroll section 2**: các feature zig-zag reveal bằng split-char/3D card + parallax ribbon/video intro. [XÁC NHẬN]
  - **Hover "danh sách"** (tương đương card carousel/testimonial ở Slush): card kéo-dọc được (Draggable + inertia, xếp chồng scale/rotate), cursor pill đổi nhãn theo vùng hover, nav pill hover reveals. [XÁC NHẬN]

---

## 2. Tech stack suy ra

| Công nghệ | Bằng chứng | Độ tin cậy |
| --- | --- | --- |
| **Webflow** (site builder + hosting CDN) | `data-wf-domain="slush.app"`, asset trên `cdn.prod.website-files.com`, class `w-*`, check `Webflow.env("editor")` trong JS | XÁC NHẬN |
| **jQuery 3.5.1** | `<script src=".../jquery-3.5.1.min.dc5e7f18c8.js">` (runtime mặc định Webflow) | XÁC NHẬN |
| **GSAP 3.12.7** core + **ScrollTrigger** + **CustomEase** + **Draggable** + **Observer** + **Flip** | thẻ `<script>` CDN jsdelivr, `gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase, Draggable, InertiaPlugin, Flip, Observer)` | XÁC NHẬN |
| **SplitText + InertiaPlugin** (plugin trả phí GSAP, bản unofficial) | `cdn.jsdelivr.net/gh/ilja-van-eck/personal/gsap/SplitText.min.js`, `InertiaPlugin.min.js` | XÁC NHẬN |
| **Lenis 1.1.14** (smooth scroll) | `unpkg.com/lenis@1.1.14/dist/lenis.min.js`; init `new Lenis({ lerp: 0.12 })`, nối với `gsap.ticker` | XÁC NHẬN |
| **Barba.js 2.9.7** (chuyển trang SPA) | `@barba/core@2.9.7`, `barba.init(...)` với namespace home/defi/guide/mobile-download | XÁC NHẬN |
| **Lottie-web 5.12.2** | `lottie.min.js`; 24 phần tử `[data-lottie]` trên homepage (sticker rocket/coin/wallet/smiley…) | XÁC NHẬN |
| **Slater.app** (host custom JS cho Webflow) | `assets.slater.app/slater/14111/42806.js` (file animation chính) + `46342.js` (geo-redirect UK) | XÁC NHẬN |
| **HubSpot Forms embed** | `js.hsforms.net/forms/embed/v2.js`, iframe form trong footer | XÁC NHẬN |
| CSS hiện đại: **`linear()` easing**, `100svh`, `overflow: clip` | computed style của nút chứa `transition-timing-function: linear(...)`; `min-height: calc(100svh - ...)` | XÁC NHẬN |
| Three.js / WebGL / shader | **Không thấy** bất kỳ lib 3D nào; ribbon 3D là asset render sẵn (ảnh/video đặt absolute trong `.home-hero-background`) | SUY LUẬN (dấu hiệu: không có script 3D; bg hero là div chứa media tĩnh) |
| Framer Motion / React | Không phải site React (Webflow + jQuery); không có Framer Motion | XÁC NHẬN |
| View Transitions API | Không dùng; chuyển trang do Barba + GSAP đảm nhiệm | XÁC NHẬN |
| CSS scroll-driven animation (`animation-timeline`) | Không dùng; mọi scroll effect là GSAP ScrollTrigger | XÁC NHẬN |

> Kết luận cho bản dựng mới: **GSAP (core + ScrollTrigger + CustomEase + Draggable + InertiaPlugin + Flip + SplitText) + Lenis** là bộ đủ và là "nguyên bản" của trang này. Nếu dùng Next.js/React, thay SplitText bằng `@gsap/react` + SplitText hoặc `motion` cho phần reveal.

---

## 3. Design tokens

### 3.1 Màu (đọc từ `:root` của CSS) [XÁC NHẬN]

| Token gốc | Hex | Vai trò |
| --- | --- | --- |
| `--color--dark` | `#000000` | Nền body (khung đen), chữ chính, viền, nút đặc |
| `--color--light` | `#ffffff` | Nền section trắng, fill pill nav, chữ trên nền đen |
| `--color--blue-100` | `#dceeff` | Nền hero + khu showcase (pastel sky) |
| `--color--blue-700` | `#4da2ff` | Ribbon 3D, tile marquee, card accent — màu thương hiệu chủ đạo |
| `--color--purple-800` | `#5c4ade` | Card QR download, tile footer, huy hiệu tròn |
| `--color--yellow-700` | `#ffd731` | Card newsletter/support, tile, sticker coin |
| `--color--orange-800` | `#fb4903` | Tile marquee "GET SLUSH", card stat, sticker rocket |
| `--color--violet-700` | `#e9ccff` | **Lilac** — thanh marquee thông báo, card quote, tile |
| `--color--green-700` | `#55db9c` | Card footer (mint), tile, sticker check |
| `--color--yellow-100` | `#ffefad` | Tông nhạt của vàng (wash trang trí) |
| `--color--violet-100` | `#f8f0ff` | Tông nhạt lilac |
| `--color--green-100` | `#99e9c4` | Tông nhạt mint |

Quy tắc dùng màu [XÁC NHẬN visual]: chữ gần như luôn đen trên mọi nền (kể cả cam, xanh); chữ trắng chỉ trong nút đen/tile đậm. Không dùng gradient ở bất kỳ đâu — mọi mặt là màu phẳng. Không dùng box-shadow cho UI; chiều sâu đến từ ribbon 3D render sẵn và quan hệ phân lớp trên nền đen.

### 3.2 Typography

Font gốc (thương mại, **không copy**) [XÁC NHẬN @font-face]:
- **Lateral** — variable 100–1000, dùng 800; CHỈ cho display. Fallback CSS: `Lateral, Impact, sans-serif`.
- **Aeonik Pro** — 500 và 700; toàn bộ UI/body/nav/nút.
- **GT America VF** — 100–900; chỉ thấy dùng cho class phụ `.body-card` (card xám `#f2f2f3`).

Font thay thế miễn phí, hỗ trợ tiếng Việt: display → **Barlow Condensed 800 + 800 italic** (khuyên dùng) hoặc Anton (không có italic); UI → **Be Vietnam Pro** (hoặc Inter/Satoshi). Tránh Bebas Neue/Oswald (dấu tiếng Việt kém).

Type scale (đo computed style ở 1440px) [XÁC NHẬN]:

| Cấp | Font | Size @1440 | Line-height | Ghi chú |
| --- | --- | --- | --- | --- |
| Wordmark hero | SVG letterform tùy biến (không phải text!) | khối chữ cao ~504px ≈ 35vw, 5 chữ cái | — | Mỗi chữ là `<svg viewBox="0 0 167 459">`; DOM có h1 sr-only 640px/0.75 cho SEO+a11y |
| Display section `.h-l` | Lateral 800, UPPERCASE | `10em` = **160px** (≈11.1vw) | **0.8** | `margin-bottom: -0.1em; padding-top: 0.08em` (nén quang học); ≤991px: 128px; ≤767px: ~99px |
| Heading lớn (tagline) `h2` | Aeonik Pro 500 | **64px** (4.44vw) | 1.0 | letter-spacing **−0.01em**; tách 2 span inline-block để animate riêng |
| Body | Aeonik Pro 500 | 16px | 1.25 | màu đen |
| Button label | Aeonik Pro 500, UPPERCASE | 16px | — | letter-spacing **+0.03em** (0.48px) |
| Marquee micro | Aeonik Pro, UPPERCASE | 12.8px (0.8em) | — | thanh thông báo; font-weight 700 [SUY LUẬN từ visual] |
| Cursor label | Aeonik Pro 700, UPPERCASE | 15px | — | nằm trong pill cursor |

Kỹ thuật chữ đặc trưng [XÁC NHẬN]:
- **Trộn thẳng + nghiêng trong cùng cụm**: tile marquee "GET SLUSH" và footer "DOWNLOAD SLUSH. / *THEN MAKE IT ALL HAPPEN.*" — dòng thẳng rồi dòng italic, hoặc xen từng từ (tile `marquee-i-1..4` là biến thể italic xen kẽ).
- **Chèn object giữa dòng display**: card QR download đặt inline giữa các từ trong khối "ALL THINGS SUI / ALL IN [QR] / SLUSH WALLET".
- **SplitText** mọi display text khi animate (words → chars, class `char`); luôn set `aria-label` cho phần tử gốc và `aria-hidden` cho các word-wrap.
- Line-height 0.8 + margin âm làm các dòng display gần chạm nhau — chủ ý thiết kế.

### 3.3 Spacing, radius, viền [XÁC NHẬN từ `:root` + computed]

```css
:root {
  /* spacing (em, gốc 16px) */
  --gap-xxs: .25em;  /* 4px  */
  --gap-xs:  .5em;   /* 8px  */
  --gap-s:   .75em;  /* 12px — cũng là --page-padding: khe đen giữa các sheet */
  --gap-sm:  1em;    /* 16px */
  --gap-m:   1.25em; /* 20px */
  --gap-ml:  1.5em;  /* 24px */
  --gap-l:   2em;    /* 32px */
  --gap-xl:  3em;    /* 48px */
  --gap-xxl: 4em;    /* 64px */

  --radius-container: 2.5em; /* 40px — bo góc khối nội dung lớn */
  /* đo thêm: card/tile box = 30px; card illustration ≈ 20px; QR card = 20px; pill = 1600px */
}
```

- Viền: **1px đen** cho pill/Ảnh card (tài liệu đo được 1px); nút tròn logo đo được **2px** — dùng 1–2px tuỳ kích thước, nhất quán "hand-cut outline". [XÁC NHẬN]
- Shadow: không dùng cho UI. [XÁC NHẬN — DESIGN.md + khảo sát CSS]
- Hero content: `min-height: calc(100svh - page-padding*2)`, gap 40px giữa các hàng. [XÁC NHẬN]
- Grid: không lưới cứng — các "sheet" full-bleed xếp dọc; feature row = 2 cột 50/50; footer = 2 cột lớn + lưới tile. [XÁC NHẬN visual]

### 3.4 Breakpoints & layout thay đổi [XÁC NHẬN media queries; chi tiết từng section một phần SUY LUẬN]

- Media queries trong CSS: **479px, 767px, 991px** (max) và **1920px** (min, tăng kích thước cho màn lớn). JS dùng thêm mốc điều hành: `BREAKPOINT = 768` (slider/tabs), nav desktop ≥992px.
- ≤991px: nav pill dồn vào nút "+"; `.h-l` còn 128px.
- ≤767px: feature zig-zag xuống 1 cột (visual trên, text dưới) [SUY LUẬN từ visual + quy luật]; marquee chậm đi (hệ số 0.5; <479px hệ số 0.25) [XÁC NHẬN code]; `.h-l` ~99px.
- ≤479px: mọi thứ 1 cột, display chữ co theo em. [SUY LUẬN]

---

## 4. Cấu trúc trang

Thứ tự section từ trên xuống (đối chiếu screenshot + DOM, 1440px) [XÁC NHẬN trừ khi ghi chú]:

| # | Section | Nền | Layout & kỹ thuật |
| --- | --- | --- | --- |
| 0 | **Pencil banner** (marquee thông báo) | lilac `#e9ccff` | full-bleed, cao ~20px, chữ 12.8px UPPER lặp "…waitlist is live"; marquee GSAP vô hạn |
| 1 | **Nav** (fixed) | trên nền trong suốt | trái: logo tròn viền đen 40px; phải: 6 nav pill trắng viền đen (GET STARTED…DOWNLOAD) + nút tròn "+" + CTA đen "LAUNCH APP"; scroll xuống → pill trượt lên biến mất (chỉ còn logo + "+" + CTA) |
| 2 | **Hero** | sky `#dceeff` (card bo 40px nổi trên nền đen) | wordmark SVG 5 chữ + tagline 64px + 2 CTA pill (1 secondary trắng, 1 icon-leading Chrome); ribbon 3D xanh render sẵn đặt absolute `top:-8%` phủ toàn hero; 4 sticker Lottie (rocket, smiley, coin, wallet) đè lên chữ |
| 3 | **Showcase thiết bị** | liền hero (sky) | hàng device: **1 video** `<video autoplay loop muted playsinline>` render app trong mockup + các cặp mockup tĩnh ↔ body text 16px; section này cùng khối với hero (cao ~2624px) |
| 4 | **Feature zig-zag** ×3 | trắng | 2 cột 50/50: display `.h-l` 2 dòng ("SIMPLE, DIRECT EXECUTION") + body + (CTA) ↔ card minh hoạ nền accent (lilac/blue/yellow) viền đen 1px bo 20px; hàng sau đảo chiều |
| 5 | **Display + QR** | trắng | display 3 dòng ("ALL THINGS SUI / ALL IN [QR-CARD] / SLUSH WALLET"), card QR indigo `#5c4ade` bo 20px chèn inline; sticker rải quanh |
| 6 | **CTA banner + Carousel** | trắng | hàng tile CTA màu (box 30px: white→orange→blue lặp) + carousel card dọc giữa màn hình: card accent bo 30px, tiêu đề display italic ở đáy; **autoplay 4s**, kéo được (inertia), dot pagination 4 dot xám |
| 7 | **Marquee "GET SLUSH"** | **đen** (khung) | 2 hàng tile bo 30px chạy ngược cấu trúc màu (white/orange/blue và blue/yellow/green/violet), chữ display đen, xen italic, sticker đè lên tile |
| 8 | **Tabs** (Mobile/Web/Extension) | trắng | nav tab pill: tab active = pill đen chữ trắng, bg pill chuyển bằng **Flip**; panel: visual trái (bg đổi `#E9CCFF`→`#FFD731`→`#55DB9C`) + text phải (display + para + link) |
| 9 | **Testimonials** | trắng | trái: display italic "DON'T BELIEVE US?" + subhead 24px + CTA đen "JOIN THE MILLIONS ↗"; phải: **stacking slider kéo ngang** — card quote lilac (title 24px, quote, tên ở đáy) xen card stat cam ("TRUSTED BY MILLIONS" display italic + illustration), bo 30px viền đen |
| 10 | **Persona cards** ×3 | trắng | 3 card ngang yellow/lilac/blue, tiêu đề display italic 2 dòng + CTA nhỏ + illustration góc (giữ nguyên theo tài liệu đo của bạn) [XÁC NHẬN theo `landing-ui-spec.md`; tôi không chụp riêng section này] |
| 11 | **Ecosystem logo marquee** | đen (khung) | tile vuông ~249px bo 30px, màu blue→yellow→green→violet lặp, logo ở giữa, chạy ngang vô hạn |
| 12 | **Newsletter + Support** | đen (khung) | 2 card vàng lớn cạnh nhau: (a) headline + input pill trắng viền đen + nút đen SUBSCRIBE + checkbox đồng ý (form HubSpot ẩn sync); (b) 2 nút pill đen "GET SUPPORT" / "ZENDESK SUPPORT ↗" |
| 13 | **Footer** | đen (khung) | hàng marquee tile (orange/blue) + huy hiệu tròn indigo chứa logo; dưới: 2×2 tile trắng bo 30px (social: Discord, X, Instagram, YouTube) + card mint lớn bo 40px: slogan display 2 dòng (thẳng + nghiêng), menu cột phải (24px? ~ 20px UPPER), link legal nhỏ, copyright |

Kỹ thuật bố cục đáng chúý [XÁC NHẬN]: toàn bộ nội dung nằm trong `.main-w { overflow: clip }` trên nền đen body — tạo hiệu ứng "tấm card lớn bo góc"; các band trắng/sky là section trong suốt có inner box màu; các band "khung đen" để lộ nền body. Sticker/QR dùng absolute/inline chen giữa chữ; ribbon hero absolute phủ, chữ z-index cao hơn.

---

## 5. Motion spec

> Toàn bộ số liệu dưới đây đọc **trực tiếp từ file JS custom** của trang (không phải đo ước lượng), nên_duration/easing/stagger đều là giá trị đúng như trang chạy. Mỗi mục ghi trigger, thuộc tính, tham số, orchestration, cách dựng lại bằng GSAP, và độ tin cậy.
> Hai easing dùng chung toàn trang [XÁC NHẬN]:
> - `slush` = `cubic-bezier(0.65, 0.05, 0, 1)` — giảm tốc mượt, không overshoot.
> - `slush-bounce` — spring có overshoot, đỉnh ~1.1424 tại 24.5% tiến độ, tụt ~0.9842 tại 58.8%, về 1. Biểu thức CSS tương đương (đọc từ computed style):
>   `linear(0 0%, 0.5737 7.6%, 0.8382 11.87%, 0.9463 14.19%, 1.0292 16.54%, 1.0886 18.97%, 1.1258 21.53%, 1.137 22.97%, 1.1424 24.48%, 1.1423 26.1%, 1.1366 27.86%, 1.1165 31.01%, 1.0507 38.62%, 1.0219 42.57%, 0.9995 46.99%, 0.9872 51.63%, 0.9842 58.77%, 1.0011 81.26%, 1 100%)`
> - Defaults toàn cục: `gsap.defaults({ ease: "slush", duration: 0.525 })`. [XÁC NHẬN]

### 5.1 Page intro (load) — hero

- **Vị trí**: hero (mọi trang); bản home có thêm sub-elements.
- **Trigger**: load, sau khi Barba transition xong (home lần đầu: delay ~0.1–0.15s). Lenis bị khoá trong chuyển trang, mở lại khi intro bắt đầu.
- **Chuỗi orchestration** [XÁC NHẬN]:
  1. Nav trượt xuống: `#navContainer` y → 0%, duration **0.8s**, ease `slush`, **delay 0.6s** (trạng thái đầu y:100% trong CSS [SUY LUẬN — giá trị cuối "0%" thấy trong code]).
  2. Hero display text: SplitText chars, từ `{ x: -0.25em, autoAlpha: 0 }` → `{ x: 0, autoAlpha: 1 }`, duration **0.65s**, **stagger 0.015s mỗi char, from: "end"** (chạy từ chữ cuối về đầu), ease `slush-bounce`, bắt đầu tại t=0 của timeline.
  3. Sau **+0.5s**: các phần tử `[data-load-stagger]` (tagline, hàng CTA) từ `{ y: 3em, autoAlpha: 0 }` → bình thường, duration **1s**, stagger **0.1s**, ease `slush-bounce`.
  4. Song song với bước 3: sticker Lottie từ `{ scale: 0.2, rotate: -90°, autoAlpha: 0 }` → bình thường, duration **1s**, **stagger 0.1s, from: "random"**.
  5. Phần tử `[data-hero-fade]` fade in song song.
- **Home-only**: `[data-home-sub-el]` từ `{ y: 2em, autoAlpha: 0 }`, stagger **0.3s**, delay **1.5s**, duration 1s. [XÁC NHẬN]
- **Wordmark "split-flap"**: mỗi vị trí chữ cái có 2 tầng SVG xếp dọc trong khung `overflow: clip`, cao 35em; intro cuộn tầng: chữ cái chạy `yPercent: -100` stagger **0.15s**, duration **1.25s**, tầng thứ hai offset +0.5s → cảm giác chữ "lăn" như bảng flap sân bay. [XÁC NHẬN cơ chế + tham số; cách dựng: 2 bản chữ xếp dọc trong khung clip]
- **Dựng lại**:
  ```js
  gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText);
  CustomEase.create("slush", "0.65,0.05,0,1");
  CustomEase.create("slush-bounce", "M0,0 C0.076,0.574 0.119,0.838 ..."); // hoặc dùng linear() ở trên
  const tl = gsap.timeline({ delay: 0.15, defaults: { ease: "slush-bounce" } });
  tl.to(chars, { x: 0, autoAlpha: 1, duration: 0.65, stagger: { each: 0.015, from: "end" } })
    .from(subEls, { y: "3em", autoAlpha: 0, duration: 1, stagger: 0.1 }, "<+=0.5")
    .from(stickers, { scale: 0.2, rotate: -90, autoAlpha: 0, duration: 1, stagger: { each: 0.1, from: "random" } }, "<");
  gsap.to("#nav", { yPercent: 0, ease: "slush", duration: 0.8, delay: 0.6 });
  ```

### 5.2 Nav ẩn/hiện theo hướng scroll

- **Vị trí**: nav pill items (`.nav-inner-li`), chỉ desktop ≥992px.
- **Trigger**: scroll direction — dùng delta scrollY, dead-zone 10px, chỉ tính khi scrollY > 50px; ghi `data-scrolling-direction`/`data-scrolling-started` lên body. [XÁC NHẬN]
- **Animate**: xuống → `yPercent: -300`, duration **0.75s**, ease `slush-bounce`, **stagger 0.03s from start**; lên → `yPercent: 0`, cùng tham số, stagger **from end**. [XÁC NHẬN]
- **Orchestration**: logo + "+" + CTA luôn giữ nguyên; chỉ pill nav ẩn/hiện.
- Micro liên quan: hover nút "+" trên desktop cũng **reveal** dãy pill (cùng tham số); rời khu nav → ẩn lại. Mobile: click "+" mở menu — pill trượt vào ngang từ `xPercent: 300` (stagger from end), nút **rotate 90°**, gạch ngang của dấu "+" `scaleX: 0`. [XÁC NHẬN]

### 5.3 Smooth scroll (Lenis)

- Toàn trang; `lerp: 0.12`, cập nhật ScrollTrigger qua event scroll, chạy trong `gsap.ticker` với `lagSmoothing(0)`. Bị `stop()` trong lúc chuyển trang và `start()` khi intro hero bắt đầu. [XÁC NHẬN]

### 5.4 Custom cursor (cursor-driven)

- **Vị trí**: toàn trang; phần tử `.cursor` — pill trắng viền đen 1.5px, radius 1500px, chữ 15px/700 UPPER, ẩn mặc định (`opacity: 0`), chỉ hiện khi rê lên mục tiêu `[data-cursor]` (giá trị nhãn: "download for chrome", "download for arc"…).
- **Trigger**: mousemove toàn cửa sổ.
- **Animate** [XÁC NHẬN]: bám con trỏ bằng `gsap.quickTo` cho x/y, ease **power3** (quickTo mặc định 0.5s); khi cursor tới gần mép phải → `xPercent` 6 → −100 (lật sang bên kia), gần đáy → `yPercent` 50 → −120, cả hai tween **0.9s power3**; đổi nhãn → reflow pill.
- **Dựng lại**: `quickTo` + đổi `xPercent/yPercent` theo khoảng cách mép; ẩn khi không có mục tiêu.

### 5.5 Marquee vô hạn + phản ứng hướng scroll (7 instance)

- **Vị trí**: pencil banner (lilac), CTA tile, "GET SLUSH" ×2 hàng, ecosystem tiles, footer marquee… [XÁC NHẬN]
- **Trigger**: tự chạy (linear infinite) + ScrollTrigger phản ứng hướng cuộn.
- **Tham số** [XÁC NHẬN]: vòng lặp `xPercent: -100` ease linear, repeat −1; duration cơ sở = `data-marquee-speed` (**15–25s**), scale theo tỉ lệ bề rộng nội dung/viewport và hệ số thiết bị (desktop 1, ≤991px 0.5, ≤479px 0.25); nhân đôi nội dung (`duplicate: 2`); `totalProgress(0.5)` để nối vòng liền mạch.
- **Scroll-reactive**: khi cuộn lên, `timeScale` đảo dấu (marquee chạy ngược chiều) — đổi trạng thái `data-marquee-status: normal|inverted`; đồng thời bề rộng container trượt thêm ±`data-marquee-scroll-speed` = **10vw** scrub tuyến tính theo scroll (start "top bottom" → end "bottom top").
- **Dựng lại**: nhân đôi track, tween xPercent −50 (nếu nhân đôi 1 lần) linear infinite + `ScrollTrigger.create({ onUpdate: self => tween.timeScale(self.direction === 1 ? 1 : -1) })` + một timeline scrub riêng cho drift ±10vw.

### 5.6 Text reveal on scroll — slant chars

- **Vị trí**: các display heading giữa trang `[data-anim-slant]` (7 phần tử). [XÁC NHẬN]
- **Trigger**: ScrollTrigger `start: "top 80%"`, **once**.
- **Animate**: SplitText words→chars; từ `{ x: -0.25em, autoAlpha: 0 }` → 0; duration **0.65s**, ease `slush-bounce`, stagger **0.015s from "end"**. A11y: `aria-label` gốc + `aria-hidden` cho word spans. [XÁC NHẬN]

### 5.7 Heading reveal 3D (lines)

- **Vị trí**: `[data-heading-reveal]` (5 phần tử). [XÁC NHẬN]
- **Trigger**: `top 80%`, once.
- **Animate**: SplitText lines; parent `perspective: 1000px`; từng line từ `{ z: 5em, rotateY: -45°, autoAlpha: 0 }` → 0; duration **0.85s**, ease `slush-bounce`, **stagger 0.15s**. [XÁC NHẬN]

### 5.8 Card reveal 3D

- **Vị trí**: `[data-card-reveal="card"]` trong `[data-card-reveal="wrap"]` (12 thẻ). [XÁC NHẬN]
- **Trigger**: wrap `top 80%`, once.
- **Animate**: từ `{ x: 5em, z: 20em, rotateY: -30°, scale: 0.75, autoAlpha: 0 }` → bình thường; duration **0.85s**, ease `slush-bounce`, stagger `{ amount: 0.2 }`. [XÁC NHẬN]

### 5.9 Parallax scrub

- **Vị trí**: `[data-parallax="trigger"]` → target `[data-parallax="target"]` (5 cặp; ví dụ ribbon hero, video device, minh hoạ feature). [XÁC NHẬN]
- **Trigger**: scrub 1 (mặc định), `start: "top bottom"` → `end: "bottom top"` (clamp; có thể override bằng attribute, ví dụ "top top" → "bottom top-=20%").
- **Animate**: `yPercent` (hoặc `xPercent` nếu direction=horizontal) từ `data-parallax-start` → `data-parallax-end`; giá trị thực trên trang: **30→−60, 20→0, 0→−30, 0.01→20**. Disable theo thiết bị qua `data-parallax-disable="mobile|mobileLandscape|tablet"`. [XÁC NHẬN]

### 5.10 Device video intro

- **Vị trí**: video mockup trong showcase. [XÁC NHẬN]
- **Trigger**: `top center`, once.
- **Animate**: từ `{ scale: 0.75, yPercent: 40, autoAlpha: 0 }` → bình thường; duration **1.2s**, ease `slush-bounce`. Video tự chạy `autoplay loop muted playsinline`. [XÁC NHẬN]

### 5.11 Tabs (Flip + stagger panel)

- **Vị trí**: section tabs Mobile/Web/Extension. [XÁC NHẬN]
- **Trigger**: click tab (và **hover** tab cũng chuyển pill), auto-advance: ScrollTrigger `center 75%` once tự click tab thứ 2 khi vào khung. [XÁC NHẬN]
- **Animate**: nền pill active di chuyển giữa các tab bằng **Flip**, duration **0.5s**, ease `slush`; panel cũ out: text `{ autoAlpha: 0, yPercent: 10 }`, visual `{ autoAlpha: 0, xPercent: -15 }`; chiều cao panel tween theo panel mới; panel mới in tại t=0.2s: chars stagger 0.015 from end (0.65s), para + link từ `{ x: -3em }` (+0.075s), visual-item `{ yPercent: 10 → 0 }`, nền visual **đổi màu** (`#E9CCFF` → `#FFD731` → `#55DB9C`) ngay tại 0. Tất cả ease `slush`, duration 0.65. [XÁC NHẬN]

### 5.12 Centered carousel (kéo được + autoplay)

- **Vị trí**: card carousel màu. [XÁC NHẬN]
- **Trigger**: autoplay `data-slider-autoplay-duration: 4` (chỉ chạy khi trong viewport — ScrollTrigger bật/tắt; dừng khi hover, chạy lại khi rời), click slide/bullet, nút prev/next, drag.
- **Animate**: dùng helper `horizontalLoop` (GSAP helper chính thức) — vòng lặp vô hạn seamless, `draggable + InertiaPlugin`, `center: true`; chuyển slide: `toIndex(...)` duration **0.725s**, ease `slush-bounce`; slide active + bullet active sync class, bullet có `aria-selected`. [XÁC NHẬN]

### 5.13 Testimonial stacking slider (drag xếp chồng)

- **Vị trí**: card testimonials ("DON'T BELIEVE US?"). [XÁC NHẬN]
- **Trigger**: drag ngang (Draggable type x, có bounds, InertiaPlugin, snap về bề rộng card).
- **Animate**: card phía sau tụt lại `x` theo tiến độ kéo, **scale → 0.6** và **rotation → −10°** (tỉ lệ với số card đã kéo qua), transform-origin center. Không có autoplay. [XÁC NHẬN]

### 5.14 Lottie sticker (scroll-fired & hover-replay)

- **Vị trí**: 24 sticker `[data-lottie]` (rocket, coin, wallet, smiley, check…). [XÁC NHẬN]
- **Trigger**: vào viewport sớm — ScrollTrigger `start: "top bottom+=50%"`, once; biến thể `data-lottie="hover"`: đứng yên frame 0, **play khi mouseenter parent, reset khi mouseleave** (trang chủ hiện không dùng biến thể hover). [XÁC NHẬN]
- **Animate**: play toàn bộ animation JSON một lần, loop=false.

### 5.15 Hover micro-interactions

- Nút/nav pill: CSS transition **`all 0.5s`** với easing spring `linear(...)` ở trên (nút tròn logo 1s) — hover đổi nền (trắng↔đen), màu chữ, transform nhẹ. [XÁC NHẬN computed style]
- Không có magnetic button, không có image-follow hover trong code đã tải. [XÁC NHẬN — phủ định có chủ đích]
- Custom cursor đổi nhãn khi hover mục tiêu (mục 5.4). [XÁC NHẬN]

### 5.16 Chuyển trang (Barba + curtain 3D)

- **Trigger**: click link nội bộ (Barba sync mode); `lenis.stop()` khi rời trang.
- **Chuỗi** [XÁC NHẬN]:
  1. Trang cũ được bọc vào container fixed `clip-path: inset(0 round 2em)`.
  2. **3 tấm màu cố định** (`.page-transition-el`, full viewport, radius 2em) được **xáo trộn màu từ palette** (blue/yellow/lilac/green/orange/violet) mỗi lần chuyển.
  3. Choreography 3D: tấm 1 bay ra trái (xPercent −100→−300, rotateY 22.5°→67.5°, z −85vw→−25vw), tấm 2, 3 tương tự bên phải; trang mới bay vào từ `{ rotateY: −45°, xPercent: 200%, z: −50vw }` → 0; phase 1 **0.8s**, phase 2 **1.25s**, ease `slush-bounce`; sau đó radius 2em→0 và overlay về 0 trong **0.8s** ease `slush`.
  4. Trang mới bắt đầu intro (mục 5.1) khi tấm cuối còn đang bay; kết thúc: clearProps, `ScrollTrigger.refresh()`.
  5. `prefers-reduced-motion`: thay bằng crossfade 1s đơn giản. [XÁC NHẬN]

---

## 6. "Motion language" chung

1. **Hai ease duy nhất** cho mọi thứ: `slush` (0.65, 0.05, 0, 1) cho chuyển mượt có chủ đích (nav, Flip, transition cuối) và `slush-bounce` (spring overshoot ~14% đỉnh, 1 nhịp phụ) cho mọi thứ "vật lý" — chữ, card, sticker. Đây là "chữ ký" lớn nhất của trang. [XÁC NHẬN]
2. **Duration điển hình**: micro/chars 0.5–0.7s; reveal khối 0.85–1.2s; wordmark/intro 1.25s; marquee 15–25s/vòng. Default 0.525s. [XÁC NHẬN]
3. **Nhịp stagger**: chữ 0.015s/char (from end — chữ chạy từ cuối cụm), phần tử khối 0.1–0.3s, card 0.2s tổng, nav pill 0.03s. Stagger from "end"/"random" được ưa chuộng để phá đều đặn. [XÁC NHẬN]
4. **Hướng chuyển động**: vào từ trái/dưới với khoảng cách rất nhỏ tính bằng **em** (−0.25em chữ, 2–3em khối) — dịch ngắn + overshoot mạnh mới ra cảm giác "nảy"; 3D reveal (rotateY −30…−45°, z 5–20em, perspective 1000) tạo chiều sâu "sticker dựng đứng". [XÁC NHẬN]
5. **Cảm giác "đắt" đến từ**: cùng một bộ ease dùng nhất quán 100%; marquee phản ứng chiều cuộn (trang "sống" theo tay người dùng); intro orchestration 5 lớp (nav → chữ → khối → sticker random → fade); chuyển trang curtain 3D xáo màu palette; cursor-pill có nhãn ngữ cảnh. [XÁC NHẬN]

---

## 7. Hiệu năng & khả năng truy cập

- **Thuộc tính animate**: gần như chỉ `transform` (x/yPercent, scale, rotateY, z) + `opacity/autoAlpha`; đổi màu nền tab là ngoại lệ duy nhất; không tween layout. `perspective` set tĩnh trên parent heading. [XÁC NHẬN]
- **will-change**: chỉ 1 chỗ trong toàn bộ CSS — trang không lạm dụng; GSAP tự quản lý transform. [XÁC NHẬN]
- **Keyframes CSS**: chỉ 1 (`spin` — loader); mọi motion khác là JS. [XÁC NHẬN]
- **prefers-reduced-motion**: xử lý hệ thống qua `gsap.matchMedia()` — mọi init nhận điều kiện `reduceMotion`; giảm về: stagger 0, không 3D, lottie dừng frame 0, chuyển trang crossfade, marquee đặt lại tốc độ. [XÁC NHẬN] (Parallax toàn cục không thấy nhánh reduce — [KHÔNG CHẮC] có bị tắt khi reduce hay không.)
- **A11y**: SplitText set `aria-label` + `aria-hidden` cho word wrap; h1 sr-only 640px mô tả wordmark; bullet carousel có `aria-controls`/`aria-selected`; cursor `pointer-events: none`. [XÁC NHẬN]
- **Media nặng**: hero ribbon = ảnh render tĩnh; 1 video autoplay muted loop playsinline; chỉ 2 ảnh có `loading="lazy"` (đa số eager) — với bản mới nên lazy toàn bộ dưới fold. [XÁC NHẬN số liệu; khuyến nghị là của tôi]
- **Mobile**: marquee chậm 0.5×/0.25×, nav pill gộp menu, parallax có thể tắt theo thiết bị qua attribute, slider touch-action none khi drag. [XÁC NHẬN]

---

## 8. Prompt sẵn dùng cho coding agent

```text
Build a landing page "LẬT" (book rental/buy app) that reproduces the design & motion language of
slush.app — a Webflow+GSAP site I have fully specified below. Do not copy Slush's logo, copy,
illustrations or fonts. Vietnamese content, must render Vietnamese diacritics correctly.

## Stack
- Next.js (App Router) + Tailwind CSS, TypeScript.
- Motion: GSAP 3 (core, ScrollTrigger, CustomEase, Draggable, InertiaPlugin, Flip, SplitText via
  @gsap/react or manual) + Lenis smooth scroll (lerp 0.12, driven by gsap.ticker, lagSmoothing(0)).
- No WebGL. 3D ribbon = pre-rendered WebP/video asset. No CSS scroll-driven animations.

## Design tokens (CSS variables)
--frame:#000000; --ink:#000000; --paper:#ffffff; --sky:#dceeff;
--blue:#4da2ff; --violet:#5c4ade; --yellow:#ffd731; --orange:#fb4903;
--lilac:#e9ccff; --mint:#55db9c; --yellow-100:#ffefad; --violet-100:#f8f0ff; --green-100:#99e9c4;
--gap-xxs:4px --gap-xs:8px --gap-s:12px --gap-sm:16px --gap-m:20px --gap-ml:24px --gap-l:32px
--gap-xl:48px --gap-xxl:64px; --page-padding:12px (black gutter between sheets);
--r-sheet:40px; --r-box:30px; --r-card:20px; --r-pill:999px; borders: 1px solid #000 (2px on
circular icon buttons); no gradients, no box-shadows.
Fonts (Google, subset=vietnamese): display = "Barlow Condensed" 800 + italic (uppercase,
line-height 0.8, margin-bottom -0.1em); UI = "Be Vietnam Pro" 500/700.
Type scale @1440: wordmark block ≈35vw tall (render app name as SVG letterforms stacked in an
overflow-clip frame, two layers per letter for the roll intro; keep an sr-only h1); section
display 160px (128px ≤991, 99px ≤767); heading 64px/1.0 letter-spacing -0.01em; body 16px/1.25;
buttons 16px 500 uppercase ls 0.03em; marquee micro 13px; black text on every accent background.

## Easing & durations (the site's motion DNA)
Create exactly two custom eases and use them everywhere:
- "slush" = cubic-bezier(0.65, 0.05, 0, 1)
- "slush-bounce" = spring with ~14% overshoot at 24.5% progress, dip to 0.984 at 58.8%:
  linear(0 0%, 0.5737 7.6%, 0.8382 11.87%, 0.9463 14.19%, 1.0292 16.54%, 1.0886 18.97%,
  1.1258 21.53%, 1.1424 24.48%, 1.1366 27.86%, 1.1165 31.01%, 1.0507 38.62%, 1.0219 42.57%,
  0.9995 46.99%, 0.9872 51.63%, 0.9842 58.77%, 1.0011 81.26%, 1 100%)
GSAP defaults: ease "slush", duration 0.525. CSS button transitions: all 0.5s with the same
linear() spring. Animate transform/opacity only. Respect prefers-reduced-motion everywhere
(no 3D, no stagger, marquee slow/static, Lottie stopped at frame 0, crossfade page changes).

## Page structure (black body frame, sheets with 12px black gutters, overflow clip)
0. Announcement marquee, lilac bg, 20px tall, 13px uppercase text, infinite loop.
1. Fixed nav: circular logo (2px black border) left; white pill links + circular "+" + black
   "LAUNCH APP" pill right. On scroll down (>50px) pills slide up & hide (yPercent -300,
   0.75s slush-bounce, stagger 0.03 from start); on scroll up they return (stagger from end).
   Desktop only. "+" hover reveals pills; on mobile "+" opens fullscreen menu (pills slide in
   from xPercent 300, button rotates 90°).
2. Hero (sky sheet, radius 40px): giant SVG-letter wordmark with split-flap roll intro (each
   letter layer yPercent -100, stagger 0.15, duration 1.25, second layer +0.5s); display text
   char reveal from x:-0.25em (0.65s, stagger 0.015 from end); sub-elements from y:3em (1s,
   stagger 0.1, at +0.5s); sticker Lotties from scale .2/rotate -90 (1s, stagger .1 from random);
   nav slides down 0.8s slush delay 0.6s. Parallax 3D ribbon behind (yPercent 30→-60 scrub).
3. Device showcase: looping muted video, scales in from {scale:.75, yPercent:40, autoAlpha:0}
   1.2s slush-bounce at "top center" once + static mockup/text pairs.
4. Three zig-zag feature rows (2 cols 50/50, alternate): display heading char-reveal at top 80%
   once + 3D card reveal (from x:5em, z:20em, rotateY:-30, scale:.75 → 0.85s slush-bounce,
   stagger amount 0.2) on illustration cards (accent bg, 1px black border, radius 20px).
5. Display block with inline QR download card (violet #5c4ade) between words.
6. Card carousel: infinite centered loop, draggable + inertia, autoplay 4s (pauses on hover and
   off-screen), dot pagination with aria-selected, slide change 0.725s slush-bounce.
7. "GET APP" marquee on black frame: two rows of colored tiles (radius 30px) mixing upright and
   italic display text, opposite directions, speed 15–25s/loop scaled by content width
   (×0.5 ≤991px, ×0.25 ≤479px), direction flips with scroll direction, plus ±10vw scroll-scrubbed drift.
8. Tabs (mobile/web/e-reader): pill background moves with Flip 0.5s slush (on click AND hover);
   panels: old out {autoAlpha:0, yPercent:10}, new chars stagger 0.015 from end, para/link from
   x:-3em (+75ms), visual bg color swap; auto-advance once at "center 75%".
9. Testimonials: heading + horizontally draggable stacked cards (scale→0.6, rotate→-10° behind,
   snap to card width, inertia).
10. Three persona cards (yellow/lilac/blue).
11. Partner logo marquee on black frame (tiles radius 30px, color cycle blue→yellow→green→violet).
12. Two yellow cards: newsletter (pill input + black SUBSCRIBE + consent checkbox) and support.
13. Footer on black frame: marquee tiles + indigo round badge; 2×2 white social tiles (radius 30px);
    big mint card with slogan (upright line + italic line), menu, legal links.

## Global systems
- Custom cursor: white pill (1.5px black border, radius 1500px, 15px 700 uppercase label),
  follows pointer via gsap.quickTo (power3), flips xPercent 6→-100 near right edge and
  yPercent 50→-120 near bottom (0.9s power3), shows a data-cursor label on hover targets,
  pointer-events none.
- Scroll reveals: slant char reveal (above), 3D line reveal for big headings (from z:5em,
  rotateY:-45°, perspective 1000, 0.85s, stagger 0.15).
- Parallax: data-attribute driven (yPercent start→end, scrub 1, top bottom→bottom top),
  disable per device via attribute.
- SplitText hygiene: set aria-label on the source element, aria-hidden on word wrappers.
- Page transitions (optional but characteristic): Barba-style — wrap old page in
  clip-path inset(0 round 2em), fly 3 palette-colored panels with 3D rotateY/xPercent/z
  choreography (0.8s then 1.25s slush-bounce), new page enters from rotateY -45°/xPercent 200%/z
  -50vw, radius 2em→0; start next page intro before panels finish; crossfade under reduced motion.

## Acceptance checklist (self-verify before finishing)
- [ ] Black frame + rounded sheets with uniform 12px gutters; radius 40/30/20/999px used correctly.
- [ ] Exactly two eases; every animation uses one of them (or power3 for cursor).
- [ ] Hero intro orchestration: nav → chars (from end) → blocks (+0.5s) → random stickers; wordmark roll.
- [ ] Nav pills hide on scroll down / return on scroll up with 0.03s stagger.
- [ ] ≥3 marquees; direction flips with scroll; content duplicated seamlessly.
- [ ] Feature rows: char reveal + 3D card reveal at top 80% once; zig-zag alternates; 1 column <768px.
- [ ] Carousel draggable with inertia + 4s autoplay + dots; tabs use Flip; testimonials stack-drag.
- [ ] Custom cursor with labels; buttons hover invert in 0.5s spring CSS transition.
- [ ] prefers-reduced-motion degrades everything; Vietnamese diacritics correct in display + body fonts;
      no horizontal overflow at 375px; transform/opacity-only animations.
```

---

## 9. Những gì còn thiếu

Các điểm [KHÔNG CHẮC] và dữ liệu cần bổ sung để nâng độ chính xác:

1. **Parallax dưới `prefers-reduced-motion`** — code parallax toàn cục không thấy nhánh reduce; cần kiểm tra thủ công (DevTools → Rendering → Emulate prefers-reduced-motion) xem có chạy không.
2. **Trạng thái đầu của nav khi load** (y:100% trong CSS?) — chỉ thấy giá trị cuối `y: 0%` trong timeline; kiểm tra class CSS `#navContainer` trước khi JS chạy.
3. **Section persona cards & tabs ở mobile 375px** — tôi chưa chụp riêng ở viewport này; cần screenshot 375px để xác nhận thứ tự stack và kích thước chữ thực tế.
4. **Font-weight của chữ marquee micro** (12.8px) — đo từ hình là 700 nhưng chưa bóc được class `p-m` chính xác; kiểm tra computed style.
5. **Tham số phụ của tile marquee footer** (hàng nào direction nào, tốc độ từng hàng 15/20/25 gán cho hàng nào) — trong HTML có 7 marquee; cần map từng instance tới section nếu muốn giống 100%.
6. **Nội dung animation JSON của Lottie** (thời lượng từng sticker) — không đọc được từ HTML; nếu cần giống hệt, hãy lưu 1–2 file `.json` từ CDN của họ về đo `totalFrames/frameRate` (chỉ để tham khảo timing, không dùng lại asset).
7. **Hành vi drag carousel trên mobile** (touch-action, trọng số inertia) — có trong helper nhưng cần thử tay để tinh chỉnh snap.
8. **Có bao nhiêu nav pill hiển thị ở 1920px+** (breakpoint min-1920 thay đổi gì về layout) — cần mở trang ở viewport ≥1920px.

Cách tự đo nhanh khi cần: Chrome DevTools → tab **Animations** (bắt tween khi load/scroll), hoặc trong Console: `gsap.globalTimeline.getChildren()` liệt kê tween cùng duration/ease đang chạy.
