# Open Boox — Thiết kế hệ thống

> Ngày: 2026-09-26 · Trạng thái: chờ duyệt
> Tài liệu này là **nguồn sự thật**. Các ghi chú trong `builder/brainstorm/` chỉ là lịch sử thảo luận; chỗ nào khác nhau thì theo tài liệu này.

## 1. Mục tiêu và phạm vi

**Mục đích:** dự án học tập / portfolio. Trọng tâm là kiến trúc Next.js + NestJS gọn, đúng chuẩn, có luật nghiệp vụ và xử lý đồng thời được kiểm thử. Mọi tích hợp bên ngoài (thanh toán, vận chuyển) đều mock sau interface rõ ràng.

**Ba dịch vụ:**
1. **Mượn sách theo gói đăng ký** — mỗi gói cho phép giữ tối đa N cuốn cùng lúc, không có hạn trả.
2. **Bán sách** — giỏ hàng, thanh toán, đơn hàng, tồn kho.
3. **Giao sách tận nơi** — dùng chung cho giao đơn mua, giao sách mượn và thu hồi sách mượn.

**Vai trò:** `CUSTOMER`, `ADMIN` (RBAC).

**Giả định:** giao diện tiếng Việt, tiền VND; giao diện theo design system trong `ui_design/`.

**Không làm:** đánh giá/review, gợi ý sách, email thật, đa ngôn ngữ, ứng dụng mobile, hoàn tiền, đổi gói, tự động trừ tiền định kỳ, vai trò shipper, trang admin quản lý gói, khách tự hủy yêu cầu mượn (loan `REQUESTED` chỉ bị hủy qua luồng shipment `FAILED` của admin — xem 4.6).

**Tiêu chí thành công:**
- Chạy local bằng `pnpm dev` (sau lần đầu `pnpm install` + `pnpm db:setup`).
- Người xem đi hết được 3 luồng: đăng ký gói → mượn → giao → thu hồi; mua → thanh toán → giao.
- Module tách rõ; luật nghiệp vụ và race condition có test tự động.

## 2. Kiến trúc

Monorepo **pnpm + Turborepo**:

```
apps/web        Next.js (App Router) + Tailwind v4
apps/api        NestJS — modular monolith
packages/shared Schema Zod, kiểu dữ liệu, hằng số mã lỗi dùng chung
```

- **CSDL:** PostgreSQL + Prisma. Docker Compose chỉ chạy Postgres (DB `bookstore` và `bookstore_test`); hai app chạy trực tiếp trên máy.
- **Module API:** `auth`, `users` (hồ sơ, địa chỉ), `catalog`, `inventory`, `subscriptions`, `loans`, `orders`, `payments`, `shipments`, `scheduler`. API admin nằm trong chính từng module, bảo vệ bằng `@Roles('ADMIN')`.

### 2.1 Giao tiếp giữa các module

`payments` và `shipments` là module cấp thấp, **không import** `orders`, `subscriptions`, `loans`. Chúng cung cấp **registry handler**:

- `PaymentOutcomeHandler { onSucceeded(tx, payment); onFailed(tx, payment) }` — một handler cho mỗi đích thanh toán (order / subscription), đăng ký lúc `onModuleInit` bởi `orders` và `subscriptions` (NestJS không có multi-provider cho token tùy chọn, nên dùng registry). `settle` không tìm thấy handler cho đích → ném lỗi → `500 INTERNAL_ERROR`, rollback (không để payment thành công mà không có gì xảy ra).
- `ShipmentStatusHandler` — đăng ký theo `Shipment.type` bởi `orders` (`ORDER_DELIVERY`) và `loans` (`LOAN_DELIVERY`, `LOAN_PICKUP`).

Handler được gọi **trong cùng Prisma interactive transaction** với thao tác gốc (tham số `tx`), nên thay đổi luôn nguyên tử; không dùng event bus.

## 3. Mô hình dữ liệu

Tiền là **số nguyên VND**. Id là `cuid`. Enum viết hoa. Các thời điểm là `timestamptz`.

### 3.1 Tài khoản

- **`User`**: `email` (unique), `passwordHash` (argon2), `fullName`, `phone`, `role` `CUSTOMER | ADMIN`.
- **`RefreshToken`**: `userId`, `tokenHash`, `expiresAt`, `rotatedAt?`, `revokedAt?`.
  - Xoay vòng → đặt `rotatedAt = now`. Logout → đặt `revokedAt = now`.
  - Token hợp lệ khi: chưa hết hạn **và** `revokedAt IS NULL` **và** (`rotatedAt IS NULL` **hoặc** `rotatedAt > now − 30s`). 30 giây là grace period cho các request refresh song song.
- **`Address`**: `userId`, `recipientName`, `phone`, `line`, `ward` (phường/xã, text tự do), `city`, `isDefault`.
  - `city` thuộc danh sách **34 tỉnh/thành sau sáp nhập 7/2025** (hằng số trong `packages/shared`, Zod validate theo enum). Không có cấp huyện (chính quyền 2 cấp).
  - **Không lưu `zone`:** `zoneOf(city)` trong `packages/shared` suy ra — kho ở Hà Nội → `INNER`, còn lại `OUTER`. Client không gửi zone.
  - Partial unique index (migration SQL viết tay): `CREATE UNIQUE INDEX address_one_default_per_user ON "Address"("userId") WHERE "isDefault";`

### 3.2 Danh mục và kho

- **`Category`**: `name`, `slug` (unique).
- **`Book`**: `slug` (unique), `title`, `author` (chuỗi), `isbn` (unique), `description`, `coverUrl?`, `categoryId`, `salePrice?` (null = không bán).
  - `slug` sinh từ `title` lúc tạo (bỏ dấu, `đ → d`, trùng thì thêm `-2`, `-3`, …) và **không đổi** khi sửa `title`, để link cũ không chết.
- **`SaleStock`**: `bookId` (PK), `quantity` (≥ 0, CHECK constraint). Tồn kho bán, theo số lượng. Được tạo (quantity 0) **cùng transaction** với `Book`, nên mọi sách luôn có đúng một dòng stock.
- **`BookCopy`**: `bookId`, `barcode` (unique, tự sinh dạng `OB-000001`), `status` `AVAILABLE | RESERVED | ON_LOAN | LOST`. Mỗi cuốn cho mượn là một bản ghi.
- **Xóa `Book`:** `SaleStock` và `BookCopy` bị xóa theo (cascade). Từ M2/M4, `OrderItem` và `Loan` tham chiếu với `onDelete: Restrict` → xóa sách đã phát sinh giao dịch bị `P2003` → `409 IN_USE` (§7).
- **Tìm kiếm không phân biệt dấu:** migration SQL viết tay bật extension `unaccent` và tạo hàm `immutable_unaccent(text)` (wrapper `IMMUTABLE`). Không có index trigram — dữ liệu nhỏ.

