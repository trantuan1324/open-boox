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

- `PaymentSucceededHandler` / `PaymentFailedHandler` — đăng ký theo đích thanh toán (order / subscription) bởi `orders` và `subscriptions`.
- `ShipmentStatusHandler` — đăng ký theo `Shipment.type` bởi `orders` (`ORDER_DELIVERY`) và `loans` (`LOAN_DELIVERY`, `LOAN_PICKUP`).

Handler được gọi **trong cùng Prisma interactive transaction** với thao tác gốc (tham số `tx`), nên thay đổi luôn nguyên tử; không dùng event bus.

## 3. Mô hình dữ liệu

Tiền là **số nguyên VND**. Id là `cuid`. Enum viết hoa. Các thời điểm là `timestamptz`.

### 3.1 Tài khoản

- **`User`**: `email` (unique), `passwordHash` (argon2), `fullName`, `phone`, `role` `CUSTOMER | ADMIN`.
- **`RefreshToken`**: `userId`, `tokenHash`, `expiresAt`, `rotatedAt?`, `revokedAt?`.
  - Xoay vòng → đặt `rotatedAt = now`. Logout → đặt `revokedAt = now`.
  - Token hợp lệ khi: chưa hết hạn **và** `revokedAt IS NULL` **và** (`rotatedAt IS NULL` **hoặc** `rotatedAt > now − 30s`). 30 giây là grace period cho các request refresh song song.
- **`Address`**: `userId`, `recipientName`, `phone`, `line`, `district`, `city`, `zone` `INNER | OUTER`, `isDefault`.

### 3.2 Danh mục và kho

- **`Category`**: `name`, `slug` (unique).
- **`Book`**: `slug` (unique), `title`, `author` (chuỗi), `isbn`, `description`, `coverUrl?`, `categoryId`, `salePrice?` (null = không bán).
- **`SaleStock`**: `bookId` (PK), `quantity` (≥ 0). Tồn kho bán, theo số lượng.
- **`BookCopy`**: `bookId`, `barcode` (unique), `status` `AVAILABLE | RESERVED | ON_LOAN | LOST`. Mỗi cuốn cho mượn là một bản ghi.

| Sự kiện | `BookCopy.status` |
|---|---|
| Tạo yêu cầu mượn | `AVAILABLE → RESERVED` |
| Giao sách mượn thành công | `RESERVED → ON_LOAN` |
| Hủy yêu cầu mượn | `RESERVED → AVAILABLE` |
| Sách thu hồi về tới kho | `ON_LOAN → AVAILABLE` |
| Admin đánh dấu mất | `→ LOST` |

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
- **`OrderItem`**: `orderId`, `bookId`, `quantity`, `unitPrice` (giá chốt lúc mua).

### 3.5 Thanh toán (mock)

- **`Payment`**: `userId`, `orderId?`, `subscriptionId?`, `amount`, `status` `PENDING | SUCCEEDED | FAILED`, `providerRef?`, `createdAt`.
  - CHECK constraint (migration SQL): đúng một trong `orderId`, `subscriptionId` khác null.

### 3.6 Giao hàng

- **`Shipment`**: `type` `ORDER_DELIVERY | LOAN_DELIVERY | LOAN_PICKUP`, `orderId?`, `status` `PENDING | PICKED_UP | IN_TRANSIT | DELIVERED | FAILED`, `fee`, `addressSnapshot` (JSON), `createdAt`.
  - `type = ORDER_DELIVERY` bắt buộc có `orderId` (kiểm tra ở service).
  - Một Order có thể có nhiều Shipment (do retry). Một shipment sách mượn gom nhiều Loan qua `Loan.deliveryShipmentId` / `Loan.returnShipmentId`.
- **`ShipmentEvent`**: `shipmentId`, `status`, `note?`, `createdAt`. Lịch sử trạng thái cho timeline.

Địa chỉ được **snapshot** vào Order và Shipment; sửa/xóa `Address` không ảnh hưởng đơn cũ.

## 4. Luồng nghiệp vụ

### 4.1 Thanh toán mock

