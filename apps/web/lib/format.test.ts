import { describe, expect, it } from 'vitest';
import { formatDateTime, formatVnd } from './format';

describe('formatVnd', () => {
  it('groups thousands with dots and appends đ', () => {
    expect(formatVnd(119000)).toBe('119.000 đ');
    expect(formatVnd(1250000)).toBe('1.250.000 đ');
  });
});

describe('formatDateTime', () => {
  it('shows Vietnam time regardless of the server time zone', () => {
    expect(formatDateTime('2026-09-27T03:05:00.000Z')).toBe('10:05 27/09/2026');
  });
});