| Sự kiện | `BookCopy.status` |
|---|---|
| Tạo yêu cầu mượn | `AVAILABLE → RESERVED` |
| Giao sách mượn thành công | `RESERVED → ON_LOAN` |
| Hủy yêu cầu mượn | `RESERVED → AVAILABLE` |
| Sách thu hồi về tới kho | `ON_LOAN → AVAILABLE` |
| Admin đánh dấu mất | `AVAILABLE → LOST` (trạng thái khác → `409 INVALID_COPY_STATE`; bản đang `RESERVED`/`ON_LOAN` do luồng mượn xử lý) |

### 3.3 Mượn theo gói

- **`Plan`**: `code` (unique), `name`, `maxBooks`, `monthlyPrice`, `active`.
- **`Subscription`**: `userId`, `planId`, `status` `PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED`, `currentPeriodStart?`, `currentPeriodEnd?`, `createdAt`.
  - **Partial unique index** (migration SQL viết tay, Prisma không khai báo được):
    `CREATE UNIQUE INDEX subscription_one_open_per_user ON "Subscription"("userId") WHERE status IN ('PENDING_PAYMENT','ACTIVE');`
- **`Loan`**: `userId`, `subscriptionId`, `bookCopyId`, `status` `REQUESTED | ACTIVE | RETURN_REQUESTED | RETURNED | CANCELLED`, `deliveryShipmentId`, `returnShipmentId?`, `requestedAt`, `deliveredAt?`, `returnedAt?`.
  - Tiến độ giao hàng xem ở `Shipment`, Loan không lặp trạng thái đó.
  - **Loan đang mở** = trạng thái `REQUESTED | ACTIVE | RETURN_REQUESTED`.
  - **Luật hạn mức:** số loan đang mở **theo `userId`** + số sách yêu cầu ≤ `maxBooks` của gói đang hiệu lực. Đếm theo user (không theo subscription) để sách mượn từ gói cũ vẫn tính khi user đăng ký gói mới.

### 3.4 Bán sách

- Giỏ hàng lưu **phía client** (localStorage), không có bảng Cart. Checkout tính lại giá và kiểm tra tồn kho phía server.
- **`Order`**: `userId`, `status` `PENDING_PAYMENT | PAID | SHIPPING | DELIVERED | CANCELLED`, `subtotal`, `shippingFee`, `total`, `addressSnapshot` (JSON), `createdAt`.
- **`OrderItem`**: `orderId`, `bookId` (`onDelete: Restrict`), `quantity`, `unitPrice` (giá chốt lúc mua).
- **`addressSnapshot`** (Order, Shipment): `{ recipientName, phone, line, ward, city }`. Zone suy lại từ `city`; phí đã nằm trên `Order`.

### 3.5 Thanh toán (mock)

- **`Payment`**: `userId`, `orderId?`, `subscriptionId?`, `amount`, `status` `PENDING | SUCCEEDED | FAILED`, `providerRef?`, `createdAt`.
  - CHECK constraint (migration SQL): đúng một trong `orderId`, `subscriptionId` khác null.
  - M2 tạo sẵn cột `subscriptionId` (nullable, **chưa có FK** — thêm ở M4 cùng bảng `Subscription`).
  - Một Order có đúng một Payment (payment thất bại → đơn `CANCELLED`, không bao giờ có payment thứ hai).

### 3.6 Giao hàng

- **`Shipment`**: `type` `ORDER_DELIVERY | LOAN_DELIVERY | LOAN_PICKUP`, `orderId?` (FK → Order, `Restrict`), `status` `PENDING | PICKED_UP | IN_TRANSIT | DELIVERED | FAILED`, `fee`, `addressSnapshot` (JSON), `retryOfId?` (**unique**, FK tự tham chiếu tới shipment `FAILED` được retry), `createdAt`, `updatedAt`. Index `(orderId)`, `(status, createdAt)`.
  - `type = ORDER_DELIVERY` bắt buộc có `orderId`: kiểm tra ở service, và CHECK constraint `shipment_order_delivery_has_order` (migration SQL viết tay) làm chốt chặn cuối.
  - Một Order có thể có nhiều Shipment (do retry, có thể thành chuỗi A→B→C); **shipment hiện tại** của đơn là cái có `createdAt` mới nhất. Một shipment sách mượn gom nhiều Loan qua `Loan.deliveryShipmentId` / `Loan.returnShipmentId`.
- **`ShipmentEvent`**: `shipmentId` (FK Cascade, index), `status`, `note?`, `createdAt`. Lịch sử trạng thái cho timeline; tạo shipment luôn ghi event `PENDING` đầu tiên. `note` do admin nhập **hiện cho khách** trên timeline.

Địa chỉ được **snapshot** vào Order và Shipment; sửa/xóa `Address` không ảnh hưởng đơn cũ.

## 4. Luồng nghiệp vụ

### 4.1 Thanh toán mock

- Interface `PaymentGateway.createCheckout(payment) → { redirectUrl }`. Bản `MockGateway` trả `/checkout/mock/:paymentId`.
- Trang mock có hai nút "Thanh toán thành công" / "Thất bại", gọi `POST /payments/:id/mock-callback { success }`.
- `GET /payments/:id` và `mock-callback` chỉ cho chủ payment; người khác → `404 NOT_FOUND`. Callback trên payment không còn `PENDING` → trả trạng thái hiện tại (idempotent); trang mock hiển thị trạng thái cuối thay vì nút.
- **Một chủ sở hữu duy nhất:** mọi chuyển `Payment` khỏi `PENDING` đều đi qua `PaymentsService.settle(paymentId, SUCCEEDED | FAILED)` — dùng bởi mock callback, lệnh hủy đơn của khách và cron. `settle` chạy trong một transaction: `UPDATE "Payment" SET status = … WHERE id = … AND status = 'PENDING'`; 0 dòng bị ảnh hưởng → payment đã được xử lý, trả trạng thái hiện tại, không gọi handler (idempotent, và khi callback thành công đua với cron thì chỉ một bên thắng). Nếu cập nhật được → gọi handler tương ứng trong cùng transaction.
- `settle` trả **payment hiện tại** (sau cập nhật, hoặc trạng thái đã có nếu 0 dòng); người gọi quyết định theo `status`.
- Handler **không bao giờ** tự đổi `Payment`; Order/Subscription không bị module nào khác hủy trực tiếp mà luôn đi qua `settle(…, FAILED)`.
- Nếu `onSucceeded` ném domain error (xung đột nghiệp vụ lúc kích hoạt), transaction bị rollback, rồi `settle` chuyển payment sang `FAILED` (mock: coi như cổng thanh toán từ chối) và gọi `onFailed`.

