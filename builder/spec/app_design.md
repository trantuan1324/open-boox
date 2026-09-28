# Open Boox — Thiết kế hệ thống

> Ngày: 2026-09-26 · Trạng thái: chờ duyệt
> Tài liệu này là **nguồn sự thật**. Các ghi chú trong `builder/brainstorm/` chỉ là lịch sử thảo luận; chỗ nào khác nhau thì theo tài liệu này.

## 1. Mục tiêu và phạm vi

**Mục đích:** dự án học tập / portfolio. Trọng tâm là kiến trúc Next.js + NestJS gọn, đúng chuẩn, có luật nghiệp vụ và xử lý đồng thời được kiểm thử. Mọi tích hợp bên ngoài (thanh toán, vận chuyển) đều mock sau interface rõ ràng.

**Ba dịch vụ:**
1. **Mượn sách theo gói đăng ký** — mỗi gói cho phép giữ tối đa N cuốn cùng lúc, không có hạn trả. Gói tự gia hạn hằng tháng, đổi/hủy gói theo mô hình kiểu Netflix (4.2).
2. **Bán sách** — giỏ hàng, thanh toán, đơn hàng, tồn kho.
3. **Giao sách tận nơi** — dùng chung cho giao đơn mua, giao sách mượn và thu hồi sách mượn.

**Vai trò:** `CUSTOMER`, `ADMIN` (RBAC).

**Giả định:** giao diện tiếng Việt, tiền VND; giao diện theo design system trong `ui_design/`.

**Không làm:** đánh giá/review, gợi ý sách, email thật, đa ngôn ngữ, ứng dụng mobile, hoàn tiền (kể cả tính tiền theo tỷ lệ khi đổi gói), thẻ/phương thức thanh toán lưu thật (tự trừ tiền định kỳ là mock — 4.2), vai trò shipper, trang admin quản lý gói, khách tự hủy yêu cầu mượn (loan `REQUESTED` chỉ bị hủy qua luồng shipment `FAILED` của admin — xem 4.6).

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
- `ShipmentStatusHandler { onStatusChanged(tx, shipment); onRetried?(tx, failed, created) }` — đăng ký theo `Shipment.type` bởi `orders` (`ORDER_DELIVERY`) và `loans` (`LOAN_DELIVERY`, `LOAN_PICKUP`). `onRetried` tùy chọn (chỉ `loans` cài — 4.6).
- `loans` import `subscriptions` và `shipments` (hướng cao → thấp); `subscriptions` không import `loans`.

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
- **`Subscription`**: `userId`, `planId`, `nextPlanId?` (gói hạ cấp chờ áp ở kỳ sau), `status` `PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED`, `currentPeriodStart?`, `currentPeriodEnd?`, `cancelAtPeriodEnd` (mặc định `false`), `createdAt`.
  - **Partial unique index** (migration SQL viết tay, Prisma không khai báo được):
    `CREATE UNIQUE INDEX subscription_one_open_per_user ON "Subscription"("userId") WHERE status IN ('PENDING_PAYMENT','ACTIVE');`
  - Seed 3 gói (§9); không có API quản lý gói.
- **`Loan`**: `userId`, `subscriptionId` (`Restrict`), `bookCopyId` (`Restrict`), `status` `REQUESTED | ACTIVE | RETURN_REQUESTED | RETURNED | CANCELLED`, `deliveryShipmentId` (FK → Shipment, `Restrict`), `returnShipmentId?` (FK → Shipment, `Restrict`), `requestedAt`, `deliveredAt?`, `returnedAt?`. Index `(userId, status)`, `(deliveryShipmentId)`, `(returnShipmentId)`.
  - Tiến độ giao hàng xem ở `Shipment`, Loan không lặp trạng thái đó. Sau retry, `deliveryShipmentId`/`returnShipmentId` trỏ tới shipment **mới** (4.6).
  - `bookCopyId` `Restrict`: xóa `Book` cascade sang `BookCopy` bị chặn khi bản đã từng được mượn → `P2003` → `409 IN_USE`.
  - **Thứ tự khóa:** mọi thao tác ghi nhiều dòng `Loan` (trả sách, handler giao/thu hồi, `onRetried`, `cancel-loans`) trước hết khóa bằng `SELECT id FROM "Loan" WHERE … ORDER BY id FOR UPDATE` rồi mới `updateMany` — `UPDATE … WHERE id IN (…)` không đảm bảo thứ tự khóa dòng, hai transaction chồng nhau có thể deadlock (`40P01` → 500 thay vì 409).
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
  - M2 tạo sẵn cột `subscriptionId` (nullable, **chưa có FK** — thêm ở M4 cùng bảng `Subscription`). Index `(subscriptionId)`.
  - Một Order có đúng một Payment (payment thất bại → đơn `CANCELLED`, không bao giờ có payment thứ hai). Một Subscription có nhiều Payment: lần đăng ký đầu + mỗi lần tự gia hạn; mỗi lúc tối đa một payment `PENDING` (4.2).

### 3.6 Giao hàng

- **`Shipment`**: `type` `ORDER_DELIVERY | LOAN_DELIVERY | LOAN_PICKUP`, `orderId?` (FK → Order, `Restrict`), `status` `PENDING | PICKED_UP | IN_TRANSIT | DELIVERED | FAILED`, `fee`, `addressSnapshot` (JSON), `retryOfId?` (**unique**, FK tự tham chiếu tới shipment `FAILED` được retry), `createdAt`, `updatedAt`. Index `(orderId)`, `(status, createdAt)`.
  - `type = ORDER_DELIVERY` bắt buộc có `orderId`: kiểm tra ở service, và CHECK constraint `shipment_order_delivery_has_order` (migration SQL viết tay) làm chốt chặn cuối.
  - Một Order có thể có nhiều Shipment (do retry, có thể thành chuỗi A→B→C); **shipment hiện tại** của đơn là cái có `createdAt` mới nhất. Một shipment sách mượn gom nhiều Loan qua `Loan.deliveryShipmentId` / `Loan.returnShipmentId`.
- **`ShipmentEvent`**: `shipmentId` (FK Cascade, index), `status`, `note?`, `createdAt`. Lịch sử trạng thái cho timeline; tạo shipment luôn ghi event `PENDING` đầu tiên. `note` do admin nhập **hiện cho khách** trên timeline.

Địa chỉ được **snapshot** vào Order và Shipment; sửa/xóa `Address` không ảnh hưởng đơn cũ.

## 4. Luồng nghiệp vụ

### 4.1 Thanh toán mock

