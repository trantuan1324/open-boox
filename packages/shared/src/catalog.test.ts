import { describe, expect, it } from 'vitest';
import { addCopiesSchema, bookInputSchema, bookListQuerySchema, stockAdjustSchema } from './catalog';

describe('bookListQuerySchema', () => {
  it('parses valid filters', () => {
    expect(bookListQuerySchema.parse({ q: '  nha gia kim ', category: 'van-hoc', availability: 'sale', page: '2' })).toEqual({
      q: 'nha gia kim',
      category: 'van-hoc',
      availability: 'sale',
      page: 2,
    });
  });

  it('defaults to page 1 with no filters', () => {
    expect(bookListQuerySchema.parse({})).toEqual({ page: 1 });
  });

  it.each([
    [{ page: 'abc' }, { page: 1 }],
    [{ page: '0' }, { page: 1 }],
    [{ page: '-3' }, { page: 1 }],
    [{ page: '1.5' }, { page: 1 }],
    [{ availability: 'xyz' }, { page: 1 }],
    [{ q: '   ' }, { page: 1 }],
    [{ q: 'x'.repeat(101) }, { page: 1 }],
    [{ q: ['a', 'b'] }, { q: 'a', page: 1 }],
  ])('falls back to defaults for %j', (input, expected) => {
    expect(bookListQuerySchema.parse(input)).toEqual(expected);
  });
});

describe('bookInputSchema', () => {
  const valid = {
    title: ' Nhà giả kim ',
    author: 'Paulo Coelho',
    isbn: '978-0-06-231500-7',
    description: '',
    coverUrl: '',
    categoryId: 'c1',
    salePrice: '89000',
  };

  it('trims text, normalizes ISBN, maps empty cover to null and coerces the price', () => {
    expect(bookInputSchema.parse(valid)).toEqual({
      title: 'Nhà giả kim',
      author: 'Paulo Coelho',
      isbn: '9780062315007',
      description: '',
      coverUrl: null,
      categoryId: 'c1',
      salePrice: 89000,
    });
  });

  it('accepts an empty price as "not for sale"', () => {
    expect(bookInputSchema.parse({ ...valid, salePrice: '' }).salePrice).toBeNull();
    expect(bookInputSchema.parse({ ...valid, salePrice: null }).salePrice).toBeNull();
  });

  it('accepts a 10-character ISBN ending in X', () => {
    expect(bookInputSchema.parse({ ...valid, isbn: '0-8044-2957-x' }).isbn).toBe('080442957X');
  });

  it.each([
    ['title', { title: '   ' }],
    ['isbn', { isbn: '12345' }],
    ['coverUrl', { coverUrl: 'javascript:alert(1)' }],
    ['coverUrl', { coverUrl: 'not a url' }],
    ['salePrice', { salePrice: '-5' }],
    ['salePrice', { salePrice: '12.5' }],
    ['salePrice', { salePrice: 'abc' }],
    ['categoryId', { categoryId: '' }],
  ])('rejects bad %s', (field, patch) => {
    const r = bookInputSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual([field]);
  });

  it('requires salePrice to be present', () => {
    const { salePrice: _omit, ...rest } = valid;
    expect(bookInputSchema.safeParse(rest).success).toBe(false);
  });
});

describe('stockAdjustSchema', () => {
  it('accepts signed integers', () => {
    expect(stockAdjustSchema.parse({ delta: '+10' })).toEqual({ delta: 10 });
    expect(stockAdjustSchema.parse({ delta: -2 })).toEqual({ delta: -2 });
  });

  it.each([0, '', '1.5', 'abc'])('rejects %j', (delta) => {
    expect(stockAdjustSchema.safeParse({ delta }).success).toBe(false);
  });
});

describe('addCopiesSchema', () => {
  it('accepts 1 to 50', () => {
    expect(addCopiesSchema.parse({ count: '3' })).toEqual({ count: 3 });
  });

  it.each([0, 51, 2.5])('rejects %j', (count) => {
    expect(addCopiesSchema.safeParse({ count }).success).toBe(false);
  });
});
