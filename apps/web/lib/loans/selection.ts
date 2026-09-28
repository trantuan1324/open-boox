import { LOANS_PER_RETURN_MAX, type LoanDto, type SubscriptionDto } from '@open-boox/shared';

export function toggleLoan(selected: string[], id: string, max = LOANS_PER_RETURN_MAX): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return selected.length >= max ? selected : [...selected, id];
}

// spec §4.2, §6.2c: no ACTIVE subscription while books are still out → remind to return them. Judged on the
// page being shown (accepted: an ACTIVE loan on a later page does not trigger it on page 1).
export function needsReturnReminder(subscription: SubscriptionDto | null, loans: LoanDto[]): boolean {
  return subscription?.status !== 'ACTIVE' && loans.some((loan) => loan.status === 'ACTIVE');
}