- Interface `PaymentGateway.createCheckout(payment) → { redirectUrl }`. Bản `MockGateway` trả `/checkout/mock/:paymentId`.
- `PaymentGateway.charge(payment) → 'SUCCEEDED' | 'FAILED'` (từ M4): trừ tiền không cần user (tự gia hạn gói, 4.2). `MockGateway` luôn trả `SUCCEEDED`; nhánh thất bại chỉ kiểm bằng test (gateway giả), không có nút demo trên giao diện.
- `PaymentDto` = `{ id, amount, status, orderId, subscriptionId }` (từ M4 có `subscriptionId`, để trang mock biết chuyển về đâu).
- Trang mock có hai nút "Thanh toán thành công" / "Thất bại", gọi `POST /payments/:id/mock-callback { success }`.
- `GET /payments/:id` và `mock-callback` chỉ cho chủ payment; người khác → `404 NOT_FOUND`. Callback trên payment không còn `PENDING` → trả trạng thái hiện tại (idempotent); trang mock hiển thị trạng thái cuối thay vì nút.
- **Một chủ sở hữu duy nhất:** mọi chuyển `Payment` khỏi `PENDING` đều đi qua `PaymentsService.settle(paymentId, SUCCEEDED | FAILED)` — dùng bởi mock callback, lệnh hủy đơn của khách và cron. `settle` chạy trong một transaction: `UPDATE "Payment" SET status = … WHERE id = … AND status = 'PENDING'`; 0 dòng bị ảnh hưởng → payment đã được xử lý, trả trạng thái hiện tại, không gọi handler (idempotent, và khi callback thành công đua với cron thì chỉ một bên thắng). Nếu cập nhật được → gọi handler tương ứng trong cùng transaction.
- `settle` trả **payment hiện tại** (sau cập nhật, hoặc trạng thái đã có nếu 0 dòng); người gọi quyết định theo `status`.
- Handler **không bao giờ** tự đổi `Payment`; Order/Subscription không bị module nào khác hủy trực tiếp mà luôn đi qua `settle(…, FAILED)`.
- Nếu `onSucceeded` ném domain error (xung đột nghiệp vụ lúc kích hoạt), transaction bị rollback, rồi `settle` chuyển payment sang `FAILED` (mock: coi như cổng thanh toán từ chối) và gọi `onFailed`.

### 4.2 Gói đăng ký

Mô hình kiểu Netflix: mỗi user tối đa **một** subscription mở; gói **tự gia hạn** mỗi 30 ngày (không có gia hạn thủ công, nên không bao giờ trả trước hai kỳ — không cộng dồn); nâng cấp có hiệu lực ngay, hạ cấp có hiệu lực từ kỳ sau; hủy thì dùng tới hết kỳ đã trả. Không hoàn tiền, không tính theo tỷ lệ.

**Endpoint** (module `subscriptions`):

| Endpoint | Luật |
|---|---|
| `GET /plans` (công khai) | Gói `active`, sắp theo `monthlyPrice` tăng dần. |
| `GET /subscriptions/current` | `{ subscription }`: subscription mở (`PENDING_PAYMENT`/`ACTIVE`) của user kèm `plan`, `nextPlan?`, `pendingPaymentId?` (payment `PENDING` nếu có); không có → `{ subscription: null }` (bọc trong object vì Nest trả body rỗng khi handler trả `null`). |
| `POST /subscriptions { planCode }` | Tạo `Subscription PENDING_PAYMENT` + `Payment` (giá `monthlyPrice`), trả `{ subscriptionId, redirectUrl }`. Đã có subscription mở → `409 SUBSCRIPTION_ALREADY_EXISTS` (index ở 3.3 đảm bảo cả khi request song song). Gói `EXPIRED`/`CANCELLED` → user đăng ký mới (chọn lại gói nào cũng được). `planCode` không tồn tại/không `active` → `400 VALIDATION_ERROR`. |
| `POST /subscriptions/change-plan { planCode }` | Chỉ khi có subscription `ACTIVE` (khác → `409 SUBSCRIPTION_INACTIVE`). Trong transaction, khóa dòng subscription (`FOR UPDATE`): gói **đắt hơn** `planId` hiện tại → đổi `planId` ngay, xóa `nextPlanId` (không thu tiền ngay; giá mới áp từ lần tự gia hạn kế tiếp, ngày gia hạn giữ nguyên); gói **rẻ hơn** → đặt `nextPlanId`; **đúng** gói hiện tại → xóa `nextPlanId` (bỏ lệnh hạ cấp). Không tạo payment; không đổi `cancelAtPeriodEnd`. Trả subscription hiện tại. |
| `POST /subscriptions/cancel` · `POST /subscriptions/resume` | Đặt `cancelAtPeriodEnd = true` / `false`. Chỉ khi `ACTIVE` (khác → `409 SUBSCRIPTION_INACTIVE`); gọi lặp idempotent. |

- **Chấp nhận có chủ ý:** nâng cấp không thu tiền ngay → user có thể nâng lên gói lớn vào cuối kỳ để mượn nhiều hơn mà chưa trả chênh lệch (giống Netflix; dự án học tập).
- `SubscriptionsService.findActiveForUpdate(tx, userId) → { id, currentPeriodEnd, maxBooks } | null`: khóa (`FOR UPDATE`) dòng subscription `ACTIVE` của user, join `Plan` lấy `maxBooks` theo `planId`. Dùng bởi `loans` (4.3); kiểm tra `currentPeriodEnd > now` nằm ở `loans`.

**Handler thanh toán cho subscription** (`PaymentOutcomeHandler`, đích `subscription`):
- `onSucceeded`: subscription `PENDING_PAYMENT` → `ACTIVE`, `currentPeriodStart = now`, `currentPeriodEnd = now + 30 ngày`. Subscription `ACTIVE` (payment tự gia hạn) → kỳ mới: `currentPeriodStart = currentPeriodEnd cũ`, `currentPeriodEnd = start + 30 ngày` (gói đã được chốt ở bước 1 của tự gia hạn). Trạng thái khác → ném lỗi (không thể xảy ra: cron chỉ tạo payment cho `ACTIVE` và không đổi trạng thái khi còn payment `PENDING`).
- `onFailed`: `PENDING_PAYMENT` → `CANCELLED`; `ACTIVE` (tự gia hạn bị từ chối) → `EXPIRED`.
- Guard theo trạng thái (`updateMany … WHERE status = …`), như handler đơn.

