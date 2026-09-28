import type { PlanDto, SubscriptionDto } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import { planOptions } from './plan-options';

const basic: PlanDto = { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79_000 };
const standard: PlanDto = { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119_000 };
const premium: PlanDto = { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179_000 };
const plans = [basic, standard, premium];

const subscription = (plan: PlanDto, nextPlan: PlanDto | null = null): SubscriptionDto => ({
  id: 's1',
  status: 'ACTIVE',
  plan,
  nextPlan,
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  cancelAtPeriodEnd: false,
  pendingPaymentId: null,
});

describe('planOptions', () => {
  it('offers every other plan, labelled by when it applies', () => {
    expect(planOptions(subscription(standard), plans).map((o) => [o.plan.code, o.change, o.label])).toEqual([
      ['basic', 'DOWNGRADE', 'Hạ cấp — từ 01/10/2026'],
      ['premium', 'UPGRADE', 'Nâng cấp — hiệu lực ngay'],
    ]);
  });

  it('offers keeping the current plan while a downgrade is scheduled, and hides the scheduled plan', () => {
    expect(planOptions(subscription(premium, basic), plans).map((o) => [o.plan.code, o.label])).toEqual([
      ['standard', 'Hạ cấp — từ 01/10/2026'],
      ['premium', 'Giữ gói hiện tại'],
    ]);
  });
});