- Interface `PaymentGateway.createCheckout(payment) → { redirectUrl }`. Bản `MockGateway` trả `/checkout/mock/:paymentId`.
- Trang mock có hai nút "Thanh toán thành công" / "Thất bại", gọi `POST /payments/:id/mock-callback { success }`.
- **Một chủ sở hữu duy nhất:** mọi chuyển `Payment` khỏi `PENDING` đều đi qua `PaymentsService.settle(paymentId, SUCCEEDED | FAILED)` — dùng bởi mock callback, lệnh hủy đơn của khách và cron. `settle` chạy trong một transaction: `UPDATE "Payment" SET status = … WHERE id = … AND status = 'PENDING'`; 0 dòng bị ảnh hưởng → payment đã được xử lý, trả trạng thái hiện tại, không gọi handler (idempotent, và khi callback thành công đua với cron thì chỉ một bên thắng). Nếu cập nhật được → gọi handler tương ứng trong cùng transaction.
- Handler **không bao giờ** tự đổi `Payment`; Order/Subscription không bị module nào khác hủy trực tiếp mà luôn đi qua `settle(…, FAILED)`.
- Nếu `PaymentSucceededHandler` ném domain error (xung đột nghiệp vụ lúc kích hoạt), transaction bị rollback, rồi `settle` chuyển payment sang `FAILED` (mock: coi như cổng thanh toán từ chối) và gọi `PaymentFailedHandler`.

### 4.2 Gói đăng ký

- **Đăng ký** `POST /subscriptions { planCode }`: tạo `Subscription PENDING_PAYMENT` + `Payment`. Nếu user đã có subscription `PENDING_PAYMENT` hoặc `ACTIVE` → `409 SUBSCRIPTION_ALREADY_EXISTS` (index ở 3.3 đảm bảo cả khi request song song).
  - Thanh toán thành công → `ACTIVE`, `currentPeriodStart = now`, `currentPeriodEnd = now + 30 ngày`.
  - Thanh toán thất bại → `CANCELLED`.
- **Gia hạn** `POST /subscriptions/renew`: **chỉ** áp dụng cho subscription `ACTIVE` của user (tối đa một, do index); không có → `409 SUBSCRIPTION_INACTIVE`. Gói đã `EXPIRED` thì user **đăng ký mới** (được chọn lại cùng gói) — không có đường "kích hoạt lại" một subscription `EXPIRED` qua API.
  - Thành công → `currentPeriodEnd = max(now, currentPeriodEnd) + 30 ngày`, trạng thái `ACTIVE`. (Nếu cron đã chuyển subscription sang `EXPIRED` trong lúc payment gia hạn đang chờ, bước này đưa nó về `ACTIVE`; nếu user đã kịp đăng ký subscription khác nên vi phạm index → rollback và payment `FAILED` theo 4.1.)
  - Thất bại → subscription giữ nguyên.
- `PaymentFailedHandler` cho subscription: subscription đang `PENDING_PAYMENT` → `CANCELLED`; trạng thái khác (payment gia hạn) → giữ nguyên.
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

Trong một transaction:
1. Lấy giá từ DB; sách không bán (`salePrice` null) → `400 VALIDATION_ERROR`.
2. Trừ kho từng sách: `UPDATE "SaleStock" SET quantity = quantity - $n WHERE "bookId" = $id AND quantity >= $n`. 0 dòng bị ảnh hưởng → `409 OUT_OF_STOCK` (rollback).
3. Phí ship: `INNER` 20.000 đ, `OUTER` 35.000 đ.
4. Tạo `Order PENDING_PAYMENT`, `OrderItem`, `Payment`.

Sau đó:
- Thanh toán thành công → `PAID`, tạo `Shipment ORDER_DELIVERY`.
- Thanh toán thất bại → `CANCELLED`, hoàn kho.
- Khách hủy được chỉ khi `PENDING_PAYMENT` (`POST /orders/:id/cancel`): gọi `settle(payment, FAILED)`, handler hủy đơn + hoàn kho. Đơn không còn `PENDING_PAYMENT` → `409 ORDER_NOT_CANCELLABLE`.
- Shipment `PICKED_UP` → đơn `SHIPPING`; `DELIVERED` → đơn `DELIVERED`.

### 4.6 Shipment