**Tự gia hạn** (job `renewSubscriptions`, 4.7) — với mỗi subscription `ACTIVE` có `currentPeriodEnd ≤ now`:
1. Transaction: khóa dòng subscription (`FOR UPDATE`), kiểm tra lại (`ACTIVE`, `currentPeriodEnd ≤ now`, **không** có payment `PENDING` của subscription này — có thì bỏ qua). `cancelAtPeriodEnd` → `EXPIRED`, xong. Ngược lại chốt gói kỳ tới — `planId = nextPlanId ?? planId`, xóa `nextPlanId` — rồi tạo `Payment { subscriptionId, amount = giá gói đó }`. Chốt gói cùng lúc tạo payment để gói được tính tiền luôn là gói được áp; trừ tiền thất bại thì subscription `EXPIRED` nên việc đã đổi `planId` không còn ý nghĩa.
2. Sau commit: `gateway.charge(payment)` → `PaymentsService.settle(payment.id, kết quả)`.
- Job chết giữa 1 và 2 → payment `PENDING` còn lại; sau 30 phút `failStalePayments` chuyển `FAILED` → `onFailed` → subscription `EXPIRED`, user đăng ký lại. Chấp nhận (mock).
- `change-plan` và bước 1 cùng khóa dòng subscription nên xếp hàng: hạ cấp đến trước được chốt ở lần gia hạn này, đến sau nằm ở `nextPlanId` cho kỳ sau — không có trạng thái lẫn lộn. `change-plan` trong lúc payment gia hạn đang chờ settle (subscription vẫn `ACTIVE`) được phép và theo đúng luật trên.

**Mượn khi gói hết hạn:** trong khoảng từ `currentPeriodEnd` tới lúc job chạy (≤ 1 giờ), `loans` kiểm `currentPeriodEnd > now` nên chưa mượn được — chấp nhận. **Gói hết hạn khi còn sách:** user giữ sách đến khi trả, không phạt, không mượn thêm được; giao diện nhắc trả sách. Hạ cấp xuống gói có `maxBooks` nhỏ hơn số sách đang giữ: giữ sách, chỉ không mượn thêm (luật hạn mức 3.3 đếm theo user).

### 4.3 Mượn sách — `POST /loans { bookIds, addressId }`

Validate: `bookIds` 1–`LOANS_PER_BORROW_MAX` (5) phần tử, không trùng, **sort tăng dần** ngay đầu; `addressId` của chính user (khác → `404`); `bookId` không tồn tại → `400 VALIDATION_ERROR`.

Trong một transaction:
1. `SubscriptionsService.findActiveForUpdate(tx, userId)` — xếp hàng mọi request mượn của cùng user. Không có, hoặc `currentPeriodEnd ≤ now` → `409 SUBSCRIPTION_INACTIVE`.
2. Đếm loan đang mở theo user; nếu `đếm + bookIds.length > maxBooks` → `409 LOAN_LIMIT_EXCEEDED` (bằng đúng `maxBooks` vẫn được).
3. Với mỗi `bookId`: `InventoryService.reserveCopy(tx, bookId)` — **một câu** `UPDATE "BookCopy" SET status = 'RESERVED' WHERE id = (SELECT id FROM "BookCopy" WHERE "bookId" = $1 AND status = 'AVAILABLE' LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`. Không còn bản → `409 NO_COPY_AVAILABLE` (rollback toàn bộ).
4. Tạo **một** `Shipment LOAN_DELIVERY` (phí 0 đ, snapshot địa chỉ) qua `ShipmentsService.create` và các `Loan REQUESTED` trỏ tới nó.

Trả `{ loanIds, shipmentId }`. Không chặn mượn một đầu sách user đang giữ.

### 4.4 Trả sách — `POST /loans/return { loanIds, addressId }`

- Validate: `loanIds` 1–`LOANS_PER_RETURN_MAX` (10), không trùng; `addressId` của chính user (khác → `404`).
- Trong transaction: khóa các loan theo `ORDER BY id` (3.3), `updateMany` `WHERE id IN … AND userId = … AND status = 'ACTIVE'` → `RETURN_REQUESTED`; `count ≠ loanIds.length` → `409 LOAN_NOT_RETURNABLE` (rollback). Tạo **một** `Shipment LOAN_PICKUP` (phí 0 đ) và đặt `returnShipmentId` cho các loan. Được trả cả khi gói đã hết hạn.
- Trả `{ shipmentId }`.

### 4.4a Handler giao hàng cho loan và đọc loan

Handler `ShipmentStatusHandler` (module `loans`, đăng ký cho `LOAN_DELIVERY` và `LOAN_PICKUP`):
- `LOAN_DELIVERY` → `DELIVERED`: loan `REQUESTED` có `deliveryShipmentId = shipment.id` → `ACTIVE`, `deliveredAt = now`; các bản sách `RESERVED → ON_LOAN`.
- `LOAN_PICKUP` → `DELIVERED` (sách về kho): loan `RETURN_REQUESTED` có `returnShipmentId = shipment.id` → `RETURNED`, `returnedAt = now`; các bản sách `ON_LOAN → AVAILABLE`.
- Trạng thái khác (kể cả `FAILED`) → không làm gì.
- Bản sách đổi qua `InventoryService.moveCopies(tx, copyIds, from, to) → count`. `count` khác số loan vừa đổi → ném `Error` → `500`, rollback (fail-loud, không để bản sách kẹt trạng thái).

Đọc:
- `GET /loans?page=` → `{ items, total, page, pageSize }`, `LOAN_PAGE_SIZE = 20`, mới nhất trước, chỉ loan của user. Mỗi dòng: `id`, `status`, `requestedAt`, `deliveredAt?`, `returnedAt?`, `book { title, slug, coverUrl }`, `shipmentStatus` — của `deliveryShipmentId` khi `REQUESTED | ACTIVE | CANCELLED` (loan hủy thấy `FAILED`), của `returnShipmentId` khi `RETURN_REQUESTED | RETURNED`. Đọc trạng thái qua `ShipmentsService.statusesOf(ids)`.
- `GET /admin/loans?status=&shipmentId=&page=` (`@Roles('ADMIN')`, query dễ dãi như `/admin/orders`, `pageSize = 20`, mới nhất trước) — `shipmentId` khớp `deliveryShipmentId` **hoặc** `returnShipmentId`. Mỗi dòng: `id`, `customerEmail`, `bookTitle`, `barcode`, `status`, `requestedAt`, `deliveryShipmentId`, `returnShipmentId?`.

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
- `ShipmentsService` export `create(tx, { type, orderId?, fee, addressSnapshot })` (ghi kèm event `PENDING`), `listForOrder(db, orderId)`, `statusesOf(ids) → Map<id, status>` và `findForLoans(tx, id) → { type, status, retriedById } | null` (từ M4, cho `loans`).
- Handler `ORDER_DELIVERY` (module `orders`): `PICKED_UP` → `updateMany` đơn `PAID → SHIPPING`; `DELIVERED` → đơn `SHIPPING → DELIVERED`; trạng thái khác không làm gì. Guard theo trạng thái nên shipment retry đi lại `PICKED_UP` khi đơn đã `SHIPPING` không đổi gì.
- Đọc: `GET /admin/shipments?status=&type=&page=` (query dễ dãi như `/admin/orders`: `status`/`type` lạ → bỏ lọc, `page` lạ → 1; `pageSize = 20`, mới nhất trước, mỗi dòng kèm `orderId`, `retriedById?`); `GET /admin/shipments/:id` → shipment + `events` (cũ trước) + `retryOfId` + `retriedById`.