### 4.2 Gói đăng ký

- **Đăng ký** `POST /subscriptions { planCode }`: tạo `Subscription PENDING_PAYMENT` + `Payment`. Nếu user đã có subscription `PENDING_PAYMENT` hoặc `ACTIVE` → `409 SUBSCRIPTION_ALREADY_EXISTS` (index ở 3.3 đảm bảo cả khi request song song).
  - Thanh toán thành công → `ACTIVE`, `currentPeriodStart = now`, `currentPeriodEnd = now + 30 ngày`.
  - Thanh toán thất bại → `CANCELLED`.
- **Gia hạn** `POST /subscriptions/renew`: **chỉ** áp dụng cho subscription `ACTIVE` của user (tối đa một, do index); không có → `409 SUBSCRIPTION_INACTIVE`. Gói đã `EXPIRED` thì user **đăng ký mới** (được chọn lại cùng gói) — không có đường "kích hoạt lại" một subscription `EXPIRED` qua API.
  - Thành công → `currentPeriodEnd = max(now, currentPeriodEnd) + 30 ngày`, trạng thái `ACTIVE`. (Nếu cron đã chuyển subscription sang `EXPIRED` trong lúc payment gia hạn đang chờ, bước này đưa nó về `ACTIVE`; nếu user đã kịp đăng ký subscription khác nên vi phạm index → rollback và payment `FAILED` theo 4.1.)
  - Thất bại → subscription giữ nguyên.
- `onFailed` cho subscription: subscription đang `PENDING_PAYMENT` → `CANCELLED`; trạng thái khác (payment gia hạn) → giữ nguyên.
- **Hết hạn:** cron hằng ngày chuyển `ACTIVE` có `currentPeriodEnd < now` sang `EXPIRED`. Khi mượn, service vẫn kiểm tra `currentPeriodEnd > now` để không phụ thuộc độ trễ của cron.
- **Gói hết hạn khi còn sách:** user giữ sách đến khi trả, không phạt, không mượn thêm được; giao diện nhắc trả sách.

### 4.3 Mượn sách — `POST /loans { bookIds, addressId }`

Trong một transaction:
1. `SELECT … FOR UPDATE` dòng Subscription `ACTIVE` của user — xếp hàng mọi request mượn của cùng user. Không có, hoặc `currentPeriodEnd ≤ now` → `409 SUBSCRIPTION_INACTIVE`.
2. Đếm loan đang mở theo user; nếu `đếm + bookIds.length > maxBooks` → `409 LOAN_LIMIT_EXCEEDED`.
3. Với mỗi `bookId`: chọn một `BookCopy AVAILABLE` bằng `FOR UPDATE SKIP LOCKED LIMIT 1` (raw SQL), chuyển `RESERVED`. Không còn bản → `409 NO_COPY_AVAILABLE` (rollback toàn bộ).
4. Tạo **một** `Shipment LOAN_DELIVERY` (phí 0 đ) và các `Loan REQUESTED` trỏ tới nó.

Khi shipment `DELIVERED` → loan `ACTIVE`, `deliveredAt = now`, bản sách `ON_LOAN`.

### 4.4 Trả sách — `POST /loans/return { loanIds, addressId }`

- Chỉ nhận loan `ACTIVE` của chính user; ngược lại → `409 LOAN_NOT_RETURNABLE`. Được trả cả khi gói đã hết hạn.
- Loan → `RETURN_REQUESTED`; tạo **một** `Shipment LOAN_PICKUP` (phí 0 đ) gom các loan.
- Khi shipment `DELIVERED` (sách về kho) → loan `RETURNED`, `returnedAt = now`, bản sách `AVAILABLE`.

### 4.5 Mua sách — `POST /orders { items: [{ bookId, quantity }], addressId }`

Validate: `bookId` không trùng, `quantity` 1–10, 1–20 dòng; `addressId` của chính user (khác → `404`). Items được **sort theo `bookId` tăng dần** ngay đầu.

Trong một transaction:
1. Lấy giá từ DB; sách không bán (`salePrice` null) → `400 VALIDATION_ERROR`.
2. Trừ kho từng sách: `UPDATE "SaleStock" SET quantity = quantity - $n WHERE "bookId" = $id AND quantity >= $n`. 0 dòng bị ảnh hưởng → `409 OUT_OF_STOCK` (rollback).
3. Phí ship: `INNER` 20.000 đ, `OUTER` 35.000 đ.
4. Tạo `Order PENDING_PAYMENT`, `OrderItem`, `Payment`. Trả `{ orderId, redirectUrl }`.

**Thứ tự khóa:** mọi thao tác ghi nhiều dòng `SaleStock` (trừ kho lúc tạo đơn, hoàn kho trong `onFailed` — đọc `OrderItem ORDER BY "bookId"`) đi theo `bookId` tăng dần, để hai transaction không khóa chéo nhau (deadlock). Luồng nào sau này ghi `SaleStock` nhiều dòng cũng phải theo luật này.

**Double-submit** `POST /orders` tạo hai đơn — chấp nhận, không có idempotency key; client disable nút khi đang gửi. Đơn thừa tự hủy sau 30 phút (cron 4.7).

Sau đó:
- Thanh toán thành công → `PAID`, tạo `Shipment ORDER_DELIVERY` qua `ShipmentsService.create(tx, …)` trong cùng transaction với `fee = order.shippingFee`, `addressSnapshot = order.addressSnapshot`, `orderId = order.id`, kèm event `PENDING` (**từ M3**; ở M2 handler chỉ chuyển `PAID`).
- Thanh toán thất bại → `CANCELLED`, hoàn kho.
- Khách hủy (`POST /orders/:id/cancel`): gọi `settle(payment, FAILED)` rồi quyết định theo payment trả về: `SUCCEEDED` (callback thắng đua) → `409 ORDER_NOT_CANCELLABLE`, không đổi gì; `FAILED` (bất kể ai set — `onFailed` của bên thắng đã hủy đơn + hoàn kho) → `200` kèm đơn hiện tại. Nhờ đó hủy hai lần cũng idempotent.
- Shipment `PICKED_UP` → đơn `SHIPPING`; `DELIVERED` → đơn `DELIVERED`.

**Endpoint khác:**
- `POST /orders/quote { items, addressId }`: cùng validate và hàm tính giá với tạo đơn (kiểm tra `salePrice` và tồn kho hiện tại, trả `OUT_OF_STOCK` nếu thiếu) nhưng **không ghi DB**; trả các dòng với giá thật, `subtotal`, `shippingFee`, `total`. Trang checkout dùng để hiển thị.
- `GET /orders?page=` → `{ items, total, page, pageSize }`, `pageSize = 10`, mới nhất trước; chỉ đơn của user.
- `GET /orders/:id` → đơn + items + `addressSnapshot` + `pendingPaymentId?` (có khi payment còn `PENDING`) + `shipments` (từ M3: mọi shipment của đơn, cũ trước, mỗi cái kèm `events` cũ trước — đọc qua `ShipmentsService.listForOrder`, `orders` không tự đọc bảng shipment); đơn người khác → `404`.