- Máy trạng thái: `PENDING → PICKED_UP → IN_TRANSIT → DELIVERED`; từ mọi trạng thái chưa `DELIVERED` được chuyển sang `FAILED`. `DELIVERED` và `FAILED` là trạng thái cuối. Chuyển sai → `409 INVALID_SHIPMENT_TRANSITION`.
- Mỗi lần đổi trạng thái ghi một `ShipmentEvent` và gọi `ShipmentStatusHandler` trong cùng transaction.
- Admin đổi trạng thái: `PATCH /admin/shipments/:id { status, note? }`.

**Khi `FAILED`:**

| Loại | Hành động admin |
|---|---|
| `ORDER_DELIVERY` | Chỉ **retry**; đơn giữ nguyên trạng thái (`PAID` hoặc `SHIPPING`) và tiếp tục khi shipment mới tiến triển. |
| `LOAN_DELIVERY` | **Retry**, hoặc **hủy** (`POST /admin/shipments/:id/cancel-loans`): loan → `CANCELLED`, bản sách → `AVAILABLE`. |
| `LOAN_PICKUP` | Chỉ **retry**. |

Retry `POST /admin/shipments/:id/retry`: tạo shipment mới cùng `type`, `fee`, `addressSnapshot`; trỏ lại `orderId` / `Loan.deliveryShipmentId` / `Loan.returnShipmentId` về shipment mới.

### 4.7 Cron (`@nestjs/schedule`)

Mỗi job nhận một `Clock` được inject để test gọi trực tiếp với thời gian giả.

| Job | Tần suất | Việc làm |
|---|---|---|
| `expireSubscriptions` | hằng ngày 00:00 | `ACTIVE` có `currentPeriodEnd < now` → `EXPIRED` |
| `failStalePayments` | mỗi 5 phút | **Chỉ** gọi `settle(…, FAILED)` cho mọi `Payment PENDING` quá 30 phút. Việc hủy đơn + hoàn kho, hủy subscription `PENDING_PAYMENT` do `PaymentFailedHandler` đảm nhận; payment gia hạn thất bại không đổi subscription. |

## 5. Xác thực và bảo mật

- **JWT HS256**: `access_token` 15 phút, `refresh_token` 7 ngày. Cả hai là cookie `httpOnly`, `SameSite=Lax`, `Secure` ở production. Cả hai cookie đều `Path=/` — refresh cookie **phải** là `/` vì proxy (6.3) chạy trên route trang như `/account` và trình duyệt chỉ gửi cookie tới path khớp. Refresh token là chuỗi ngẫu nhiên 32 byte (không phải JWT); DB lưu `tokenHash = HMAC-SHA256(JWT_REFRESH_SECRET, token)`.
- NestJS dùng global prefix `/api`; Next.js rewrite `/api/:path*` → `${API_INTERNAL_URL}/api/:path*`. Các endpoint dưới đây viết tương đối với `/api`.
- **Cùng origin:** Next.js rewrite `/api/*` → NestJS. Không cấu hình CORS; không token nào nằm trong JavaScript.
- **Endpoint:** `POST /auth/register`, `/auth/login`, `/auth/refresh` (xoay vòng, áp grace period ở 3.1), `/auth/logout` (đặt `revokedAt`), `GET /auth/me`. Sai email/mật khẩu → `401 INVALID_CREDENTIALS` (cùng một mã cho cả hai trường hợp). Refresh thất bại → 401 và xóa cả hai cookie.
- **CSRF (quyết định có chủ ý):** `SameSite=Lax` + cùng origin + mọi endpoint ghi **chỉ nhận `application/json`** (khác → `415 UNSUPPORTED_MEDIA_TYPE`).
- **Phân quyền:** `JwtAuthGuard` + `RolesGuard` ở NestJS là nguồn sự thật.

## 6. Frontend (apps/web)

**Stack:** Next.js App Router, Tailwind v4 (import token từ design system), `react-hook-form` + `zodResolver` dùng schema trong `packages/shared`. Không dùng Redux/TanStack Query.

### 6.1 Trang

