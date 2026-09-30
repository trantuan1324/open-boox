# UI Spec — Landing page ứng dụng Thuê/Mua sách (phong cách tham chiếu: slush.app)

> Tài liệu dành cho AI agent. Mục tiêu: dựng một landing page cho app thuê/mua sách, **tái tạo ngôn ngữ thiết kế** của slush.app (bố cục, typography, màu, motion) nhưng **không sao chép** logo, illustration, font thương mại hay copy của Slush.
> Số liệu đo trực tiếp từ trang ở viewport 1070×838 (desktop). Giá trị `vw` = px / 1070 × 100.

---

## 1. Tóm tắt phong cách (Design DNA)

| Đặc điểm   | Mô tả                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tính cách  | Vui nhộn, tự tin, "playful-bold". Nửa poster thể thao, nửa sticker Gen-Z.                                                                                                 |
| Nền tổng   | **Nền đen** (`#000`) làm "khung"; mỗi section là một **tấm card bo góc lớn** (trắng / xanh nhạt / màu) đặt chồng lên nền đen, cách nhau ~8px → tạo hiệu ứng "xếp tấm".    |
| Typography | Tương phản cực mạnh: **display font condensed, ExtraBold, UPPERCASE, line-height ~0.8** (có biến thể _italic_) kết hợp **sans-serif grotesk** medium cho body/subheading. |
| Màu        | Bảng màu kẹo (candy): vàng, xanh dương, tím lilac, xanh mint, cam đỏ, tím indigo. Chữ gần như luôn **đen**.                                                               |
| Minh hoạ   | Sticker 3D-flat viền đen dày (outline ~3px), bóng đổ cứng (hard shadow lệch xuống-phải), nhân vật có mắt ngộ nghĩnh. Rải "trôi nổi" quanh headline.                       |
| Nút        | Toàn bộ là **pill** (radius 999px). 2 kiểu: đen đặc chữ trắng / viền đen nền trắng. Chữ UPPERCASE nhỏ, đậm, thường kèm icon `↗`.                                          |
| Motion     | Marquee chạy ngang liên tục, parallax sticker, easing kiểu **spring có overshoot**, header thu gọn khi scroll.                                                            |
| Scale      | Kích thước chữ & radius **scale theo `vw`** (fluid), nên layout giữ tỉ lệ ở mọi độ rộng desktop.                                                                          |

---

## 2. Design tokens

### 2.1 Màu

```css
:root {
  /* Nền & chữ */
  --c-frame: #000000; /* nền body, khe hở giữa các card */
  --c-ink: #000000; /* chữ chính, nút primary, viền */
  --c-paper: #ffffff; /* card section mặc định */
  --c-sky: #dceeff; /* nền hero */

  /* Accent (dùng cho card, chip, marquee tile) */
  --c-yellow: #ffd731;
  --c-blue: #4da2ff;
  --c-lilac: #e9ccff;
  --c-mint: #55db9c;
  --c-orange: #fb4903;
  --c-indigo: #5c4ade;
  --c-blush: #ffdede;
  --c-gray: #e5e5e5;
}
```

Quy tắc dùng màu:

- Chữ trên mọi nền accent đều **đen** (kể cả cam, xanh dương). Chữ trắng chỉ dùng trong nút đen.
- Card accent xuất hiện theo **cụm 3–6 tấm xoay vòng màu**: yellow → lilac → blue → orange → mint.
- Trong illustration, dùng thêm tone nhạt của cùng màu (vd. vàng nhạt `#FFE89A` làm sọc chéo trang trí nền card).

### 2.2 Typography

| Vai trò | Font gốc (thương mại)                 | Thay thế miễn phí **hỗ trợ tiếng Việt**                                              |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Display | _Lateral_ (condensed, 800, có italic) | **Barlow Condensed 800/900 + italic** (khuyên dùng) hoặc **Anton** (không có italic) |
| Text    | _Aeonik Pro_ (grotesk)                | **Be Vietnam Pro** (khuyên dùng) hoặc Inter                                          |

