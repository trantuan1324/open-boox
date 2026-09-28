import { z } from 'zod';
import type { ShipmentStatus } from './shipments';

export const LOANS_PER_BORROW_MAX = 5;
export const LOANS_PER_RETURN_MAX = 10;
export const LOAN_PAGE_SIZE = 20;
export const ADMIN_LOAN_PAGE_SIZE = 20;

export const LOAN_STATUSES = ['REQUESTED', 'ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

// "Open" loans count against the plan's maxBooks (spec §3.3).
export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = ['REQUESTED', 'ACTIVE', 'RETURN_REQUESTED'];

const distinct = (ids: string[]) => new Set(ids).size === ids.length;

export const borrowInputSchema = z.object({
  bookIds: z
    .array(z.string().min(1))
    .min(1, 'Chưa chọn sách nào')
    .max(LOANS_PER_BORROW_MAX, `Tối đa ${LOANS_PER_BORROW_MAX} cuốn mỗi lần mượn`)
    .refine(distinct, 'Một sách xuất hiện nhiều lần'),
  addressId: z.string().min(1, 'Vui lòng chọn địa chỉ'),
});
export type BorrowInput = z.output<typeof borrowInputSchema>;

export const returnInputSchema = z.object({
  loanIds: z
    .array(z.string().min(1))
    .min(1, 'Chưa chọn sách nào')
    .max(LOANS_PER_RETURN_MAX, `Tối đa ${LOANS_PER_RETURN_MAX} cuốn mỗi lần trả`)
    .refine(distinct, 'Một cuốn xuất hiện nhiều lần'),
  addressId: z.string().min(1, 'Vui lòng chọn địa chỉ'),
});
export type ReturnInput = z.output<typeof returnInputSchema>;

// Query strings may repeat a key; keep the first value. Lenient like the other lists: hand-edited URLs fall
// back to defaults instead of an error page.
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const page = z.preprocess(first, z.coerce.number().int().min(1).max(1000).catch(1));

export const loanListQuerySchema = z.object({ page });
export type LoanListQuery = z.output<typeof loanListQuerySchema>;

export const adminLoanListQuerySchema = z.object({
  status: z.preprocess(first, z.enum(LOAN_STATUSES).optional().catch(undefined)),
  shipmentId: z.preprocess(first, z.string().trim().min(1).max(100).optional().catch(undefined)),
  page,
});
export type AdminLoanListQuery = z.output<typeof adminLoanListQuerySchema>;

export interface BorrowResult {
  loanIds: string[];
  shipmentId: string;
}

export interface ReturnResult {
  shipmentId: string;
}

export interface LoanDto {
  id: string;
  status: LoanStatus;
  requestedAt: string;
  deliveredAt: string | null;
  returnedAt: string | null;
  book: { title: string; slug: string; coverUrl: string | null };
  // Delivery shipment while REQUESTED/ACTIVE/CANCELLED, pickup shipment while RETURN_REQUESTED/RETURNED (spec §4.4a).
  shipmentStatus: ShipmentStatus;
}

export interface AdminLoanRow {
  id: string;
  customerEmail: string;
  bookTitle: string;
  barcode: string;
  status: LoanStatus;
  requestedAt: string;
  deliveryShipmentId: string;
  returnShipmentId: string | null;
}
