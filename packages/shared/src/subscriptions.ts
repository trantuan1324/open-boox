import { z } from 'zod';

// A period is a fixed 30 days (spec §4.2).
export const SUBSCRIPTION_PERIOD_DAYS = 30;

export const SUBSCRIPTION_STATUSES = ['PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const planCodeInputSchema = z.object({
  planCode: z.string({ error: 'Vui lòng chọn gói' }).trim().min(1, 'Vui lòng chọn gói').max(50),
});
export type PlanCodeInput = z.output<typeof planCodeInputSchema>;

export interface PlanDto {
  code: string;
  name: string;
  maxBooks: number;
  monthlyPrice: number;
}

export interface SubscriptionDto {
  id: string;
  status: SubscriptionStatus;
  plan: PlanDto;
  nextPlan: PlanDto | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPaymentId: string | null;
}

// Wrapped: Nest sends an empty body when a handler returns null (spec §4.2).
export interface CurrentSubscription {
  subscription: SubscriptionDto | null;
}

export interface SubscribeResult {
  subscriptionId: string;
  redirectUrl: string;
}

export type PlanChange = 'KEEP' | 'UPGRADE' | 'DOWNGRADE';

type Priced = Pick<PlanDto, 'code' | 'monthlyPrice'>;

// spec §4.2: only a pricier plan applies at once; any other plan waits for the next period. Choosing the
// current plan again drops a pending downgrade.
export function classifyPlanChange(current: Priced, target: Priced): PlanChange {
  if (current.code === target.code) return 'KEEP';
  return target.monthlyPrice > current.monthlyPrice ? 'UPGRADE' : 'DOWNGRADE';
}