> Lưu ý: Bebas Neue / Oswald hiển thị dấu tiếng Việt kém — tránh dùng.

Type scale (fluid, đo thực tế):

| Token         | Size                           | Weight | Line-height | Style                                 | Dùng cho                                     |
| ------------- | ------------------------------ | ------ | ----------- | ------------------------------------- | -------------------------------------------- |
| `display-xxl` | `19.5vw`                       | 800    | 0.80        | UPPER                                 | Wordmark hero ("SLUSH")                      |
| `display-xl`  | `13.9vw`                       | 800    | 0.76        | UPPER, có dòng _italic_               | Chữ chạy marquee, "GET SLUSH"                |
| `display-l`   | `11.1vw` (≈ `8.3vw` trong cột) | 800    | 0.80        | UPPER                                 | Tiêu đề feature ("SIMPLE, DIRECT EXECUTION") |
| `display-m`   | `7.6vw`                        | 800    | 0.80        | UPPER                                 | Tiêu đề card                                 |
| `heading`     | `4.44vw`                       | 500    | 1.0         | Sentence case, letter-spacing −0.01em | Section title ("Your shortcut to DeFi.")     |
| `lead`        | `2.08vw`                       | 500    | 1.1         | Sentence                              | Đoạn mô tả lớn trong card                    |
| `body`        | `1.67vw` (clamp min 16px)      | 500    | 1.2         | Sentence                              | Mô tả feature                                |
| `label`       | `1.04vw` (min 11px)            | 700    | 1.0         | UPPER, ls +0.03em                     | Nút, nav pill, tab                           |
| `micro`       | `0.83vw` (min 9px)             | 700    | 1.2         | UPPER                                 | Marquee banner đầu trang, footer legal       |

Kỹ thuật chữ đặc trưng:

- **Trộn thẳng & nghiêng trong cùng headline**: `YOUR INBOX` (thẳng) + `JUST GOT BETTER` (_italic_). Dòng 1 thẳng, dòng 2 nghiêng, hoặc xen từng từ.
- **Chèn object vào giữa dòng chữ**: sticker/nút QR nằm inline giữa các từ display ("ALL [sticker] THINGS SUI / ALL IN [QR-DOWNLOAD] / SLUSH WALLET").
- Line-height < 1 khiến các dòng display gần chạm nhau — đây là chủ ý.

### 2.3 Spacing, radius, shadow

```css
:root {
  --gap-sheet: 0.83vw; /* khe đen giữa các card section (~8–9px) */
  --pad-section-x: 8vw; /* lề trong card section */
  --pad-section-y: 10vw;

  --r-sheet: 2.78vw; /* ~30px @1070 — card section lớn */
  --r-card: 2.08vw; /* ~22px — card nội dung / ảnh */
  --r-tile: 1.39vw; /* ~15px — tile nhỏ, logo tile */
  --r-pill: 999px;

  --border-ink: 1px solid #000; /* viền ảnh & card feature */
}
```

- Hầu như **không dùng box-shadow** cho UI; chiều sâu đến từ illustration (hard shadow vẽ sẵn) và việc xếp card trên nền đen.
- Ảnh/visual trong feature: bo `--r-card`, **viền đen 1px**.

### 2.4 Motion

```css
--ease-spring: linear(
  0,
  0.574 7.6%,
  0.838 11.87%,
  0.946 14.19%,
  1.029 16.54%,
  1.089 18.97%,
  1.126 21.53%,
  1.142 24.48%,
  1.137 27.86%,
  1.117 31.01%,
  1.051 38.62%,
  1.022 42.57%,
  1 46.99%,
  0.987 51.63%,
  0.984 58.77%,
  1.001 81.26%,
  1
);
--dur-ui: 0.5s;
```

