import { classifyPlanChange, type PlanChange, type PlanDto, type SubscriptionDto } from '@open-boox/shared';
import { formatDate } from '../format';

export interface PlanOption {
  plan: PlanDto;
  change: PlanChange;
  label: string;
}

function labelFor(change: PlanChange, periodEnd: string | null): string {
  if (change === 'UPGRADE') return 'Nâng cấp — hiệu lực ngay';
  if (change === 'DOWNGRADE') return `Hạ cấp — từ ${periodEnd ? formatDate(periodEnd) : 'kỳ sau'}`;
  return 'Giữ gói hiện tại';
}

// spec §6.2c: every other plan; the current plan only while a downgrade is scheduled (choosing it drops the
// downgrade); never the plan already scheduled.
export function planOptions(subscription: SubscriptionDto, plans: PlanDto[]): PlanOption[] {
  return plans.flatMap((plan) => {
    const change = classifyPlanChange(subscription.plan, plan);
    if (change === 'KEEP' && !subscription.nextPlan) return [];
    if (subscription.nextPlan?.code === plan.code) return [];
    return [{ plan, change, label: labelFor(change, subscription.currentPeriodEnd) }];
  });
}