| Nhóm | Trang |
|---|---|
| Công khai | `/` (landing 3 dịch vụ) · `/books` (tìm kiếm, lọc thể loại, lọc "có bán"/"cho mượn") · `/books/[slug]` · `/plans` · `/login` · `/register` |
| Khách hàng | `/cart` (hai danh sách "Mua" và "Mượn" trong localStorage, mỗi danh sách một nút tiếp tục) · `/checkout` · `/borrow/confirm` · `/checkout/mock/[paymentId]` |
| Tài khoản | `/account` · `/account/orders` · `/account/orders/[id]` (timeline giao hàng) · `/account/loans` (chọn nhiều cuốn để trả) · `/account/subscription` (gói hiện tại, gia hạn) · `/account/addresses` |
| Admin | `/admin` → chuyển hướng `/admin/orders` · `/admin/books` (CRUD sách, chỉnh tồn kho bán, thêm/đánh dấu mất bản cho mượn) · `/admin/orders` · `/admin/shipments` (đổi trạng thái, retry, hủy loan) · `/admin/loans` (chỉ xem). Chung một layout admin. |

Mọi danh sách có trạng thái rỗng (giỏ trống, chưa mượn, chưa có đơn).

### 6.2 Server / Client Components

- **Mặc định Server Component.** Đọc dữ liệu qua `apiServer()`: `fetch` tới URL nội bộ của NestJS, chuyển tiếp cookie.
  - Danh mục công khai: `revalidate: 60` — chấp nhận chậm tối đa 60 giây sau khi admin sửa; không sai nghiệp vụ vì checkout/mượn luôn kiểm tra lại phía server.
  - Dữ liệu riêng của user và **toàn bộ `/admin/*`**: `cache: 'no-store'`.
  - `apiServer()` gặp 401 → `redirect('/login?next=…')`.