**Khi `FAILED`:**

| Loại | Hành động admin |
|---|---|
| `ORDER_DELIVERY` | Chỉ **retry**; đơn giữ nguyên trạng thái (`PAID` hoặc `SHIPPING`) và tiếp tục khi shipment mới tiến triển. |
| `LOAN_DELIVERY` | **Retry**, hoặc **hủy** (`POST /admin/shipments/:id/cancel-loans`): loan → `CANCELLED`, bản sách → `AVAILABLE`. |
| `LOAN_PICKUP` | Chỉ **retry**. |

Retry `POST /admin/shipments/:id/retry`: chỉ khi shipment `FAILED` (khác → `409 INVALID_SHIPMENT_TRANSITION`). Trong một transaction, theo thứ tự **`create` → `onRetried` → commit** (để `P2002` luôn xảy ra trước hook): tạo shipment mới cùng `type`, `fee`, `addressSnapshot`, `orderId`, `retryOfId = id` (kèm event `PENDING`); rồi gọi `onRetried(tx, failed, created)` nếu handler của `type` có cài. Retry cùng một shipment lần hai (tuần tự hay song song) dính unique `retryOfId` → `P2002` → `409 SHIPMENT_ALREADY_RETRIED`; lỗi này làm hỏng transaction Postgres, nên bắt **bên ngoài** `$transaction` rồi mới đổi mã. Retry theo chuỗi (retry shipment retry đã `FAILED`) được phép. Trả shipment mới.

`onRetried` của loan (M4): khóa loan theo `ORDER BY id` (3.3), rồi `LOAN_DELIVERY` chuyển các loan `REQUESTED` có `deliveryShipmentId = failed.id` sang `created.id`; `LOAN_PICKUP` chuyển các loan `RETURN_REQUESTED` có `returnShipmentId = failed.id` sang `created.id`. Không dòng nào (loan đã bị hủy) → `409 INVALID_SHIPMENT_TRANSITION`, rollback (không để lại shipment mới mồ côi).

**Hủy loan** `POST /admin/shipments/:id/cancel-loans` (controller trong module `loans` — `shipments` không import `loans`; `loans` đọc shipment qua `ShipmentsService.findForLoans`). Trong một transaction:
1. Không có shipment → `404`. `type ≠ LOAN_DELIVERY` hoặc `status ≠ FAILED` → `409 LOAN_NOT_CANCELLABLE`.
2. Khóa loan theo `ORDER BY id`, `updateMany` loan `REQUESTED` có `deliveryShipmentId = id` → `CANCELLED`; các bản sách `RESERVED → AVAILABLE` qua `moveCopies` (fail-loud như 4.4a).
3. `count = 0`: `retriedById ≠ null` → `409 LOAN_NOT_CANCELLABLE` (loan đã chuyển sang shipment retry); ngược lại → `200` (đã hủy trước đó — idempotent). Không kiểm "mọi loan đã `CANCELLED`" vì sau retry tập loan của shipment cũ là rỗng và điều kiện đó đúng vô nghĩa.

Cancel và retry loại trừ nhau: cancel trước → `onRetried` khớp 0 dòng → retry `409`; retry trước → `retriedById` khác null → cancel `409`. Chạy song song: cả hai ghi cùng các dòng loan nên xếp hàng trên khóa dòng; bên sau khớp 0 dòng (Postgres đánh giá lại `WHERE` sau khi chờ khóa), và câu đọc `retriedById` chạy sau đó (READ COMMITTED) thấy retry đã commit.

Trả: `200` kèm `AdminShipmentDetail` của shipment.

### 4.7 Cron (`@nestjs/schedule`)

Mỗi job nhận một `Clock` được inject để test gọi trực tiếp với thời gian giả.

| Job | Tần suất | Việc làm |
|---|---|---|
| `renewSubscriptions` | mỗi giờ (`@Cron('0 * * * *')`) | Gọi `SubscriptionsService.renewDue(now)`: `ACTIVE` có `currentPeriodEnd ≤ now` → `cancelAtPeriodEnd` thì `EXPIRED`, ngược lại tạo payment gia hạn và trừ tiền (4.2). Thay cho `expireSubscriptions` hằng ngày cũ. |
| `failStalePayments` | `@Interval` 5 phút | **Chỉ** gọi `settle(…, FAILED)` cho mọi `Payment PENDING` quá 30 phút. Việc hủy đơn + hoàn kho, hủy subscription `PENDING_PAYMENT`, expire subscription có payment gia hạn kẹt do `onFailed` đảm nhận. |
| `cleanupRefreshTokens` | hằng ngày 03:00 | Gọi `purgeRefreshTokens(now)` do `auth` export: xóa `RefreshToken` có `expiresAt < now`, hoặc `revokedAt`/`rotatedAt` < `now − 1 ngày`. |

Các job nằm ở module `scheduler`, chỉ gọi hàm do module sở hữu bảng export (`PaymentsService.settle`, `SubscriptionsService.renewDue`, `auth`) — không ghi thẳng bảng. Job theo lịch dùng `@Cron(…, { timeZone: 'Asia/Ho_Chi_Minh' })`.

### 4.9 On-demand revalidation (M4)

