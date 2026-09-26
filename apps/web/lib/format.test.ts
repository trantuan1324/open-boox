import { describe, expect, it } from 'vitest';
import { formatVnd } from './format';

describe('formatVnd', () => {
  it('groups thousands with dots and appends đ', () => {
    expect(formatVnd(119000)).toBe('119.000 đ');
    expect(formatVnd(1250000)).toBe('1.250.000 đ');
  });
});
