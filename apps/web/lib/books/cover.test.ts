import { describe, expect, it } from 'vitest';
import { isOptimizedCoverHost } from './cover';

describe('isOptimizedCoverHost', () => {
  it('accepts Open Library covers', () => {
    expect(isOptimizedCoverHost('https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg?default=false')).toBe(true);
  });

  it.each(['https://example.com/a.jpg', 'https://covers.openlibrary.org.evil.com/a.jpg', 'not a url'])(
    'rejects %s',
    (url) => {
      expect(isOptimizedCoverHost(url)).toBe(false);
    },
  );
});
