import { z } from 'zod';

export const BOOK_PAGE_SIZE = 12;

export const COPY_STATUSES = ['AVAILABLE', 'RESERVED', 'ON_LOAN', 'LOST'] as const;
export type CopyStatus = (typeof COPY_STATUSES)[number];

export const AVAILABILITY_FILTERS = ['sale', 'loan'] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

// Query strings may repeat a key (?q=a&q=b); keep the first value.
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const optionalText = z
  .preprocess(first, z.string().trim().max(100).optional().catch(undefined))
  .transform((value) => value || undefined);

// Lenient on purpose: a hand-edited URL falls back to defaults instead of an error page.
export const bookListQuerySchema = z.object({
  q: optionalText,
  category: optionalText,
  availability: z.preprocess(first, z.enum(AVAILABILITY_FILTERS).optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(1000).catch(1)),
});
export type BookListQuery = z.output<typeof bookListQuerySchema>;

const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

export const bookInputSchema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên sách').max(200, 'Tên sách tối đa 200 ký tự'),
  author: z.string().trim().min(1, 'Vui lòng nhập tác giả').max(200, 'Tác giả tối đa 200 ký tự'),
  isbn: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^(\d{9}[\dX]|\d{13})$/, 'ISBN gồm 10 hoặc 13 ký tự số')),
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự'),
  coverUrl: z.preprocess(
    emptyToNull,
    z.url({ protocol: /^https?$/, error: 'Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://' }).nullable(),
  ),
  categoryId: z.string().min(1, 'Vui lòng chọn thể loại'),
  salePrice: z.preprocess(
    emptyToNull,
    z.coerce
      .number({ error: 'Giá phải là số' })
      .int('Giá phải là số nguyên')
      .min(1000, 'Giá tối thiểu 1.000 đ')
      .max(10_000_000, 'Giá tối đa 10.000.000 đ')
      .nullable(),
  ),
});
export type BookInput = z.output<typeof bookInputSchema>;

export const stockAdjustSchema = z.object({
  delta: z.coerce
    .number({ error: 'Vui lòng nhập số' })
    .int('Phải là số nguyên')
    .min(-100_000)
    .max(100_000)
    .refine((n) => n !== 0, 'Số lượng thay đổi phải khác 0'),
});
export type StockAdjustInput = z.output<typeof stockAdjustSchema>;

export const addCopiesSchema = z.object({
  count: z.coerce
    .number({ error: 'Vui lòng nhập số' })
    .int('Phải là số nguyên')
    .min(1, 'Tối thiểu 1 bản')
    .max(50, 'Tối đa 50 bản mỗi lần'),
});
export type AddCopiesInput = z.output<typeof addCopiesSchema>;

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

export interface BookSummary {
  id: string;
  slug: string;
  title: string;
  author: string;
  isbn: string;
  coverUrl: string | null;
  salePrice: number | null;
  categoryName: string;
  categorySlug: string;
  saleStock: number;
  availableCopies: number;
}

export interface BookDetail extends BookSummary {
  description: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminBookRow extends BookSummary {
  copyCounts: Record<CopyStatus, number>;
}

export interface BookCopyDto {
  id: string;
  barcode: string;
  status: CopyStatus;
}

export interface AdminBookDetail extends BookDetail {
  categoryId: string;
  copies: BookCopyDto[];
}

export interface StockDto {
  quantity: number;
}