**Admin** (`@Roles('ADMIN')`, trong module `orders`, từ M3; chỉ đọc):
- `GET /admin/orders?status=&page=` → `{ items, total, page, pageSize }`, `pageSize = 20`, mới nhất trước; mỗi dòng `id, customerEmail, status, total, itemCount, createdAt, latestShipmentStatus?`. Query dễ dãi như `/orders` (giá trị lạ rơi về mặc định).
- `GET /admin/orders/:id` → chi tiết như `GET /orders/:id` + `customer { email, fullName }` + `paymentStatus`; không có → `404`.

### 4.5a Địa chỉ (module `users`)

- `GET /addresses`, `POST /addresses`, `PATCH /addresses/:id`, `DELETE /addresses/:id`, `POST /addresses/:id/default`. Địa chỉ người khác → `404`.
- Địa chỉ đầu tiên của user tự thành mặc định. `PATCH` **không** nhận `isDefault`; mặc định chỉ đổi qua `POST /addresses/:id/default` (idempotent: đã là mặc định vẫn `200`; trong transaction bỏ mặc định cũ rồi đặt cái mới).
- Xóa địa chỉ mặc định → user không còn mặc định (không tự chọn cái khác).
- Hai `POST /addresses` song song khi user chưa có địa chỉ → cả hai muốn làm mặc định → cái sau dính partial index → `P2002` → `409 DUPLICATE`. **Chấp nhận**, không khóa user.

### 4.6 Shipment

- Máy trạng thái (ma trận `NEXT_SHIPMENT_STATUSES` + `canTransition` nằm ở `packages/shared` để web chỉ hiện lựa chọn hợp lệ), không nhảy cóc:

  | Từ | Được sang |
  |---|---|
  | `PENDING` | `PICKED_UP`, `FAILED` |
  | `PICKED_UP` | `IN_TRANSIT`, `FAILED` |
  | `IN_TRANSIT` | `DELIVERED`, `FAILED` |
  | `DELIVERED`, `FAILED` | — (trạng thái cuối) |

- Admin đổi trạng thái: `PATCH /admin/shipments/:id { status, note? }` (`note` trim, ≤ 500 ký tự). Trong một transaction:
  1. Đọc shipment (không có → `404`). `status` **đã bằng** trạng thái hiện tại → `200` kèm shipment, không ghi event, không gọi handler (kiểm tra trước `canTransition`, nên `DELIVERED → DELIVERED` cũng `200`).
  2. `canTransition` sai → `409 INVALID_SHIPMENT_TRANSITION`.
  3. CAS: `updateMany({ where: { id, status: current }, data: { status } })` — cùng idiom với `payments`, không dùng `FOR UPDATE`. `count = 0` (bị admin khác chen) → đọc lại: đã ở `status` → `200` no-op; khác → `409 INVALID_SHIPMENT_TRANSITION`.
  4. Chỉ bên thắng CAS: ghi `ShipmentEvent` và gọi `ShipmentStatusHandler` của `type`. Không có handler → ném lỗi → `500`, rollback (như `settle`).
- `ShipmentsService` export `create(tx, { type, orderId?, fee, addressSnapshot })` (ghi kèm event `PENDING`) và `listForOrder(db, orderId)`.
- Handler `ORDER_DELIVERY` (module `orders`): `PICKED_UP` → `updateMany` đơn `PAID → SHIPPING`; `DELIVERED` → đơn `SHIPPING → DELIVERED`; trạng thái khác không làm gì. Guard theo trạng thái nên shipment retry đi lại `PICKED_UP` khi đơn đã `SHIPPING` không đổi gì.
- Đọc: `GET /admin/shipments?status=&type=&page=` (query dễ dãi như `/admin/orders`: `status`/`type` lạ → bỏ lọc, `page` lạ → 1; `pageSize = 20`, mới nhất trước, mỗi dòng kèm `orderId`, `retriedById?`); `GET /admin/shipments/:id` → shipment + `events` (cũ trước) + `retryOfId` + `retriedById`.

**Khi `FAILED`:**

| Loại | Hành động admin |
|---|---|
| `ORDER_DELIVERY` | Chỉ **retry**; đơn giữ nguyên trạng thái (`PAID` hoặc `SHIPPING`) và tiếp tục khi shipment mới tiến triển. |
| `LOAN_DELIVERY` | **Retry**, hoặc **hủy** (`POST /admin/shipments/:id/cancel-loans`): loan → `CANCELLED`, bản sách → `AVAILABLE`. |
| `LOAN_PICKUP` | Chỉ **retry**. |

Retry `POST /admin/shipments/:id/retry`: chỉ khi shipment `FAILED` (khác → `409 INVALID_SHIPMENT_TRANSITION`). Tạo shipment mới cùng `type`, `fee`, `addressSnapshot`, `orderId`, `retryOfId = id` (kèm event `PENDING`); với loan (M4) trỏ lại `Loan.deliveryShipmentId` / `Loan.returnShipmentId` về shipment mới. Retry cùng một shipment lần hai (tuần tự hay song song) dính unique `retryOfId` → `P2002` → `409 SHIPMENT_ALREADY_RETRIED`; lỗi này làm hỏng transaction Postgres, nên bắt **bên ngoài** `$transaction` rồi mới đổi mã. Retry theo chuỗi (retry shipment retry đã `FAILED`) được phép. Trả shipment mới.

M3 chỉ làm `ORDER_DELIVERY`; `cancel-loans` và handler `LOAN_DELIVERY`/`LOAN_PICKUP` làm ở M4.

### 4.7 Cron (`@nestjs/schedule`)

Mỗi job nhận một `Clock` được inject để test gọi trực tiếp với thời gian giả.

| Job | Tần suất | Việc làm |
|---|---|---|
| `expireSubscriptions` | hằng ngày 00:00 | `ACTIVE` có `currentPeriodEnd < now` → `EXPIRED` |
| `failStalePayments` | `@Interval` 5 phút | **Chỉ** gọi `settle(…, FAILED)` cho mọi `Payment PENDING` quá 30 phút. Việc hủy đơn + hoàn kho, hủy subscription `PENDING_PAYMENT` do `onFailed` đảm nhận; payment gia hạn thất bại không đổi subscription. |
| `cleanupRefreshTokens` | hằng ngày 03:00 | Gọi `purgeRefreshTokens(now)` do `auth` export: xóa `RefreshToken` có `expiresAt < now`, hoặc `revokedAt`/`rotatedAt` < `now − 1 ngày`. |