- Hover nút/nav: đổi nền (trắng ↔ đen) + scale nhẹ 1.03–1.05, dùng `--ease-spring`.
- Marquee: dịch ngang vô hạn, 20–40s/vòng, hai hàng chạy **ngược chiều**.
- Sticker: parallax theo scroll (translateY khác tốc độ) + xoay nhẹ ±8°.
- Section vào khung: fade + translateY(40px) → 0.
- Tôn trọng `prefers-reduced-motion`: tắt marquee/parallax.

---

## 3. Components

### 3.1 Announcement marquee (trên cùng)

- Dải cao ~22px, nền **lilac**, chữ `micro` đen, lặp lại một câu ("… WAITLIST IS LIVE") chạy ngang liên tục.

### 3.2 Header (fixed)

- **Trái**: logo tròn (icon trong vòng tròn viền đen, 36px).
- **Giữa-phải (trạng thái đầu trang)**: dãy **nav pill** trắng viền đen: mỗi mục là 1 pill riêng, `label` UPPER.
- **Nút `+`** tròn viền đen (mở menu đầy đủ) + **CTA đen đặc** ("LAUNCH APP").
- **Khi scroll xuống**: các nav pill ẩn đi, chỉ còn logo (trái) + `+` + CTA (phải), header trong suốt nổi trên nội dung.

### 3.3 Buttons

| Biến thể     | Style                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Primary      | nền `--c-ink`, chữ trắng, pill, padding `0.9em 1.8em`, `label` + icon `↗`                         |
| Secondary    | nền trắng, viền 1px đen, chữ đen, pill                                                            |
| Icon-leading | Secondary + icon tròn bên trái (vd. logo Chrome → thay bằng logo App Store / Google Play)         |
| Icon button  | tròn 36px viền đen (`+`)                                                                          |
| QR-button    | card indigo bo `--r-tile`, ô QR trắng bên trái + chữ "DOWNLOAD" trắng — đặt inline trong headline |

### 3.4 Segmented tabs

- Container pill viền đen; tab active = pill đen chữ trắng; tab thường chữ đen. Chuyển tab đổi nội dung panel bên dưới (ảnh trái + text phải).

### 3.5 Feature row (zig-zag)

- 2 cột 50/50. Một bên: visual vuông bo `--r-card` viền đen, nền màu accent + illustration. Bên kia: `display-l` 2 dòng + `body` + CTA primary.
- Hàng kế tiếp **đảo vị trí** (ảnh trái ↔ phải).

### 3.6 Card carousel màu

- Card dọc ~300×380px, bo `--r-card`, nền accent, tiêu đề `display-m` _italic_ ở đáy, sticker ở góc trên. Kéo ngang/auto-slide, có **dot pagination** xám ở dưới.

### 3.7 Testimonial strip

- Cột trái: headline italic lớn ("DON'T BELIEVE US?") + subtitle + CTA.
- Phải: hàng card cuộn ngang: card lilac (quote `lead`, tên người ở đáy), xen card "stat" màu cam với chữ display + illustration.

### 3.8 Persona cards (3 cột)

- 3 card ngang bằng nhau, nền yellow / lilac / blue, tiêu đề `display-m` _italic_ 2 dòng, CTA primary nhỏ + illustration góc phải dưới.

### 3.9 Logo tile marquee

- Tile vuông ~130px bo `--r-tile`, nền accent, icon trắng/đen ở giữa → dùng cho **logo nhà xuất bản / đối tác**.

### 3.10 Newsletter + Support (2 card vàng cạnh nhau)

- Headline trộn thẳng/nghiêng + sticker, `lead`, input pill trắng viền đen + nút đen "SUBSCRIBE", checkbox đồng ý nhỏ.

### 3.11 Footer

