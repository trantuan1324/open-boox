type Params = Record<string, string | number | undefined>;

export function adminSearch(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || (key === 'page' && Number(value) <= 1)) continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// Changing a filter goes back to page 1; pass `page` in `change` to paginate, `undefined` to clear a filter.
export function adminHref(base: string, current: Params, change: Params): string {
  return base + adminSearch({ ...current, page: 1, ...change });
}
