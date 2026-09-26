## Frontend Next.js

**Stack:** Next.js (App Router) + Tailwind v4, import `ui_design/theme.css` làm `@theme`. Form dùng `react-hook-form` + `zodResolver`, dùng lại schema trong `packages/shared`, nên validate giống hệt backend. **Không** dùng thư viện quản lý state hay cache như Redux hay TanStack Query: Server Components cộng `router.refresh()` là đủ cho quy mô này.

**Các trang** (đường dẫn tiếng Anh, giao diện tiếng Việt):

| Nhóm | Trang |
|---|---|
| Công khai | `/` (landing, giới thiệu 3 dịch vụ) · `/books` (tìm kiếm, lọc theo thể loại, lọc "có bán" / "cho mượn") · `/books/[slug]` · `/plans` · `/login` · `/register` |
| Khách hàng | `/cart`: **hai danh sách riêng** "Mua" và "Mượn", mỗi danh sách có nút tiếp tục riêng, cùng lưu trong localStorage · `/checkout` (đơn mua) · `/borrow/confirm` (chọn địa chỉ rồi gửi yêu cầu mượn) · `/checkout/mock/[paymentId]` |
| Tài khoản | `/account` · `/account/orders` và `/account/orders/[id]` (có timeline theo dõi giao hàng) · `/account/loans` (sách đang mượn, chọn nhiều cuốn để trả) · `/account/subscription` (gói hiện tại, gia hạn) · `/account/addresses` |
| Admin | `/admin/books` (CRUD sách, chỉnh tồn kho bán, thêm/đánh dấu mất bản cho mượn) · `/admin/orders` · `/admin/shipments` (đổi trạng thái, retry, hủy loan) · `/admin/loans` (chỉ xem) |

Gói đăng ký chỉ nạp bằng seed, không có trang admin quản lý gói (YAGNI).

**Phân chia Server và Client Components**
- **Mặc định là Server Component:** mọi trang đọc dữ liệu qua `apiServer()`, một wrapper `fetch` gọi thẳng NestJS qua URL nội bộ và chuyển tiếp cookie của người dùng.
  - Danh mục sách: `revalidate: 60`.
  - Dữ liệu riêng của user: `cache: 'no-store'`.
- **Client Component chỉ dùng cho các "đảo" tương tác:** nút thêm vào giỏ mua/mượn, trang `/cart` (vì đọc localStorage), các form, nút điều khiển trạng thái trong admin.
- Bộ lọc và tìm kiếm ở `/books` dùng **URL searchParams** và render phía server, nên chia sẻ link được và không cần state phía client.
- **Thao tác ghi:** Client Component gọi `apiClient()`, rồi `router.refresh()` khi thành công.

**Xác thực phía web**
- **Cùng origin:** Next.js rewrite `/api/*` sang NestJS. Nhờ vậy NestJS tự đặt cookie `access_token` (15 phút) và `refresh_token` (7 ngày, `Path=/api/auth`), đều là `httpOnly`, `SameSite=Lax`, `Secure` khi chạy production. Không cần cấu hình CORS và không có token nào nằm trong JavaScript.
- **Middleware của Next.js:**
  1. Khi access token sắp hết hạn và còn refresh token, middleware gọi `/auth/refresh` và ghi cookie mới vào response. Nhờ đó Server Components luôn nhận được token còn hạn.
  2. Chặn `/account/*` và `/checkout/*` khi chưa đăng nhập (chuyển sang `/login?next=…`). Chặn `/admin/*` khi role trong JWT không phải `ADMIN`. Middleware chỉ decode JWT để điều hướng cho mượt; **việc phân quyền thật vẫn do guard của NestJS đảm nhận**.
- `apiClient()` phía trình duyệt: gặp 401 thì thử refresh một lần rồi gửi lại request; vẫn thất bại thì chuyển sang `/login`.

**Áp dụng design system: giữ gì, nới gì**

| Giữ nguyên | Điều chỉnh cho trang thương mại |
|---|---|
| Màu: nền `#100904`, bề mặt `#382416`, chữ kem `#ffedd7`, viền nét đứt `#40372e` | Layout full-bleed 100vh **chỉ dùng cho landing**. Các trang ứng dụng dùng container có `max-width` để lưới sách và form dễ đọc. |
| Tiêu đề, nav, nhãn, nút: **VIẾT HOA, weight 500** | Body text 29px dành cho landing; mô tả sách và nội dung form dùng **16–18px, weight 400, chữ thường** |
| Bán kính bo góc: card 12px, nút pill 36px, nút ghost 22.5px, input 0px (chỉ có gạch chân) | Quy tắc "một nút đặc mỗi section" hiểu thành "một hành động chính mỗi màn hình hoặc khối", ví dụ nút "Thanh toán". |
| Không đổ bóng, độ sâu chỉ tạo bằng hai tầng màu nền | Design system **không có màu báo lỗi/trạng thái**, nên dùng Ember `#dc5000` cho **chữ** báo lỗi và nhãn trạng thái. Không dùng cho nút, đúng tinh thần gốc. |

- **Font:** Halyard là font thương mại của Adobe, nên thay bằng **Inter** (qua `next/font`, có subset `vietnamese`). Inter hiển thị dấu tiếng Việt ở chữ in hoa ổn.
- **Lỗi nhỏ trong design system:** `ui_design/variables.css` có `--surface-cork-border: #40372` (thiếu một ký tự hex). Khi chép sang `apps/web`, mình sẽ sửa thành `#40372e`, còn file gốc giữ nguyên.