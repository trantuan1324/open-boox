import { periodEnd } from './period';

describe('periodEnd', () => {
  it('adds exactly 30 days, across month ends', () => {
    expect(periodEnd(new Date('2026-01-31T10:00:00.000Z')).toISOString()).toBe('2026-03-02T10:00:00.000Z');
  });

  it('chains renewals from the previous end, not from now', () => {
    const first = periodEnd(new Date('2026-09-01T00:00:00.000Z'));
    expect(periodEnd(first).toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });
});