- **Client Component** chỉ cho đảo tương tác: nút thêm giỏ mua/mượn, trang `/cart`, form, điều khiển admin, `BookCover` (fallback ảnh).
- Bộ lọc `/books` dùng **URL searchParams**, render phía server.
- **Ghi:** Client Component gọi `apiClient()` (fetch tới `/api/*`), thành công thì `router.refresh()`. Gặp 401 → gọi `/api/auth/refresh` một lần rồi thử lại; vẫn lỗi → chuyển `/login`.

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
| 409 | `LOAN_LIMIT_EXCEEDED`, `OUT_OF_STOCK`, `NO_COPY_AVAILABLE`, `SUBSCRIPTION_INACTIVE`, `SUBSCRIPTION_ALREADY_EXISTS`, `ORDER_NOT_CANCELLABLE`, `INVALID_SHIPMENT_TRANSITION`, `LOAN_NOT_RETURNABLE`, `DUPLICATE`, `IN_USE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 500 | `INTERNAL_ERROR` |

Nguyên tắc: **409 cho mọi xung đột với trạng thái hiện tại.**

- **Backend:** service ném domain error; một global exception filter chuyển thành JSON trên. Validate bằng `ZodValidationPipe` tự viết, dùng schema chung.
- **Lỗi Prisma:** `P2002` → 409 `DUPLICATE`; `P2003` → 409 `IN_USE` (vd. xóa sách đã phát sinh giao dịch); `P2025` → 404 `NOT_FOUND`. Lỗi khác → 500, ghi log bằng `Logger` của NestJS.
- **Frontend:** `error.tsx` và `not-found.tsx` cho từng nhóm route; `global-error.tsx` ở gốc app.

## 8. Kiểm thử

Tập trung vào luật nghiệp vụ và race condition; không test UI vụn vặt.

- **Unit:** Jest cho `apps/api`; Vitest cho `packages/shared` và `apps/web` (hợp với ESM của `jose`/Next). Nội dung: máy trạng thái shipment; tính phí ship; tính kỳ hạn gói (đăng ký, gia hạn khi còn hạn/đã hết hạn); kiểm tra hạn mức mượn; điều kiện hợp lệ của refresh token (grace period, logout).
- **Integration (Jest + Supertest) trên Postgres thật** (`bookstore_test`). `globalSetup` chạy `prisma migrate deploy` bằng cùng bộ migration (gồm migration SQL viết tay); truncate dữ liệu giữa các test.
  - **Race:**
    - Gói `maxBooks = 2`, 5 request mượn song song (mỗi request 1 cuốn) → đúng 2 thành công, 3 nhận `LOAN_LIMIT_EXCEEDED`.
    - Sách còn 1 cuốn bán, 2 request mua song song → đúng 1 đơn, 1 `OUT_OF_STOCK`.
    - Sách còn 1 bản cho mượn, 2 user mượn song song → đúng 1 thành công, 1 `NO_COPY_AVAILABLE`.
    - 2 request đăng ký gói song song của cùng user → đúng 1 thành công, 1 `SUBSCRIPTION_ALREADY_EXISTS`.
    - 3 request refresh song song với cùng refresh token → cả 3 thành công.
    - Callback thanh toán thành công và `failStalePayments` chạy đồng thời trên cùng payment → đúng một bên thắng, handler chạy đúng một lần.
  - **Luồng:** thanh toán thành công/thất bại cho đơn và gói; callback gọi lặp (idempotent); retry và hủy loan khi shipment `FAILED`; chuyển trạng thái shipment sai; cron `failStalePayments` (đơn bị hủy và hoàn kho **đúng một lần**; subscription `PENDING_PAYMENT` bị hủy; payment gia hạn quá hạn → `FAILED` mà subscription `ACTIVE` giữ nguyên); khách hủy đơn rồi callback thành công đến sau → không đổi gì; gia hạn thành công → `currentPeriodEnd` kéo dài đúng (còn hạn: cộng từ `currentPeriodEnd`); gia hạn khi không có subscription `ACTIVE` → `SUBSCRIPTION_INACTIVE`; cron đã expire subscription trong lúc payment gia hạn chờ → thanh toán thành công đưa về `ACTIVE`, còn nếu user đã có subscription mở khác → payment `FAILED`, không vi phạm index; cron `expireSubscriptions` (gọi trực tiếp với `Clock` giả, kiểm tra user hết hạn không mượn được nhưng vẫn trả được); RBAC (customer gọi API admin → 403); endpoint ghi nhận body không phải JSON → 415.
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
- **Seed:** 1 admin, 1 customer (thông tin từ biến môi trường); ~30 sách thuộc 6 thể loại, mỗi sách có bản cho mượn và/hoặc tồn kho bán; 3 gói — **Basic** 2 cuốn / 79.000 đ, **Standard** 3 cuốn / 119.000 đ, **Premium** 5 cuốn / 179.000 đ. `coverUrl` ghép từ ISBN theo URL Open Library (seed không cần mạng); `next.config` khai báo `remotePatterns` cho `covers.openlibrary.org`; `BookCover` hiển thị placeholder khi `coverUrl` null hoặc ảnh lỗi.
- **CI (GitHub Actions):**
  - Mỗi push/PR: lint, typecheck, unit, integration (Postgres service container).
  - Nightly + `workflow_dispatch`: Playwright.

## 10. Mốc triển khai

Mỗi mốc có implementation plan riêng và chạy được độc lập khi hoàn thành.

| Mốc | Nội dung |
|---|---|
| **M0** | Monorepo, Docker Compose, Prisma + migration nền, `packages/shared`, auth (register/login/refresh/logout, grace period), RBAC, exception filter, layout web + design system, middleware |
| **M1** | Danh mục sách, tồn kho bán, bản cho mượn; trang `/books`, `/books/[slug]`; `/admin/books`; seed |
| **M2** | Địa chỉ, giỏ hàng, đơn mua, thanh toán mock, cron `failStalePayments` + `PaymentFailedHandler` cho đơn; trang checkout, `/account/orders` |
| **M3** | Shipments (máy trạng thái, event, retry), handler cho đơn mua; `/admin/orders`, `/admin/shipments`, timeline giao hàng |
| **M4** | Gói đăng ký, gia hạn, cron `expireSubscriptions`, `PaymentFailedHandler` cho subscription; mượn/trả sách, handler cho loan, hủy loan; `/plans`, `/borrow/confirm`, `/account/loans`, `/account/subscription`, `/admin/loans` |
| **M5** | Playwright E2E, GitHub Actions CI |