Trả nợ §6.2: trang công khai hết lệch tồn kho/số bản tối đa 60 giây sau ghi.
- **Web:** route handler `POST /internal/revalidate` (ngoài `/api` vì `/api/*` đã rewrite sang Nest; `proxy.ts` không chặn đường này). Header `x-revalidate-secret` so với env `REVALIDATE_SECRET` bằng `timingSafeEqual` trên **SHA-256 của hai chuỗi** (`timingSafeEqual` ném lỗi khi hai buffer khác độ dài — so hash cho độ dài cố định, không lộ độ dài secret); sai/thiếu → `401`; đúng → `revalidateTag('catalog', …)` (tham số hết hạn ngay theo API của Next 16.3.6 — xác nhận trong docs của bản cài lúc viết plan). **Mọi** fetch `apiPublic` (sách, thể loại, gói) gắn `next: { tags: ['catalog'], revalidate: 60 }` — làm mới thừa `/plans`, `/categories` là chủ đích (rẻ, đơn giản hơn tách tag); TTL 60s vẫn là lưới an toàn.
- **API:** `RevalidationService.catalogChanged()` (global): fire-and-forget `fetch` tới `${WEB_INTERNAL_URL}/internal/revalidate`, timeout 2 giây; lỗi chỉ ghi log, không bao giờ làm fail request. Thiếu `WEB_INTERNAL_URL` hoặc `REVALIDATE_SECRET` → bỏ qua (test).
- **Gọi sau commit** (sau khi service trả về) ở các chỗ đổi tồn kho bán hoặc số bản cho mượn: `POST /orders`, `POST /orders/:id/cancel`, mock-callback, `POST /loans`, `cancel-loans`, `PATCH /admin/shipments/:id` (mọi lần, cho đơn giản), CRUD sách + stock + copies + lost của admin, và job `failStalePayments` — chỉ khi danh sách payment quá hạn của lượt chạy **không rỗng** (không gọi vô điều kiện mỗi 5 phút).

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
| Tài khoản | `/account` · `/account/orders` · `/account/orders/[id]` (timeline giao hàng) · `/account/loans` (chọn nhiều cuốn để trả) · `/account/subscription` (gói hiện tại, đổi gói, hủy/tiếp tục gia hạn) · `/account/addresses` |
| Admin | `/admin` → chuyển hướng `/admin/orders` (trước M3: `/admin/books`) · `/admin/books` (danh sách) + `/admin/books/new` + `/admin/books/[id]` (sửa sách, nhập/xuất kho bán theo delta, thêm/đánh dấu mất bản cho mượn) · `/admin/orders` (lọc trạng thái) + `/admin/orders/[id]` (chỉ xem) · `/admin/shipments` (lọc trạng thái/loại) + `/admin/shipments/[id]` (timeline, đổi trạng thái, retry; hủy loan từ M4) · `/admin/loans` (chỉ xem). Chung một layout admin. |

Mọi danh sách có trạng thái rỗng (giỏ trống, chưa mượn, chưa có đơn).

### 6.2 Server / Client Components

- **Mặc định Server Component.** Đọc dữ liệu qua `apiServer()`: `fetch` tới URL nội bộ của NestJS, chuyển tiếp cookie.
  - Danh mục công khai: đọc qua `apiPublic()` — **không** chuyển tiếp cookie (để cache dùng chung cho mọi người), `revalidate: 60` — chấp nhận chậm tối đa 60 giây sau khi admin sửa; không sai nghiệp vụ vì checkout/mượn luôn kiểm tra lại phía server. Từ M4 mọi fetch `apiPublic` gắn tag `catalog` và được làm mới ngay sau ghi (4.9); 60 giây còn lại là lưới an toàn. API trả 404 → trang gọi `notFound()`.
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
- **`/admin/shipments`**: chip lọc trạng thái và loại, bảng (mã, loại, link đơn, trạng thái, ngày tạo, "Đã retry →" nếu có). **`/admin/shipments/[id]`**: timeline + Client Component: `select` chỉ các trạng thái kế tiếp hợp lệ, ô ghi chú (chú thích "Khách hàng sẽ thấy ghi chú này"), nút "Cập nhật"; nút "Tạo lần giao mới" chỉ khi `FAILED` và chưa retry → xong chuyển tới shipment mới. `409` → hiện lỗi rồi `router.refresh()` (từ M4: `router.replace('?error=<CODE>')`, xem 6.2c).

### 6.2c Gói, mượn/trả và admin loan (M4)

- **`/plans`** (công khai, `apiPublic`): card mỗi gói (tên, số cuốn, giá/tháng), nút "Đăng ký" → `POST /subscriptions` (chưa đăng nhập → `apiClient` chuyển `/login?next=/plans`) → chuyển `redirectUrl`. `409 SUBSCRIPTION_ALREADY_EXISTS` → hiện lỗi kèm link `/account/subscription`.
- **`/account/subscription`**: gói, trạng thái, kỳ hiện tại. `PENDING_PAYMENT` → link "Thanh toán" (`pendingPaymentId`). Có `nextPlan` → "Từ DD/MM chuyển sang <gói>". `cancelAtPeriodEnd` → "Kết thúc ngày DD/MM" + nút "Tiếp tục gói"; ngược lại nút "Hủy gia hạn". Các gói khác kèm nhãn "Nâng cấp — hiệu lực ngay" / "Hạ cấp — từ DD/MM"; gói hiện tại khi đang có `nextPlan` → "Giữ gói hiện tại". Không có subscription → link `/plans`. `/account` có link tới trang này và `/account/loans`.
- **Giỏ mượn:** localStorage `ob.cart.borrow`, mỗi dòng `{ bookId, slug, title, coverUrl }`, không có số lượng, trùng sách không thêm, trần `LOANS_PER_BORROW_MAX`; dữ liệu hỏng → rỗng; đồng bộ tab như giỏ mua. `/books/[slug]` có nút "Thêm vào giỏ mượn" khi `availableCopies > 0`; sách đã trong giỏ → nút "Đã trong giỏ" (disable); giỏ đủ `LOANS_PER_BORROW_MAX` → "Giỏ mượn đã đầy" (disable). `/cart` thêm danh sách "Mượn" (xóa dòng) với nút "Tiếp tục" → `/borrow/confirm`; header đếm cả hai giỏ.
- **`/borrow/confirm`**: danh sách sách, chọn địa chỉ (dùng lại phần chọn/tạo địa chỉ của `/checkout`), nút "Xác nhận mượn" (disable khi gửi) → `POST /loans` → xóa giỏ mượn → `/account/loans`. `SUBSCRIPTION_INACTIVE` → lỗi kèm link `/plans`; `LOAN_LIMIT_EXCEEDED`, `NO_COPY_AVAILABLE` → lỗi, cho sửa giỏ.
- **`/account/loans`**: danh sách phân trang (bìa, tên, nhãn trạng thái loan, trạng thái giao), trạng thái rỗng. Loan `ACTIVE` có checkbox (chọn tối đa `LOANS_PER_RETURN_MAX`, quá thì disable các ô còn lại); chọn địa chỉ + "Trả sách" → `POST /loans/return`. Nhắc "Gói đã hết hạn — hãy trả sách": trang gọi thêm `GET /subscriptions/current`; hiện khi kết quả không phải `ACTIVE` **và** trang đang xem có loan `ACTIVE` (chấp nhận: loan `ACTIVE` nằm ở trang sau thì trang 1 không nhắc).
- **`/checkout/mock/[paymentId]`**: payment có `subscriptionId` → xong chuyển `/account/subscription` (đơn → `/account/orders/[id]` như cũ).
- **Admin:** nav thành "Đơn hàng", "Giao hàng", "Mượn sách", "Sách". **`/admin/loans`**: chip lọc trạng thái, bảng (mã, email, sách, barcode, trạng thái, ngày yêu cầu, link shipment giao/thu hồi), phân trang, trạng thái rỗng. **`/admin/shipments/[id]`** với shipment loan: danh sách loan (`GET /admin/loans?shipmentId=`); nút "Hủy yêu cầu mượn" chỉ khi `LOAN_DELIVERY`, `FAILED` và chưa retry. `/admin/shipments`: cột đơn hiện "—" với shipment loan.
- **Cột "mã"** ở `/admin/orders`, `/admin/shipments`, `/admin/loans`: `shortCode(id)` trong `packages/shared` = 8 ký tự **cuối** của id, viết hoa (đầu cuid là timestamp, các dòng gần nhau trông như nhau); link vẫn dùng id đầy đủ.
- **Thông báo 409 không mất:** các điều khiển admin trên `/admin/shipments/[id]` khi gặp `409` gọi `router.replace('?error=<CODE>')` thay cho `router.refresh()`; trang server đọc `searchParams.error` và hiện banner ngoài phần form (form có thể biến mất sau khi render lại).

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
| 409 | `LOAN_LIMIT_EXCEEDED`, `OUT_OF_STOCK`, `NO_COPY_AVAILABLE`, `SUBSCRIPTION_INACTIVE`, `SUBSCRIPTION_ALREADY_EXISTS`, `ORDER_NOT_CANCELLABLE`, `INVALID_SHIPMENT_TRANSITION`, `SHIPMENT_ALREADY_RETRIED`, `LOAN_NOT_RETURNABLE`, `LOAN_NOT_CANCELLABLE`, `INVALID_COPY_STATE`, `DUPLICATE`, `IN_USE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_ERROR` |

