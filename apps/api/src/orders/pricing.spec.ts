import { DomainError } from '../common/errors/domain-error';
import { priceOrder, type SellableBook } from './pricing';

const books: SellableBook[] = [
  { id: 'a', title: 'A', slug: 'a', salePrice: 100_000 },
  { id: 'b', title: 'B', slug: 'b', salePrice: 45_000 },
  { id: 'n', title: 'N', slug: 'n', salePrice: null },
];

describe('priceOrder', () => {
  it('prices each line from the given books and keeps the input order', () => {
    const quote = priceOrder(
      [
        { bookId: 'b', quantity: 3 },
        { bookId: 'a', quantity: 1 },
      ],
      books,
      'Huế',
    );
    expect(quote).toEqual({
      items: [
        { bookId: 'b', title: 'B', slug: 'b', unitPrice: 45_000, quantity: 3, lineTotal: 135_000 },
        { bookId: 'a', title: 'A', slug: 'a', unitPrice: 100_000, quantity: 1, lineTotal: 100_000 },
      ],
      subtotal: 235_000,
      shippingFee: 35_000,
      total: 270_000,
    });
  });

  it('charges the INNER fee for Hà Nội', () => {
    expect(priceOrder([{ bookId: 'a', quantity: 1 }], books, 'Hà Nội').shippingFee).toBe(20_000);
  });

  it('rejects unknown and not-for-sale books with the offending line indexes', () => {
    try {
      priceOrder(
        [
          { bookId: 'a', quantity: 1 },
          { bookId: 'n', quantity: 1 },
          { bookId: 'x', quantity: 1 },
        ],
        books,
        'Hà Nội',
      );
      throw new Error('expected a DomainError');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION_ERROR');
      expect(Object.keys((error as DomainError).fields ?? {})).toEqual(['items.1.bookId', 'items.2.bookId']);
    }
  });
});