- Hàng marquee "GET [APP]" tile màu + huy hiệu tròn indigo chứa logo.
- Lưới: trái 2×2 **tile mạng xã hội** trắng bo góc (icon đen lớn); phải một card **mint** lớn: slogan display 2 dòng (thẳng + nghiêng), menu chính `heading` nhỏ UPPER ở cột phải, link legal `micro`, copyright góc dưới trái.

---

## 4. Bố cục trang → ánh xạ sang app sách

Tên tạm: **"Lật" (Lat)** — thay bằng tên thật của bạn. Mọi copy dưới đây là gợi ý tiếng Việt.

| #   | Section gốc (Slush)                           | Section mới (App sách)                                                                                                                                                                                                                           | Nền             |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 0   | Marquee "WAITLIST IS LIVE"                    | "THUÊ SÁCH CHỈ TỪ 5K/NGÀY • MIỄN PHÍ SHIP ĐƠN ĐẦU"                                                                                                                                                                                               | lilac           |
| 1   | Hero: wordmark khổng lồ + 3D blob + sticker   | Wordmark tên app `display-xxl` + dải ruy băng sách 3D uốn lượn phía sau + sticker (cuốn sách có mắt, kính đọc sách, bookmark, đồng xu). Tagline: **"Đọc nhiều hơn. Trả ít hơn."** CTA: `KHÁM PHÁ KỆ SÁCH` (secondary) + `TẢI APP` (icon-leading) | sky             |
| 2   | Scroll showcase 2 điện thoại                  | 2 mockup app: màn "Kệ sách của tôi" (lưới bìa sách) + "Lịch sử thuê/trả"                                                                                                                                                                         | sky (liền hero) |
| 3   | "ALL THINGS SUI / ALL IN [QR] / SLUSH WALLET" | "MỌI CUỐN SÁCH / TẤT CẢ [QR TẢI APP] / TRONG MỘT APP"                                                                                                                                                                                            | sky             |
| 4   | "Your shortcut to DeFi." + 3 feature zig-zag  | "Thuê hay mua — tuỳ bạn." Feature: ① **THUÊ LINH HOẠT** (theo ngày/tuần, gia hạn 1 chạm) ② **MUA SÁCH CHÍNH HÃNG** (mới & cũ, giá tốt) ③ **GIAO & TRẢ TẬN NHÀ** (hẹn lịch, theo dõi đơn)                                                         | paper           |
| 5   | CTA lặp + carousel card màu                   | "Đọc cả thư viện — không cần cả gian phòng." Card: _THUÊ 5K/NGÀY_, _ĐỔI SÁCH MỖI TUẦN_, _TÍCH ĐIỂM ĐỌC_, _GỢI Ý THEO GU_                                                                                                                         | paper           |
| 6   | Marquee "GET SLUSH" (2 hàng)                  | Marquee "TẢI [TÊN APP]"                                                                                                                                                                                                                          | frame (đen)     |
| 7   | Tabs Mobile / Web / Extension                 | Tabs **ỨNG DỤNG DI ĐỘNG / WEB / E-READER**                                                                                                                                                                                                       | paper           |
| 8   | Testimonials                                  | "CHƯA TIN À? / Đọc thử đi rồi biết" + review người đọc (dùng review thật hoặc placeholder đánh dấu rõ) + card stat "HƠN X NGƯỜI ĐỌC"                                                                                                             | paper           |
| 9   | Persona cards                                 | "Sách cho người đọc. Không chỉ mọt sách." → _NGƯỜI MỚI BẮT ĐẦU_ / _MỌT SÁCH CHÍNH HIỆU_ / _NHÀ SÁCH & NXB_ (CTA: Hợp tác)                                                                                                                        | paper           |
| 10  | Ecosystem logo marquee                        | "Hợp tác cùng các nhà xuất bản" + tile logo đối tác                                                                                                                                                                                              | frame           |
| 11  | Newsletter + Support                          | "HỘP THƯ CỦA BẠN SẮP HAY HƠN" + "LUÔN Ở ĐÂY ĐỂ GIÚP" (chat hỗ trợ)                                                                                                                                                                               | yellow ×2       |
| 12  | Footer                                        | "TẢI [APP]. RỒI CỨ THẾ MÀ ĐỌC." + menu: Trang chủ, Thuê sách, Mua sách, Gói thành viên, Hướng dẫn, Tải app                                                                                                                                       | mint            |

