import type { BookListQuery } from '@open-boox/shared';

export function bookSearch(f: Partial<BookListQuery>): string {
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.category) params.set('category', f.category);
  if (f.availability) params.set('availability', f.availability);
  if (f.page && f.page > 1) params.set('page', String(f.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

// Changing any filter goes back to page 1; pass `page` in `change` to paginate.
export function filterHref(base: string, current: Partial<BookListQuery>, change: Partial<BookListQuery>): string {
  return base + bookSearch({ ...current, page: 1, ...change });
}
