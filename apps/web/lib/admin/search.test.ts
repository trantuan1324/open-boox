import { describe, expect, it } from 'vitest';
import { adminHref, adminSearch } from './search';

describe('adminSearch', () => {
  it('keeps set values and drops empty ones and page 1', () => {
    expect(adminSearch({ status: 'PAID', type: undefined, q: '', page: 1 })).toBe('?status=PAID');
    expect(adminSearch({ status: 'FAILED', page: 3 })).toBe('?status=FAILED&page=3');
    expect(adminSearch({})).toBe('');
  });
});

describe('adminHref', () => {
  it('goes back to page 1 when a filter changes, keeping the others', () => {
    expect(adminHref('/admin/shipments', { status: 'FAILED', type: 'ORDER_DELIVERY', page: 4 }, { status: 'PENDING' })).toBe(
      '/admin/shipments?status=PENDING&type=ORDER_DELIVERY',
    );
  });

  it('clears a filter with undefined and paginates with page', () => {
    expect(adminHref('/admin/orders', { status: 'PAID', page: 2 }, { status: undefined })).toBe('/admin/orders');
    expect(adminHref('/admin/orders', { status: 'PAID', page: 2 }, { page: 3 })).toBe('/admin/orders?status=PAID&page=3');
  });
});
