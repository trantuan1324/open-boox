import { type OrderItemInput, type OrderLineDto, type OrderQuote, type Province, shippingFeeFor } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';

export interface SellableBook {
  id: string;
  title: string;
  slug: string;
  salePrice: number | null;
}

// Pure: prices come from the DB rows passed in, never from the client. Lines keep the input order so
// callers can point errors at a cart line by index.
export function priceOrder(items: OrderItemInput[], books: SellableBook[], city: Province): OrderQuote {
  const byId = new Map(books.map((book) => [book.id, book]));
  const fields: Record<string, string> = {};
  const lines: OrderLineDto[] = [];
  items.forEach(({ bookId, quantity }, i) => {
    const book = byId.get(bookId);
    if (!book || book.salePrice === null) {
      fields[`items.${i}.bookId`] = 'Sách không tồn tại hoặc không còn bán';
      return;
    }
    lines.push({ bookId, title: book.title, slug: book.slug, unitPrice: book.salePrice, quantity, lineTotal: book.salePrice * quantity });
  });
  if (Object.keys(fields).length > 0) throw new DomainError('VALIDATION_ERROR', 'Some books are not for sale', fields);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shippingFee = shippingFeeFor(city);
  return { items: lines, subtotal, shippingFee, total: subtotal + shippingFee };
}