---

## 5. Hướng dẫn illustration & asset

- Phong cách: vector flat-3D, **outline đen 3px**, bóng đổ cứng offset (4px, 6px) cùng màu đen, fill màu từ palette, highlight trắng nhỏ.
- Bộ sticker gợi ý: cuốn sách mở có mắt cười, chồng sách, bookmark ruy băng, kính tròn, cốc cà phê, tên lửa bằng giấy, túi giao hàng, đồng xu có logo app, huy hiệu tick xanh (dạng "bông hoa").
- Hero visual: một vật thể 3D lớn uốn cong (vd. dải trang giấy/ruy băng xanh dương có texture) chiếm toàn nền — có thể tạo bằng Spline/Blender hoặc AI image, xuất WebP.
- **Không** dùng lại hình ảnh, logo, font Lateral/Aeonik hay thương hiệu Slush/Sui.

---

## 6. Responsive

- Desktop ≥ 1024px: như trên, type theo `vw`.
- Tablet 640–1023: feature row vẫn 2 cột nhưng ảnh nhỏ lại; persona 3 → cuộn ngang.
- Mobile < 640:
  - Dùng `clamp()` để chữ display không quá to: vd. `font-size: clamp(56px, 22vw, 240px)` cho wordmark.
  - Feature zig-zag → 1 cột (visual trên, text dưới, không đảo).
  - Nav pill → gộp vào menu `+` toàn màn hình (overlay đen, link `display-m` trắng).
  - `--gap-sheet` tối thiểu 6px, `--r-sheet` tối thiểu 20px, padding ngang 16px.

---

## 7. Gợi ý kỹ thuật cho agent

- Stack: HTML + Tailwind (hoặc Next.js + Tailwind) + GSAP/ScrollTrigger (hoặc Framer Motion) cho parallax & marquee.
- Cấu trúc:
  ```html
  <body class="bg-black">
    <div class="announcement-marquee" />
    <header class="fixed" />
    <main class="flex flex-col gap-[var(--gap-sheet)] p-[var(--gap-sheet)]">
      <section class="sheet bg-sky">…</section>
      <section class="sheet bg-white">…</section>
      …
    </main>
  </body>
  ```
  `.sheet { border-radius: var(--r-sheet); overflow: hidden; }`
- Marquee: nhân đôi nội dung, `animation: scroll-x 30s linear infinite` với `translateX(-50%)`.
- Header thu gọn: IntersectionObserver trên hero → toggle class `is-compact`.
- Font: tải `Barlow Condensed` (800, 800 italic, 900) + `Be Vietnam Pro` (500, 700) từ Google Fonts, `subset=vietnamese`.
- Accessibility: tương phản chữ đen trên mọi nền accent đều đạt AA; nút có `:focus-visible` outline 2px offset 2px; ảnh trang trí `aria-hidden`.

---

## 8. Checklist nghiệm thu

- [ ] Nền đen + các section là card bo góc lớn, khe hở đều nhau
- [ ] Display font condensed UPPER, line-height ≤ 0.85, có trộn dòng italic
- [ ] Tất cả nút là pill, chữ UPPER nhỏ đậm, có icon `↗`
- [ ] Ít nhất 3 marquee (announcement, "TẢI APP", logo đối tác)
- [ ] Feature zig-zag 3 hàng, visual viền đen bo góc
- [ ] Header thu gọn khi scroll
- [ ] Palette chỉ gồm các token ở mục 2.1
- [ ] Tiếng Việt có dấu hiển thị đúng ở cả display và body font
- [ ] Mobile 375px không tràn ngang
