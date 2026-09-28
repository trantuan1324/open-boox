import type { Plan, Subscription, SubscriptionStatus } from '@prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

export const DAY = 24 * 60 * 60_000;

export const PLAN_SEED = [
  { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79_000 },
  { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119_000 },
  { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179_000 },
] as const;

export type PlanCode = (typeof PLAN_SEED)[number]['code'];

export async function createPlans(prisma: PrismaService): Promise<Record<PlanCode, Plan>> {
  await prisma.plan.createMany({ data: [...PLAN_SEED] });
  const rows = await prisma.plan.findMany();
  return Object.fromEntries(rows.map((plan) => [plan.code, plan])) as Record<PlanCode, Plan>;
}

// Writes directly (test-only): an ACTIVE/EXPIRED subscription gets a 30-day period ending at periodEnd
// (default: 10 days from now); PENDING_PAYMENT/CANCELLED have no period.
export function createSubscription(
  prisma: PrismaService,
  data: {
    userId: string;
    planId: string;
    status?: SubscriptionStatus;
    periodEnd?: Date;
    nextPlanId?: string;
    cancelAtPeriodEnd?: boolean;
  },
): Promise<Subscription> {
  const status = data.status ?? 'ACTIVE';
  const end = data.periodEnd ?? new Date(Date.now() + 10 * DAY);
  const period =
    status === 'ACTIVE' || status === 'EXPIRED'
      ? { currentPeriodStart: new Date(end.getTime() - 30 * DAY), currentPeriodEnd: end }
      : {};
  return prisma.subscription.create({
    data: {
      userId: data.userId,
      planId: data.planId,
      nextPlanId: data.nextPlanId,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      status,
      ...period,
    },
  });
}
