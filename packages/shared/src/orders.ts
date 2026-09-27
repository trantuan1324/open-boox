import { z } from 'zod';
import type { AddressSnapshot } from './address';
import type { ShipmentDto, ShipmentStatus } from './shipments';

export const MAX_ORDER_QUANTITY = 10;
export const MAX_ORDER_LINES = 20;
export const ORDER_PAGE_SIZE = 10;
export const ADMIN_ORDER_PAGE_SIZE = 20;

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'SHIPPING', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderItemSchema = z.object({
  bookId: z.string().min(1),
  quantity: z
    .number()
    .int('Số lượng phải là số nguyên')
    .min(1, 'Số lượng tối thiểu 1')
    .max(MAX_ORDER_QUANTITY, `Số lượng tối đa ${MAX_ORDER_QUANTITY}`),
});
export type OrderItemInput = z.output<typeof orderItemSchema>;

export const orderInputSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'Giỏ hàng trống')
    .max(MAX_ORDER_LINES, `Tối đa ${MAX_ORDER_LINES} đầu sách mỗi đơn`)
    .refine((items) => new Set(items.map((i) => i.bookId)).size === items.length, 'Một sách xuất hiện nhiều lần'),
  addressId: z.string().min(1, 'Vui lòng chọn địa chỉ'),
});
export type OrderInput = z.output<typeof orderInputSchema>;

// Lenient like the catalog query: a hand-edited ?page falls back to 1 instead of an error page.
export const orderListQuerySchema = z.object({
  page: z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.coerce.number().int().min(1).max(1000).catch(1),
  ),
});
export type OrderListQuery = z.output<typeof orderListQuerySchema>;

// Lenient too: an unknown ?status shows every order instead of an error page.
export const adminOrderListQuerySchema = orderListQuerySchema.extend({
  status: z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.enum(ORDER_STATUSES).optional().catch(undefined),
  ),
});
export type AdminOrderListQuery = z.output<typeof adminOrderListQuerySchema>;

export const mockCallbackSchema = z.object({ success: z.boolean() });
export type MockCallbackInput = z.output<typeof mockCallbackSchema>;

export interface OrderLineDto {
  bookId: string;
  title: string;
  slug: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderQuote {
  items: OrderLineDto[];
  subtotal: number;
  shippingFee: number;
  total: number;
}

export interface PlaceOrderResult {
  orderId: string;
  redirectUrl: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail extends OrderQuote {
  id: string;
  status: OrderStatus;
  createdAt: string;
  address: AddressSnapshot;
  pendingPaymentId: string | null;
  shipments: ShipmentDto[];
}

export interface PaymentDto {
  id: string;
  amount: number;
  status: PaymentStatus;
  orderId: string | null;
}

export interface AdminOrderRow {
  id: string;
  customerEmail: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  latestShipmentStatus: ShipmentStatus | null;
}

export interface AdminOrderDetail extends OrderDetail {
  customer: { email: string; fullName: string };
  paymentStatus: PaymentStatus | null;
}