Các job nằm ở module `scheduler`, chỉ gọi hàm do module sở hữu bảng export (`PaymentsService.settle`, `auth`) — không ghi thẳng bảng. Job theo lịch ngày dùng `@Cron(…, { timeZone: 'Asia/Ho_Chi_Minh' })`.

### 4.8 Danh mục và kho

Module `catalog` sở hữu `Category`, `Book` (đọc công khai + CRUD admin). Module `inventory` sở hữu `SaleStock`, `BookCopy` và là **nơi duy nhất ghi** vào hai bảng này; nó export `InventoryService` (các hàm nhận `tx`) để `catalog` (tạo dòng stock khi tạo sách), `orders` (M2) và `loans` (M4) gọi. Việc xóa theo khi xóa sách do cascade của DB đảm nhận. `catalog` được **đọc** số lượng tồn trực tiếp qua Prisma để hiển thị.

**Công khai:**
- `GET /categories` — thể loại chỉ đến từ seed, không có API quản lý.
- `GET /books?q=&category=<slug>&availability=sale|loan&page=` → `{ items, total, page, pageSize }`, `pageSize = 12`, sắp theo `title`.
  - `q`: `immutable_unaccent(title|author) ILIKE immutable_unaccent('%q%')` (gõ "nha gia kim" ra "Nhà giả kim").
  - `availability=sale`: `salePrice` khác null **và** `SaleStock.quantity > 0`. `availability=loan`: có ít nhất một `BookCopy AVAILABLE`.
  - Mỗi item kèm `saleStock` (số lượng) và `availableCopies`.
- `GET /books/:slug` → chi tiết + `categoryName`, `saleStock`, `availableCopies`; không có → `404 NOT_FOUND`.

**Admin** (`@Roles('ADMIN')`):
- `GET /admin/books?q=&page=` (kèm số bản theo từng trạng thái), `GET /admin/books/:id` (kèm danh sách bản), `POST /admin/books`, `PATCH /admin/books/:id`, `DELETE /admin/books/:id`. ISBN trùng → `409 DUPLICATE`.
- `POST /admin/books/:id/stock { delta }` (số nguyên khác 0): `UPDATE "SaleStock" SET quantity = quantity + $delta WHERE "bookId" = $id AND quantity + $delta >= 0`; 0 dòng → `409 OUT_OF_STOCK`. Theo **delta** chứ không đặt số tuyệt đối, để không ghi đè lượt trừ kho của đơn mua đang chạy song song.
- `POST /admin/books/:id/copies { count }` (1–50): tạo `count` bản `AVAILABLE`.
- `POST /admin/copies/:id/lost`: `UPDATE … SET status = 'LOST' WHERE id = … AND status = 'AVAILABLE'`; 0 dòng → `409 INVALID_COPY_STATE` (hoặc `404` nếu không tồn tại).

Schema Zod cho query/body nằm trong `packages/shared/src/catalog.ts`.

## 5. Xác thực và bảo mật

- **JWT HS256**: `access_token` 15 phút, `refresh_token` 7 ngày. Cả hai là cookie `httpOnly`, `SameSite=Lax`, `Secure` ở production. Cả hai cookie đều `Path=/` — refresh cookie **phải** là `/` vì proxy (6.3) chạy trên route trang như `/account` và trình duyệt chỉ gửi cookie tới path khớp. Refresh token là chuỗi ngẫu nhiên 32 byte (không phải JWT); DB lưu `tokenHash = HMAC-SHA256(JWT_REFRESH_SECRET, token)`.
- NestJS dùng global prefix `/api`; Next.js rewrite `/api/:path*` → `${API_INTERNAL_URL}/api/:path*`. Các endpoint dưới đây viết tương đối với `/api`.
- **Cùng origin** nhờ rewrite trên: không cấu hình CORS; không token nào nằm trong JavaScript.
- **Endpoint:** `POST /auth/register`, `/auth/login`, `/auth/refresh` (xoay vòng, áp grace period ở 3.1), `/auth/logout` (đặt `revokedAt`), `GET /auth/me`. Sai email/mật khẩu → `401 INVALID_CREDENTIALS` (cùng một mã cho cả hai trường hợp). Refresh thất bại → 401 và xóa cả hai cookie.
- **CSRF (quyết định có chủ ý):** `SameSite=Lax` + cùng origin + mọi endpoint ghi **chỉ nhận `application/json`** (khác → `415 UNSUPPORTED_MEDIA_TYPE`).
- **Phân quyền:** `JwtAuthGuard` + `RolesGuard` ở NestJS là nguồn sự thật.
- **Rate limit:** `@nestjs/throttler` (lưu in-memory) chỉ trên `POST /auth/login` (10 request/phút) và `POST /auth/register` (5 request/phút), khóa theo `req.ip` với Express `trust proxy = 'loopback'` → vượt ngưỡng `429 TOO_MANY_REQUESTS`. Hạn mức đọc từ env `AUTH_LOGIN_RATE_LIMIT` / `AUTH_REGISTER_RATE_LIMIT` (mặc định 10 / 5) để test integration nâng được.
  - **Đã kiểm chứng (Next 16.3.6):** rewrite `/api/*` **không** thêm `X-Forwarded-For`, chỉ chuyển nguyên header client gửi. Hệ quả: chạy local (không có reverse proxy phía trước), mọi request chung một khóa (IP của tiến trình Next) — chấp nhận cho dev. Khi deploy **bắt buộc** đặt reverse proxy (nginx…) append `X-Forwarded-For` trước Next.js; Express lấy địa chỉ không tin cậy gần nhất tính từ phải, nên giá trị client tự đặt ở đầu chuỗi không được dùng làm khóa.
- Tên cookie (`access_token`, `refresh_token`) là hằng số trong `packages/shared`, dùng chung cho API và proxy.

## 6. Frontend (apps/web)

**Stack:** Next.js App Router, Tailwind v4 (import token từ design system), `react-hook-form` + `zodResolver` dùng schema trong `packages/shared`. Không dùng Redux/TanStack Query.

### 6.1 Trang

