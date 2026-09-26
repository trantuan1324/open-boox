import { describe, expect, it } from 'vitest';
import { bookSearch, filterHref } from './filters';

describe('bookSearch', () => {
  it('is empty without filters and omits page 1', () => {
    expect(bookSearch({})).toBe('');
    expect(bookSearch({ page: 1 })).toBe('');
  });

  it('encodes filters in a stable order', () => {
    expect(bookSearch({ page: 3, availability: 'loan', category: 'van-hoc', q: 'nhà giả' })).toBe(
      '?q=nh%C3%A0+gi%E1%BA%A3&category=van-hoc&availability=loan&page=3',
    );
  });
});

describe('filterHref', () => {
  const current = { q: 'kim', category: 'van-hoc', availability: 'sale' as const, page: 4 };

  it('keeps other filters and goes back to page 1 when a filter changes', () => {
    expect(filterHref('/books', current, { category: 'kinh-te' })).toBe('/books?q=kim&category=kinh-te&availability=sale');
  });

  it('clears a filter set to undefined', () => {
    expect(filterHref('/books', current, { availability: undefined })).toBe('/books?q=kim&category=van-hoc');
  });

  it('keeps filters when paginating', () => {
    expect(filterHref('/admin/books', { q: 'kim', page: 1 }, { page: 2 })).toBe('/admin/books?q=kim&page=2');
  });
});