Nguyên tắc: **409 cho mọi xung đột với trạng thái hiện tại.**

- **Backend:** service ném `DomainError` (không dùng `HttpException` của Nest — status không có trong bảng trên rơi về 500 `INTERNAL_ERROR`); một global exception filter chuyển thành JSON trên. Validate bằng `ZodValidationPipe` tự viết, dùng schema chung.
- **Lỗi Prisma:** `P2002` → 409 `DUPLICATE`; `P2003` → 409 `IN_USE` (vd. xóa sách đã phát sinh giao dịch); `P2025` → 404 `NOT_FOUND`. Lỗi khác → 500, ghi log bằng `Logger` của NestJS.
- **Frontend:** `error.tsx` và `not-found.tsx` cho từng nhóm route; `global-error.tsx` ở gốc app.

## 8. Kiểm thử

Tập trung vào luật nghiệp vụ và race condition; không test UI vụn vặt.

- **Unit:** Jest cho `apps/api`; Vitest cho `packages/shared` và `apps/web` (hợp với ESM của `jose`/Next). Nội dung: máy trạng thái shipment (Vitest ở shared, đủ ma trận 5×5); tính phí ship; tính kỳ hạn gói (kích hoạt: `now + 30`; tự gia hạn: nối tiếp từ `currentPeriodEnd` cũ); phân loại `change-plan` (đắt hơn / rẻ hơn / cùng gói); kiểm tra hạn mức mượn (kể cả bằng đúng `maxBooks`); `shortCode`; điều kiện hợp lệ của refresh token (grace period, logout).
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
  - **Luồng:** thanh toán thành công/thất bại cho đơn và gói; callback gọi lặp (idempotent); retry và hủy loan khi shipment `FAILED`; chuyển trạng thái shipment sai; shipment (M3): thanh toán thành công tạo đúng một `ORDER_DELIVERY` kèm event `PENDING` (callback lặp không tạo thêm), đi hết luồng thì đơn `PAID → SHIPPING → DELIVERED`, PATCH cùng trạng thái → `200` không thêm event, hai PATCH song song cùng đích → đúng một event và một lần gọi handler, retry khi đơn đang `SHIPPING` giữ nguyên đơn, retry lặp (tuần tự/song song) → `SHIPMENT_ALREADY_RETRIED`, retry theo chuỗi được phép, thiếu handler → `500` rollback, CHECK `shipment_order_delivery_has_order`, `GET /orders/:id` trả `shipments` cũ trước và mỗi cái kèm `events` cũ trước (có `note`); cron `failStalePayments` (đơn bị hủy và hoàn kho **đúng một lần**; subscription `PENDING_PAYMENT` bị hủy; payment tự gia hạn kẹt → `FAILED` và subscription `EXPIRED`); khách hủy đơn rồi callback thành công đến sau → không đổi gì; RBAC (customer gọi API admin → 403); endpoint ghi nhận body không phải JSON → 415.
  - **Gói (M4):** đăng ký → thanh toán thành công `ACTIVE` 30 ngày / thất bại `CANCELLED`; `GET /subscriptions/current` kèm `pendingPaymentId`; `change-plan` nâng cấp đổi `planId` ngay, hạ cấp đặt `nextPlanId`, chọn lại gói hiện tại xóa `nextPlanId`, không `ACTIVE` → `SUBSCRIPTION_INACTIVE`; `cancel`/`resume` idempotent; `renewSubscriptions` (gọi trực tiếp với `Clock` giả): gia hạn nối kỳ đúng và áp `nextPlanId`, `cancelAtPeriodEnd` → `EXPIRED` không tạo payment, gateway giả trả `FAILED` → `EXPIRED`, chạy hai lần liên tiếp chỉ tạo một payment, subscription chưa tới hạn không bị đụng; hết hạn thì không mượn được nhưng vẫn trả được; `change-plan` song song với `renewSubscriptions` → kết quả nhất quán (hạ cấp hoặc áp kỳ này, hoặc còn nằm ở `nextPlanId`).
  - **Mượn/trả (M4):** luồng đủ mượn → giao → trả → thu hồi, kiểm `BookCopy.status` từng bước; `LOAN_DELIVERY` `FAILED` → `cancel-loans` (loan `CANCELLED`, bản `AVAILABLE`), gọi lại → `200`; `FAILED` → retry (loan trỏ shipment mới) → `cancel-loans` shipment cũ → `409 LOAN_NOT_CANCELLABLE`; `cancel-loans` rồi retry → `409`, không có shipment mới; `cancel-loans` trên `ORDER_DELIVERY`/`LOAN_PICKUP` hoặc shipment chưa `FAILED` → `409 LOAN_NOT_CANCELLABLE`; retry `LOAN_PICKUP` trỏ `returnShipmentId` sang shipment mới; trả loan không `ACTIVE`/của người khác → `LOAN_NOT_RETURNABLE`; hai request trả chồng nhau (`{a,b}` và `{b,c}`) → một thành công, một `409`, không deadlock, `c` vẫn `ACTIVE`; `GET /loans` trả `shipmentStatus` đúng cả loan `CANCELLED` (`FAILED`); xóa sách từng được mượn → `409 IN_USE`; retry song song với `cancel-loans` → đúng một bên thắng.
  - **Thiếu handler → 500 + rollback:** khi M4 đăng ký đủ handler cho mọi đích/loại, kiểm bằng integration test khởi tạo trực tiếp `new PaymentsService(…)` / `new ShipmentsService(…)` với registry rỗng trên DB test (không thêm API gỡ đăng ký vào code production); các test "thiếu handler" dùng đích/loại chưa đăng ký trong e2e cũ bị bỏ, handler `LOAN_DELIVERY` giả trong `shipments.e2e-spec.ts` được thay bằng luồng loan thật.
  - **Revalidation (M4):** route `/internal/revalidate` sai secret → 401, đúng → gọi `revalidateTag` (Vitest); `RevalidationService` không ném khi `fetch` lỗi và bỏ qua khi thiếu env (Jest).