| Nhóm | Trang |
|---|---|
| Công khai | `/` (landing 3 dịch vụ) · `/books` (tìm kiếm, lọc thể loại, lọc "có bán"/"cho mượn") · `/books/[slug]` · `/plans` · `/login` · `/register` |
| Khách hàng | `/cart` (hai danh sách "Mua" và "Mượn" trong localStorage, mỗi danh sách một nút tiếp tục) · `/checkout` · `/borrow/confirm` · `/checkout/mock/[paymentId]` |
| Tài khoản | `/account` · `/account/orders` · `/account/orders/[id]` (timeline giao hàng) · `/account/loans` (chọn nhiều cuốn để trả) · `/account/subscription` (gói hiện tại, gia hạn) · `/account/addresses` |
| Admin | `/admin` → chuyển hướng `/admin/orders` (trước M3: `/admin/books`) · `/admin/books` (danh sách) + `/admin/books/new` + `/admin/books/[id]` (sửa sách, nhập/xuất kho bán theo delta, thêm/đánh dấu mất bản cho mượn) · `/admin/orders` (lọc trạng thái) + `/admin/orders/[id]` (chỉ xem) · `/admin/shipments` (lọc trạng thái/loại) + `/admin/shipments/[id]` (timeline, đổi trạng thái, retry; hủy loan từ M4) · `/admin/loans` (chỉ xem). Chung một layout admin. |

Mọi danh sách có trạng thái rỗng (giỏ trống, chưa mượn, chưa có đơn).

### 6.2 Server / Client Components

- **Mặc định Server Component.** Đọc dữ liệu qua `apiServer()`: `fetch` tới URL nội bộ của NestJS, chuyển tiếp cookie.
  - Danh mục công khai: đọc qua `apiPublic()` — **không** chuyển tiếp cookie (để cache dùng chung cho mọi người), `revalidate: 60` — chấp nhận chậm tối đa 60 giây sau khi admin sửa; không sai nghiệp vụ vì checkout/mượn luôn kiểm tra lại phía server. API trả 404 → trang gọi `notFound()`.
  - Dữ liệu riêng của user và **toàn bộ `/admin/*`**: `cache: 'no-store'`.
  - `apiServer()` merge `init` của caller với mặc định `cache: 'no-store'`; gặp 401 → `redirect('/login?next=…')` (path + query hiện tại).
- **Client Component** chỉ cho đảo tương tác: nút thêm giỏ mua/mượn, trang `/cart`, form, điều khiển admin, `BookCover` (fallback ảnh).
- Bộ lọc `/books` dùng **URL searchParams**, render phía server: ô tìm là form GET; chip thể loại / "Có bán" / "Cho mượn" và phân trang là link — đổi một tham số thì giữ các tham số khác và đặt lại `page`.
- `/books/[slug]` hiển thị thông tin, giá và tình trạng ("Còn N cuốn để bán", "Còn N bản cho mượn"). Từ M2 có nút "Thêm vào giỏ" (Client Component) khi sách có bán và còn hàng; nút mượn thêm ở M4.

### 6.2a Giỏ hàng và checkout (M2)

- **Giỏ:** localStorage key `ob.cart.buy`, mỗi dòng `{ bookId, slug, title, coverUrl, salePrice, quantity }` — giá chỉ để hiển thị. `useCart()` đồng bộ giữa các tab qua sự kiện `storage`; header hiện số lượng. Thêm trùng sách thì cộng dồn, trần 10; dữ liệu localStorage hỏng → giỏ rỗng.
- **`/cart`** (công khai): danh sách "Mua" (tăng/giảm/xóa, tạm tính theo giá trong giỏ), nút "Tiếp tục" → `/checkout`. Danh sách "Mượn" thêm ở M4.
- **`/checkout`:** chọn địa chỉ (mặc định trước; chưa có thì form tạo ngay tại trang) → `POST /orders/quote` mỗi lần đổi địa chỉ để hiện giá thật, phí ship, tổng. Quote lỗi (`OUT_OF_STOCK`, sách không bán) → báo và cho sửa giỏ. "Đặt hàng" → `POST /orders` (nút disable khi đang gửi) → xóa giỏ → chuyển `redirectUrl`.
- **`/checkout/mock/[paymentId]`:** số tiền + hai nút; xong chuyển `/account/orders/[id]`. Payment không còn `PENDING` → chỉ hiện trạng thái.
- **`/account/orders`** (phân trang, trạng thái rỗng); **`/account/orders/[id]`**: items, địa chỉ snapshot, tiền; nếu `PENDING_PAYMENT` có link "Thanh toán" (`pendingPaymentId`) và nút "Hủy đơn". Timeline giao hàng thêm ở M3 (xem 6.2b).
- **`/account/addresses`:** CRUD, đặt mặc định; form `select` 34 tỉnh/thành, hiển thị phí ship suy từ tỉnh/thành đã chọn. `/account` có link tới Đơn hàng và Địa chỉ.
- **Ghi:** Client Component gọi `apiClient()` (fetch tới `/api/*`), thành công thì `router.refresh()`. Gặp 401 → gọi `/api/auth/refresh` một lần rồi thử lại; vẫn lỗi → chuyển `/login`.

### 6.2b Giao hàng và admin đơn (M3)

- **Timeline khách** (`/account/orders/[id]`, khối "Giao hàng"): mỗi lần giao một khối, lần mới nhất trên cùng; trong khối liệt kê event (nhãn `SHIPMENT_STATUS_LABEL`, thời gian, `note` nếu có). Lần `FAILED` hiện chữ ember. Đơn chưa có shipment → không hiện khối.
- **Nav admin:** "Đơn hàng", "Giao hàng", "Sách"; `/admin` → `/admin/orders`.
- **`/admin/orders`**: chip lọc trạng thái (link, giữ searchParams, đặt lại `page`), bảng (mã, email khách, trạng thái, tổng, số cuốn, ngày, trạng thái giao gần nhất), phân trang, trạng thái rỗng. **`/admin/orders/[id]`**: khách, items, địa chỉ snapshot, trạng thái thanh toán, danh sách lần giao kèm link `/admin/shipments/[id]`.
- **`/admin/shipments`**: chip lọc trạng thái và loại, bảng (mã, loại, link đơn, trạng thái, ngày tạo, "Đã retry →" nếu có). **`/admin/shipments/[id]`**: timeline + Client Component: `select` chỉ các trạng thái kế tiếp hợp lệ, ô ghi chú (chú thích "Khách hàng sẽ thấy ghi chú này"), nút "Cập nhật"; nút "Tạo lần giao mới" chỉ khi `FAILED` và chưa retry → xong chuyển tới shipment mới. `409` → hiện lỗi rồi `router.refresh()`.

### 6.3 Proxy (middleware)

Next.js 16 đặt tên file là `proxy.ts` (hàm `proxy`) thay cho `middleware.ts`; logic dưới đây giữ nguyên.

