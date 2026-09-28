import type { LoanDto, SubscriptionDto } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import { needsReturnReminder, toggleLoan } from './selection';

const loan = (status: LoanDto['status']): LoanDto => ({
  id: status,
  status,
  requestedAt: '2026-09-01T00:00:00.000Z',
  deliveredAt: null,
  returnedAt: null,
  book: { title: 'A', slug: 'a', coverUrl: null },
  shipmentStatus: 'DELIVERED',
});
const subscription = (status: SubscriptionDto['status']) => ({ status }) as SubscriptionDto;

describe('toggleLoan', () => {
  it('adds and removes a loan', () => {
    expect(toggleLoan([], 'a')).toEqual(['a']);
    expect(toggleLoan(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('never selects more than the maximum', () => {
    expect(toggleLoan(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
    expect(toggleLoan(['a', 'b'], 'b', 2)).toEqual(['a']);
  });
});

describe('needsReturnReminder', () => {
  it('reminds when there is no ACTIVE subscription but a book is still out', () => {
    expect(needsReturnReminder(null, [loan('ACTIVE')])).toBe(true);
    expect(needsReturnReminder(subscription('PENDING_PAYMENT'), [loan('ACTIVE')])).toBe(true);
  });

  it('stays quiet with an ACTIVE subscription or no book out', () => {
    expect(needsReturnReminder(subscription('ACTIVE'), [loan('ACTIVE')])).toBe(false);
    expect(needsReturnReminder(null, [loan('RETURNED'), loan('RETURN_REQUESTED'), loan('CANCELLED')])).toBe(false);
  });
});