- **E2E (Playwright, M5):** package workspace `e2e/` ở gốc (`@playwright/test`), chỉ Chromium, `workers: 1`, `retries: 0`, trace/screenshot giữ khi fail. Script tên `test:e2e` (không phải `test`) để `turbo test` không chạy nó.
  - **DB riêng `bookstore_e2e`** (`DATABASE_URL_E2E`), reset mỗi lần chạy nên chạy lại cho cùng kết quả và không đụng DB dev. `globalSetup`: `prisma migrate reset --force` (tự tạo DB nếu chưa có) → seed → build. **Bắt buộc:** Prisma và seed đọc `DATABASE_URL`, nên mọi lệnh con phải chạy với `DATABASE_URL=$DATABASE_URL_E2E` đặt trong env process cha (`dotenv-cli` không ghi đè biến đã có). Quên điểm này là `reset --force` xóa DB dev — Lớp chặn thứ hai: trước khi reset, `globalSetup` đọc `DATABASE_URL` **trực tiếp từ file `.env`** (parse bằng `dotenv`, không dùng `process.env` vì đã bị override) và dừng nếu trùng URL đích; không có file `.env` thì bỏ qua kiểm tra.
  - **Production build, port riêng:** API `node dist/main.js` ở `API_PORT=4100`, web `next start --port 3100` (không đụng server dev 4000/3000); `reuseExistingServer: false`. Build shared → api → web gọi thẳng `pnpm --filter`, **không qua turbo** (strict env mode lọc biến override, cache có thể phát lại bản build trỏ sai port). `E2E_SKIP_BUILD=1` bỏ qua bước build khi đã build sẵn.
  - **Env override khai báo một chỗ** trong `playwright.config.ts`, truyền cho `globalSetup` và `webServer.env`: `DATABASE_URL`, `API_PORT=4100`, `API_INTERNAL_URL=http://localhost:4100`, `WEB_INTERNAL_URL=http://localhost:3100`; phần còn lại (JWT secrets, `REVALIDATE_SECRET`, seed accounts) lấy từ `.env`. `API_INTERNAL_URL` cần **cả lúc build** (rewrites trong `next.config.ts` được đóng vào bản build) **lẫn runtime** (`proxy.ts` gọi `/api/auth/refresh`; thiếu `JWT_ACCESS_SECRET` thì proxy ném lỗi → mọi trang 500). Hệ quả chấp nhận: sau `pnpm test:e2e`, `apps/web/.next` là bản build trỏ API 4100 (`next dev` dùng `.next/dev` riêng nên không ảnh hưởng).
  - **Kịch bản** (dùng admin và customer seed; customer seed chưa có gói, có 2 địa chỉ):
    1. Customer `/plans` đăng ký Basic → trang mock bấm thành công → thêm một sách cho mượn vào giỏ mượn → `/borrow/confirm` → `/account/loans` thấy loan chờ giao. Admin chuyển `LOAN_DELIVERY` qua `PICKED_UP → IN_TRANSIT → DELIVERED`. Customer thấy loan đang mượn → trả. Admin chuyển `LOAN_PICKUP` qua `PICKED_UP → IN_TRANSIT → DELIVERED`. Customer thấy loan đã trả.
    2. Customer thêm sách bán vào giỏ → `/checkout` → mock thanh toán thành công. Admin chuyển `ORDER_DELIVERY` qua `PICKED_UP → IN_TRANSIT → DELIVERED`. Customer thấy đơn đã giao ở `/account/orders/[id]`.
    3. Customer đăng nhập vào `/admin` → chuyển hướng về `/`.
  - Selector ưu tiên `getByRole`/`getByLabel`; chỉ thêm `data-testid` nơi không có tên accessible.

## 9. Môi trường dev và CI

- **Lệnh:**
  - `pnpm dev` → `docker compose up -d db && turbo dev`
  - `pnpm db:setup` → migrate + seed DB dev
  - `pnpm test` → unit + integration
  - `pnpm test:e2e` → `docker compose up -d --wait db` + Playwright (8, M5)
  - `pnpm lint` → ESLint mọi package qua turbo (M5)