1. **Refresh:** nếu access token còn < 60 giây (hoặc đã hết) và có refresh token → gọi `/api/auth/refresh`, ghi cookie mới vào **cả request (`NextResponse.next({ request: { headers } })`) lẫn response**, để Server Component trong cùng lượt đọc được token mới. Refresh thất bại → cho request đi tiếp (API trả 401, `apiServer()` xử lý).
2. **Điều hướng:** verify JWT bằng `jose` (HS256, dùng chung `JWT_ACCESS_SECRET`). Chưa đăng nhập vào `/account/*`, `/checkout/*`, `/borrow/*` → `/login?next=…`. Role khác `ADMIN` vào `/admin/*` → `/`.

### 6.4 Design system

| Giữ nguyên | Điều chỉnh |
|---|---|
| Nền `#100904`, bề mặt `#382416`, chữ `#ffedd7`, viền nét đứt `#40372e` | Full-bleed 100vh **chỉ ở landing**; trang ứng dụng dùng container có `max-width` |
| Tiêu đề, nav, nhãn, nút: VIẾT HOA, weight 500 | Body 29px chỉ ở landing; nội dung khác 16–18px, weight 400, chữ thường |
| Bo góc: card 12px, pill 36px, ghost 22.5px, input 0px (gạch chân) | "Một nút đặc mỗi section" → một hành động chính mỗi màn hình/khối |
| Không đổ bóng | Ember `#dc5000` dùng cho **chữ** báo lỗi và nhãn trạng thái (không dùng cho nút) |

- Font: **Inter** qua `next/font` (subset `latin`, `vietnamese`) thay Halyard.
- Khi chép token sang `apps/web`, sửa `--surface-cork-border: #40372` → `#40372e`; giữ nguyên file trong `ui_design/`.

## 7. Xử lý lỗi

**Định dạng:** `{ statusCode, code, message, fields? }`. Hằng số `code` khai báo trong `packages/shared`; frontend ánh xạ `code` → câu tiếng Việt, `fields` → lỗi từng ô form.

