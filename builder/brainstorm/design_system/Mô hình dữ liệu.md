## Mô hình dữ liệu (PostgreSQL + Prisma)

Tiền lưu dạng **số nguyên VND**. Mọi id là `cuid`. Các enum viết hoa.

**Tài khoản**

- `User`: email (unique), passwordHash (argon2), fullName, phone, role `CUSTOMER | ADMIN`
- `RefreshToken`: userId, tokenHash, expiresAt, revokedAt. Dùng để xoay vòng và thu hồi refresh token.
- `Address`: userId, tên người nhận, sđt, địa chỉ, quận, thành phố, zone `INNER | OUTER`, isDefault. Zone quyết định phí ship.

**Danh mục &amp; kho**

- `Category`: name, slug
- `Book`: slug, title, author (chuỗi, chưa tách bảng tác giả), isbn, description, coverUrl, categoryId, `salePrice` (null nghĩa là không bán)
- `SaleStock`: bookId (PK), quantity. Tồn kho bán, trừ theo số lượng.
- `BookCopy`: bookId, barcode, status `AVAILABLE | RESERVED | ON_LOAN | LOST`. Mỗi cuốn cho mượn là một bản ghi riêng.

**Mượn theo gói**

- `Plan`: code, name, `maxBooks`, monthlyPrice, active
- `Subscription`: userId, planId, status `PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED`, currentPeriodStart, currentPeriodEnd. Mỗi user tối đa **một** subscription ACTIVE.
- `Loan`: userId, subscriptionId, bookCopyId, status `REQUESTED | DELIVERING | ACTIVE | RETURN_REQUESTED | RETURNED | CANCELLED`, deliveryShipmentId, returnShipmentId, các mốc thời gian.
  - **Luật hạn mức:** số loan chưa ở trạng thái `RETURNED/CANCELLED` phải ≤ `plan.maxBooks`.

**Bán sách**

- Giỏ hàng lưu **phía client** (localStorage). Lúc checkout, server tính lại giá và kiểm tra tồn kho, nên không cần bảng Cart.
- `Order`: userId, status `PENDING_PAYMENT | PAID | SHIPPING | DELIVERED | CANCELLED`, subtotal, shippingFee, total, addressSnapshot (JSON)
- `OrderItem`: orderId, bookId, quantity, unitPrice (giá chốt tại thời điểm mua)

**Thanh toán (mock)**

- `Payment`: userId, purpose `ORDER | SUBSCRIPTION`, referenceId, amount, status `PENDING | SUCCEEDED | FAILED`, providerRef

**Giao hàng**

- `Shipment`: type `ORDER_DELIVERY | LOAN_DELIVERY | LOAN_PICKUP`, orderId (nullable), status `PENDING | PICKED_UP | IN_TRANSIT | DELIVERED | FAILED`, fee, addressSnapshot
  - Một shipment giao sách mượn có thể **gom nhiều loan**, liên kết qua `Loan.deliveryShipmentId` / `returnShipmentId`.
- `ShipmentEvent`: shipmentId, status, note, createdAt. Lịch sử trạng thái, dùng để hiển thị timeline theo dõi đơn.

**Vài quyết định đáng chú ý:**

- Địa chỉ được **snapshot** vào Order/Shipment, nên sau này user sửa hay xóa địa chỉ thì đơn cũ không bị ảnh hưởng.
- `BookCopy` theo dõi từng cuốn vì sách mượn cần biết chính xác cuốn nào đang ở đâu. Sách bán chỉ cần số lượng.

Phần mô hình dữ liệu này ổn chưa? Nếu ổn, mình sang **Phần 2: các module NestJS và luồng nghiệp vụ** (chuyển trạng thái, transaction, cách mock thanh toán).