- **`.env.example`:** `DATABASE_URL`, `DATABASE_URL_TEST`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_INTERNAL_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD`; từ M4: `WEB_INTERNAL_URL`, `REVALIDATE_SECRET` (dùng chung cho api và web, 4.9); từ M5: `DATABASE_URL_E2E`.
- **Lint (M5):** ESLint flat config từng package — `apps/web` dùng `eslint-config-next` (core-web-vitals + typescript), `apps/api` và `packages/shared` dùng `typescript-eslint` recommended (không type-checked). Script `lint` mỗi package, task `lint` trong turbo. Không dùng Prettier. Package `e2e/` chưa lint.
- **Seed:** 1 admin, 1 customer (thông tin từ biến môi trường); ~30 sách thuộc 6 thể loại (M1); 3 gói — **Basic** 2 cuốn / 79.000 đ, **Standard** 3 cuốn / 119.000 đ, **Premium** 5 cuốn / 179.000 đ (thêm ở M4, khi có model `Plan`).
  - Sách phối trộn để mọi bộ lọc và nhãn đều có dữ liệu: đa số vừa bán vừa cho mượn; vài cuốn chỉ cho mượn (`salePrice` null); vài cuốn chỉ bán (0 bản); 1–2 cuốn hết hàng.
  - **Idempotent:** upsert theo `isbn`; tồn kho và bản cho mượn chỉ tạo khi sách vừa được tạo, nên chạy lại `pnpm db:setup` không nhân đôi.
  - `coverUrl = https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false` (seed không cần mạng; `default=false` làm Open Library trả 404 thay vì ảnh trắng khi không có bìa). `next.config` khai báo `remotePatterns` cho `covers.openlibrary.org`; `BookCover` hiển thị placeholder khi `coverUrl` null hoặc ảnh lỗi.
- **CI (GitHub Actions):**
  - `ci.yml` — `push` lên `master` và mọi `pull_request` (`concurrency` hủy lần chạy cũ): service `postgres:17` (`POSTGRES_USER`/`POSTGRES_PASSWORD` = `openboox`, `POSTGRES_DB=bookstore_test`, cổng `5433:5432`); `pnpm/action-setup` + `setup-node` (`.nvmrc`, cache pnpm); `pnpm install --frozen-lockfile` → `cp .env.example .env` → `pnpm lint` → `pnpm typecheck` → `pnpm turbo test` (không gọi `pnpm test` vì nó chạy `docker compose`).
  - `e2e.yml` — `schedule` `cron: '0 19 * * *'` (UTC = 02:00 giờ Việt Nam) + `workflow_dispatch`: cùng service Postgres; `pnpm/action-setup` + `setup-node` như `ci.yml`; `pnpm install --frozen-lockfile`; `cp .env.example .env`; `pnpm exec playwright install --with-deps chromium`; chạy package e2e trực tiếp (override port nằm trong `playwright.config.ts`); upload `playwright-report` khi fail. `schedule` chỉ chạy trên default branch — repo GitHub đặt `master` làm default.
  - M5 chỉ xong khi cả hai workflow chạy xanh trên GitHub thật.

## 10. Mốc triển khai

Mỗi mốc có implementation plan riêng và chạy được độc lập khi hoàn thành.

| Mốc | Nội dung |
|---|---|
| **M0** | Monorepo, Docker Compose, Prisma + migration nền, `packages/shared`, auth (register/login/refresh/logout, grace period), RBAC, exception filter, layout web + design system, middleware |
| **M1** | Danh mục sách, tồn kho bán, bản cho mượn (4.8); trang `/books`, `/books/[slug]`; `/admin/books`; seed sách. Kèm nợ từ review M0: rate limit auth, hằng số tên cookie, sửa `apiServer` (merge `init`, `next` khi 401), proxy fail fast khi thiếu `JWT_ACCESS_SECRET`, log lỗi không phải parse trong `body-parse-error.handler.ts`, `apiClient` giữ `search` khi chuyển `/login` |
| **M2** | Địa chỉ (4.5a), giỏ hàng, đơn mua (4.5), thanh toán mock (4.1), cron `failStalePayments` + `cleanupRefreshTokens`, `PaymentOutcomeHandler` cho đơn (`onSucceeded` chỉ chuyển `PAID`, `onFailed` hủy + hoàn kho); `/cart`, `/checkout`, `/checkout/mock/[paymentId]`, `/account/orders`, `/account/orders/[id]`, `/account/addresses`; seed 2 địa chỉ cho customer (một Hà Nội, một tỉnh khác) |
| **M3** | Shipments (máy trạng thái trong shared, event, CAS, retry với `retryOfId` unique), handler `ORDER_DELIVERY` (kể cả `onSucceeded` tạo `Shipment ORDER_DELIVERY`); API admin đọc đơn và shipment; `GET /orders/:id` kèm shipments; `/admin/orders`, `/admin/orders/[id]`, `/admin/shipments`, `/admin/shipments/[id]`, timeline giao hàng ở `/account/orders/[id]`. Chưa làm: `cancel-loans`, handler `LOAN_*` (M4), on-demand revalidation (dời M4) |
| **M4** | Một nhánh, plan chia hai nửa, mỗi nửa xong đều chạy được. **Nửa A:** gói đăng ký kiểu Netflix (4.2: model `Plan` + seed 3 gói, `Subscription` có `nextPlanId`/`cancelAtPeriodEnd`, FK `Payment.subscriptionId`, `PaymentOutcomeHandler` cho subscription, `change-plan`/`cancel`/`resume`, `PaymentGateway.charge`, cron `renewSubscriptions` thay `expireSubscriptions`), on-demand revalidation (4.9); `/plans`, `/account/subscription`, trang mock checkout cho subscription. **Nửa B:** mượn/trả (4.3, 4.4), handler `LOAN_*` + `onRetried` (4.4a, 4.6), `cancel-loans`, `GET /loans`, `GET /admin/loans`; giỏ mượn, `/borrow/confirm`, `/account/loans`, `/admin/loans`, danh sách loan + nút hủy ở `/admin/shipments/[id]`. Kèm nợ M3: cột "mã" (`shortCode`), thông báo 409 không mất (6.2c), thay handler `LOAN_DELIVERY` giả trong test |
| **M5** | Nhánh `m5-e2e-ci`. ESLint cho web/api/shared + `pnpm lint` (9); Playwright E2E 3 kịch bản trên DB `bookstore_e2e` và production build port 4100/3100 (8); GitHub Actions `ci.yml` + `e2e.yml` (9). Xong khi `pnpm lint`/`typecheck`/`test` xanh, `pnpm test:e2e` xanh hai lần liên tiếp ở local, cả hai workflow xanh trên GitHub |

### Nợ đã biết

- **Nợ từ M2 (trả ở M4, 4.9):** tồn kho/nhãn availability trên trang công khai lệch tối đa 60 giây sau ghi. M4 thêm on-demand revalidation; sau M4 chỉ còn lệch khi lời gọi revalidate thất bại (fail-tolerant, TTL 60s là lưới an toàn).
- **Chấp nhận có chủ ý (M4):** nâng cấp gói không thu tiền ngay (4.2); job gia hạn chết giữa chừng làm subscription `EXPIRED` sau 30 phút (4.2); khoảng ≤ 1 giờ sau `currentPeriodEnd` chưa mượn được cho tới khi job gia hạn chạy; nhánh tự trừ tiền thất bại không demo được trên giao diện.
