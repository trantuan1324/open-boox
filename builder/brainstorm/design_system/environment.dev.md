## Xử lý lỗi, test, môi trường dev

**Xử lý lỗi**
- **Backend:**
  - Service ném các domain error như `LoanLimitExceeded`, `OutOfStock`, `InvalidShipmentTransition`…
  - Một **global exception filter** chuyển chúng thành JSON thống nhất `{ statusCode, code, message, fields? }`.
  - Các giá trị `code` là hằng số khai báo trong `packages/shared`, ví dụ `LOAN_LIMIT_EXCEEDED`, `OUT_OF_STOCK`, `SUBSCRIPTION_INACTIVE`, `VALIDATION_ERROR`.
- **Validate:** một `ZodValidationPipe` nhỏ tự viết, dùng lại schema trong `packages/shared`. Lỗi validate trả 400 kèm `fields`.
- **Lỗi Prisma:** `P2002` (trùng unique) chuyển thành 409; lỗi không lường trước trả 500 và được ghi log bằng `Logger` có sẵn của NestJS.
- **Frontend:**
  - Có bảng ánh xạ `code` sang câu thông báo tiếng Việt; lỗi có `fields` thì gắn vào đúng ô trong form.
  - Mỗi nhóm route có `error.tsx` và `not-found.tsx` riêng.

**Test**, tập trung vào luật nghiệp vụ và race condition, không test UI vụn vặt:
- **Unit (Jest):** các hàm thuần gồm máy trạng thái shipment, tính phí ship, tính kỳ hạn gói, kiểm tra hạn mức mượn, điều kiện grace period của refresh token.
- **Integration API (Jest + Supertest)** chạy trên **Postgres thật** (database `bookstore_test` trong Compose, truncate dữ liệu giữa các test):
  - **Test race condition:**
    - Gói có `maxBooks = 2`, bắn 5 request mượn song song: đúng 2 request thành công.
    - Sách còn 1 cuốn, 2 request mua song song: đúng 1 đơn được tạo.
    - 3 request refresh song song bằng cùng một token: cả 3 thành công.
  - Luồng đầy đủ: thanh toán thành công/thất bại, retry và hủy khi shipment `FAILED`, cron hủy đơn chưa thanh toán, RBAC (customer gọi API admin nhận 403).
- **E2E (Playwright), 3 luồng:**
  1. Đăng ký gói → mượn → admin giao → trả → admin thu hồi
  2. Mua → thanh toán mock → admin giao
  3. Customer truy cập `/admin` bị chuyển hướng

**Môi trường dev**
- Docker Compose **chỉ chạy Postgres** (gồm database dev và database test). Hai app chạy trực tiếp trên máy qua Turborepo để hot reload nhanh.
- Các lệnh:
  - `pnpm dev`: chạy `docker compose up -d db && turbo dev`
  - `pnpm db:setup`: chạy migrate (gồm các migration SQL viết tay) rồi seed
  - `pnpm test`: chạy toàn bộ test
- **Dữ liệu seed:**
  - Một tài khoản admin và một tài khoản customer; mật khẩu lấy từ biến môi trường, có giá trị mẫu trong `.env.example`
  - Khoảng 30 cuốn sách thuộc 6 thể loại, kèm bản cho mượn và tồn kho bán
  - 3 gói: **Basic** 2 cuốn / 79.000 đ, **Standard** 3 cuốn / 119.000 đ, **Premium** 5 cuốn / 179.000 đ
  - Ảnh bìa lấy từ Open Library theo ISBN (khai báo trong `remotePatterns` của Next.js)
- **CI (GitHub Actions):** lint, typecheck, unit test, integration test với Postgres dạng service container. Việc này rẻ và có giá trị cho portfolio.

**Về phạm vi và thứ tự làm:** tất cả sẽ nằm trong **một spec**, vì các phần dùng chung mô hình dữ liệu nên tách nhiều spec sẽ lặp lại nội dung. Nhưng phần triển khai chia thành các **mốc** (milestone), mỗi mốc một implementation plan riêng và chạy được độc lập:
- **M0:** nền tảng gồm monorepo, DB, auth, RBAC, design system
- **M1:** danh mục sách và tồn kho
- **M2:** mua sách và thanh toán mock
- **M3:** giao hàng (shipments) và trang admin tương ứng
- **M4:** gói đăng ký và mượn sách
- **M5:** Playwright và CI