| HTTP | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` (kèm `fields`) |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `LOAN_LIMIT_EXCEEDED`, `OUT_OF_STOCK`, `NO_COPY_AVAILABLE`, `SUBSCRIPTION_INACTIVE`, `SUBSCRIPTION_ALREADY_EXISTS`, `ORDER_NOT_CANCELLABLE`, `INVALID_SHIPMENT_TRANSITION`, `SHIPMENT_ALREADY_RETRIED`, `LOAN_NOT_RETURNABLE`, `INVALID_COPY_STATE`, `DUPLICATE`, `IN_USE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_ERROR` |

Nguyên tắc: **409 cho mọi xung đột với trạng thái hiện tại.**

- **Backend:** service ném `DomainError` (không dùng `HttpException` của Nest — status không có trong bảng trên rơi về 500 `INTERNAL_ERROR`); một global exception filter chuyển thành JSON trên. Validate bằng `ZodValidationPipe` tự viết, dùng schema chung.
- **Lỗi Prisma:** `P2002` → 409 `DUPLICATE`; `P2003` → 409 `IN_USE` (vd. xóa sách đã phát sinh giao dịch); `P2025` → 404 `NOT_FOUND`. Lỗi khác → 500, ghi log bằng `Logger` của NestJS.
- **Frontend:** `error.tsx` và `not-found.tsx` cho từng nhóm route; `global-error.tsx` ở gốc app.

## 8. Kiểm thử

Tập trung vào luật nghiệp vụ và race condition; không test UI vụn vặt.

- **Unit:** Jest cho `apps/api`; Vitest cho `packages/shared` và `apps/web` (hợp với ESM của `jose`/Next). Nội dung: máy trạng thái shipment (Vitest ở shared, đủ ma trận 5×5); tính phí ship; tính kỳ hạn gói (đăng ký, gia hạn khi còn hạn/đã hết hạn — nhánh "đã hết hạn" chỉ xảy ra khi cron expire trong lúc payment gia hạn đang chờ, tức phép `max(now, currentPeriodEnd)`; không có API gia hạn gói `EXPIRED`); kiểm tra hạn mức mượn; điều kiện hợp lệ của refresh token (grace period, logout).
- **Integration (Jest + Supertest) trên Postgres thật** (`bookstore_test`). `globalSetup` chạy `prisma migrate deploy` bằng cùng bộ migration (gồm migration SQL viết tay); truncate dữ liệu giữa các test.
  - **Race:**
    - Gói `maxBooks = 2`, 5 request mượn song song (mỗi request 1 cuốn) → đúng 2 thành công, 3 nhận `LOAN_LIMIT_EXCEEDED`.
    - Sách còn 1 cuốn bán, 2 request mua song song → đúng 1 đơn, 1 `OUT_OF_STOCK`.
    - Sách còn 1 bản cho mượn, 2 user mượn song song → đúng 1 thành công, 1 `NO_COPY_AVAILABLE`.
    - 2 request đăng ký gói song song của cùng user → đúng 1 thành công, 1 `SUBSCRIPTION_ALREADY_EXISTS`.
    - 3 request refresh song song với cùng refresh token → cả 3 thành công.
    - Tồn kho bán còn 1, 2 request admin `delta: -1` song song → đúng 1 thành công, 1 `OUT_OF_STOCK`.
    - Callback thanh toán thành công và `failStalePayments` chạy đồng thời trên cùng payment → đúng một bên thắng, handler chạy đúng một lần.
  - **Danh mục (M1):** tìm không dấu; lọc thể loại / `sale` / `loan` đúng định nghĩa 4.8; phân trang và `total`; slug không tồn tại → 404; tạo sách có dòng `SaleStock` = 0; ISBN trùng → `DUPLICATE`; sửa `title` không đổi `slug`; xóa sách xóa theo stock và bản; delta làm âm → `OUT_OF_STOCK`; đánh dấu mất bản không `AVAILABLE` → `INVALID_COPY_STATE`; customer gọi `/admin/books*` → 403; vượt rate limit đăng nhập → 429.
  - **Mua sách (M2):** tạo đơn trừ kho đúng; `OUT_OF_STOCK` rollback toàn bộ; sách không bán → 400; phí ship `INNER`/`OUTER`; quote không ghi DB; địa chỉ CRUD, không đụng được địa chỉ người khác (404), invariant một mặc định, `city` ngoài danh sách → 400; hủy đơn → hoàn kho; callback thành công rồi hủy → 409; hủy hai lần → 200; xóa sách đã có đơn → `409 IN_USE`; thiếu handler cho đích → 500; `purgeRefreshTokens` xóa đúng tập (gọi với `Clock` giả).
  - **Luồng:** thanh toán thành công/thất bại cho đơn và gói; callback gọi lặp (idempotent); retry và hủy loan khi shipment `FAILED`; chuyển trạng thái shipment sai; shipment (M3): thanh toán thành công tạo đúng một `ORDER_DELIVERY` kèm event `PENDING` (callback lặp không tạo thêm), đi hết luồng thì đơn `PAID → SHIPPING → DELIVERED`, PATCH cùng trạng thái → `200` không thêm event, hai PATCH song song cùng đích → đúng một event và một lần gọi handler, retry khi đơn đang `SHIPPING` giữ nguyên đơn, retry lặp (tuần tự/song song) → `SHIPMENT_ALREADY_RETRIED`, retry theo chuỗi được phép, thiếu handler → `500` rollback, CHECK `shipment_order_delivery_has_order`, `GET /orders/:id` trả `shipments` cũ trước và mỗi cái kèm `events` cũ trước (có `note`); cron `failStalePayments` (đơn bị hủy và hoàn kho **đúng một lần**; subscription `PENDING_PAYMENT` bị hủy; payment gia hạn quá hạn → `FAILED` mà subscription `ACTIVE` giữ nguyên); khách hủy đơn rồi callback thành công đến sau → không đổi gì; gia hạn thành công → `currentPeriodEnd` kéo dài đúng (còn hạn: cộng từ `currentPeriodEnd`); gia hạn khi không có subscription `ACTIVE` → `SUBSCRIPTION_INACTIVE`; cron đã expire subscription trong lúc payment gia hạn chờ → thanh toán thành công đưa về `ACTIVE`, còn nếu user đã có subscription mở khác → payment `FAILED`, không vi phạm index; cron `expireSubscriptions` (gọi trực tiếp với `Clock` giả, kiểm tra user hết hạn không mượn được nhưng vẫn trả được); RBAC (customer gọi API admin → 403); endpoint ghi nhận body không phải JSON → 415.
- **E2E (Playwright):**
  1. Đăng ký gói → mượn → admin giao → trả → admin thu hồi.
  2. Mua → thanh toán mock → admin giao.
  3. Customer vào `/admin` bị chuyển hướng.

## 9. Môi trường dev và CI

- **Lệnh:**
  - `pnpm dev` → `docker compose up -d db && turbo dev`
  - `pnpm db:setup` → migrate + seed DB dev
  - `pnpm test` → unit + integration
  - `pnpm test:e2e` → Playwright
- **`.env.example`:** `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_INTERNAL_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`.
- **Seed:** 1 admin, 1 customer (thông tin từ biến môi trường); ~30 sách thuộc 6 thể loại (M1); 3 gói — **Basic** 2 cuốn / 79.000 đ, **Standard** 3 cuốn / 119.000 đ, **Premium** 5 cuốn / 179.000 đ (thêm ở M4, khi có model `Plan`).
  - Sách phối trộn để mọi bộ lọc và nhãn đều có dữ liệu: đa số vừa bán vừa cho mượn; vài cuốn chỉ cho mượn (`salePrice` null); vài cuốn chỉ bán (0 bản); 1–2 cuốn hết hàng.
  - **Idempotent:** upsert theo `isbn`; tồn kho và bản cho mượn chỉ tạo khi sách vừa được tạo, nên chạy lại `pnpm db:setup` không nhân đôi.
  - `coverUrl = https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false` (seed không cần mạng; `default=false` làm Open Library trả 404 thay vì ảnh trắng khi không có bìa). `next.config` khai báo `remotePatterns` cho `covers.openlibrary.org`; `BookCover` hiển thị placeholder khi `coverUrl` null hoặc ảnh lỗi.
- **CI (GitHub Actions):**
  - Mỗi push/PR: lint, typecheck, unit, integration (Postgres service container).
  - Nightly + `workflow_dispatch`: Playwright.

## 10. Mốc triển khai

Mỗi mốc có implementation plan riêng và chạy được độc lập khi hoàn thành.

| Mốc | Nội dung |
|---|---|
| **M0** | Monorepo, Docker Compose, Prisma + migration nền, `packages/shared`, auth (register/login/refresh/logout, grace period), RBAC, exception filter, layout web + design system, middleware |
| **M1** | Danh mục sách, tồn kho bán, bản cho mượn (4.8); trang `/books`, `/books/[slug]`; `/admin/books`; seed sách. Kèm nợ từ review M0: rate limit auth, hằng số tên cookie, sửa `apiServer` (merge `init`, `next` khi 401), proxy fail fast khi thiếu `JWT_ACCESS_SECRET`, log lỗi không phải parse trong `body-parse-error.handler.ts`, `apiClient` giữ `search` khi chuyển `/login` |
| **M2** | Địa chỉ (4.5a), giỏ hàng, đơn mua (4.5), thanh toán mock (4.1), cron `failStalePayments` + `cleanupRefreshTokens`, `PaymentOutcomeHandler` cho đơn (`onSucceeded` chỉ chuyển `PAID`, `onFailed` hủy + hoàn kho); `/cart`, `/checkout`, `/checkout/mock/[paymentId]`, `/account/orders`, `/account/orders/[id]`, `/account/addresses`; seed 2 địa chỉ cho customer (một Hà Nội, một tỉnh khác) |
| **M3** | Shipments (máy trạng thái trong shared, event, CAS, retry với `retryOfId` unique), handler `ORDER_DELIVERY` (kể cả `onSucceeded` tạo `Shipment ORDER_DELIVERY`); API admin đọc đơn và shipment; `GET /orders/:id` kèm shipments; `/admin/orders`, `/admin/orders/[id]`, `/admin/shipments`, `/admin/shipments/[id]`, timeline giao hàng ở `/account/orders/[id]`. Chưa làm: `cancel-loans`, handler `LOAN_*` (M4), on-demand revalidation (dời M4) |
| **M4** | Gói đăng ký (model `Plan` + seed 3 gói), FK `Payment.subscriptionId`, gia hạn, cron `expireSubscriptions`, `PaymentOutcomeHandler` cho subscription; mượn/trả sách, handler cho loan, hủy loan (`cancel-loans`), on-demand revalidation (xem Nợ đã biết); `/plans`, `/borrow/confirm`, `/account/loans`, `/account/subscription`, `/admin/loans` |
| **M5** | Playwright E2E, GitHub Actions CI |

### Nợ đã biết

- **Nợ từ M2:** tồn kho/nhãn availability trên trang công khai có thể lệch tối đa 60 giây sau ghi (chấp nhận theo §6.2; các luồng nghiệp vụ luôn kiểm tra lại server-side). On-demand revalidation **dời sang M4** (M3 không ghi `SaleStock`/`BookCopy` mới nên không làm lệch thêm; M4 mượn/trả đổi `availableCopies`): khi đó cần tag `books` trên các fetch `apiPublic`, một endpoint web nội bộ gọi `revalidateTag` bảo vệ bằng `REVALIDATE_SECRET`, và lời gọi sau commit, fail-tolerant (lỗi revalidate không được làm fail request; TTL 60s là lưới an toàn).
