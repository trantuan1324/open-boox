**Về phạm vi:** yêu cầu gồm 3 dịch vụ khá độc lập, mỗi cái có logic riêng:

1. **Cho mượn theo gói đăng ký**: gói, thanh toán định kỳ, hạn mức số sách, hạn trả.
2. **Bán sách**: giỏ hàng, thanh toán, đơn hàng, tồn kho.
3. **Giao sách tận nơi**: địa chỉ, phí ship, trạng thái giao, và cả thu hồi sách mượn.

Ba phần này dùng chung nền tảng: tài khoản, danh mục sách, kho, thanh toán.

**Quyết định cuối (thay cho đề xuất ban đầu "mỗi dự án con một spec riêng"):** toàn bộ nằm trong **một spec** (`builder/spec/app_design.md`), vì các phần dùng chung mô hình dữ liệu nên tách spec sẽ lặp nội dung. Triển khai chia theo **mốc**, mỗi mốc một implementation plan riêng và chạy được độc lập: **M0** nền tảng (monorepo, DB, auth, RBAC, design system) → **M1** danh mục + tồn kho → **M2** mua sách + thanh toán mock → **M3** giao hàng + admin → **M4** gói đăng ký + mượn sách → **M5** Playwright + CI. Khi spec đã viết, spec là nguồn sự thật; các ghi chú trong `builder/brainstorm/` chỉ là lịch sử thảo luận.

**Mục đích**
Đây là dự án học tập / portfolio. Tích hợp bên ngoài (thanh toán, vận chuyển) sẽ được mock sau một interface rõ ràng, sau này muốn thay bằng VNPay/GHN thật cũng dễ. Trọng tâm là kiến trúc Next.js + NestJS gọn và đúng chuẩn.

**Người dùng hệ thống**
Khách hàng + một trang admin cơ bản: quản lý sách/tồn kho, xem đơn, cập nhật trạng thái giao/trả sách. (admin + phân quyền theo vai trò (RBAC))

**Cơ chế của gói đăng ký (Subscription)**
Giữ tối đa N cuốn cùng lúc (kiểu Netflix DVD cũ). Ví dụ gói Basic giữ 2 cuốn, gói Premium giữ 5 cuốn, không có hạn trả cố định. Trả cuốn này thì được mượn cuốn khác. (Mình khuyên chọn cái này: luật đơn giản, dễ kiểm thử, vẫn đủ để thể hiện logic hạn mức.)

**Về dịch vụ giao hàng tận nơi**
Giao cho cả đơn mua lẫn sách mượn, và thu hồi tận nơi khi trả sách mượn. Mỗi lần giao/thu hồi là một "Shipment" có trạng thái (PENDING → PICKED_UP → IN_TRANSIT → DELIVERED), admin cập nhật tay. Phí ship cố định theo khu vực (nội thành/ngoại thành); gói mượn đã gồm phí ship. (Mình khuyên chọn cái này: một module Shipment dùng chung cho cả ba luồng là điểm thiết kế đáng giá cho portfolio.)

**Hướng kiến trúc**
Monorepo (pnpm + Turborepo), NestJS dạng modular monolith
- apps/web (Next.js App Router), apps/api (NestJS), packages/shared (schema Zod + kiểu dữ liệu dùng chung cho cả hai)
- API chia module theo nghiệp vụ: auth, catalog, inventory, orders, subscriptions, loans, shipments, payments (mock, nằm sau interface PaymentGateway)
- PostgreSQL + Prisma, chạy Postgres bằng Docker Compose

**Thông tin thêm**
- Giao diện theo design system trong ui_design/ (tối, ấm, chữ kem)
- Thanh toán mock (gói mượn tính theo tháng, đơn mua trả một lần); phí ship cố định theo khu vực, gói mượn đã gồm ship
- Danh mục sách dùng chung, tồn kho tách riêng hai loại: bản cho mượn (theo dõi từng cuốn) và bản để bán (theo số lượng)
- Ngôn ngữ giao diện là tiếng Việt, tiền tệ VND
- Không làm: đánh giá/review, gợi ý sách, email thật, đa ngôn ngữ, ứng dụng mobile