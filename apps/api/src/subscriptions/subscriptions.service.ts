import { Injectable } from '@nestjs/common';
import { type Plan, Prisma } from '@prisma/client';
import {
  classifyPlanChange,
  type CurrentSubscription,
  type PlanDto,
  type SubscribeResult,
  type SubscriptionDto,
} from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ActiveSubscription {
  id: string;
  currentPeriodEnd: Date;
  maxBooks: number;
}

const WITH_PLANS = {
  plan: true,
  nextPlan: true,
  payments: { where: { status: 'PENDING' }, select: { id: true } },
} satisfies Prisma.SubscriptionInclude;

type SubscriptionWithPlans = Prisma.SubscriptionGetPayload<{ include: typeof WITH_PLANS }>;

function toPlanDto({ code, name, maxBooks, monthlyPrice }: Plan): PlanDto {
  return { code, name, maxBooks, monthlyPrice };
}

function toDto(s: SubscriptionWithPlans): SubscriptionDto {
  return {
    id: s.id,
    status: s.status,
    plan: toPlanDto(s.plan),
    nextPlan: s.nextPlan ? toPlanDto(s.nextPlan) : null,
    currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    pendingPaymentId: s.payments[0]?.id ?? null,
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async plans(): Promise<PlanDto[]> {
    const rows = await this.prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPrice: 'asc' } });
    return rows.map(toPlanDto);
  }

  async current(userId: string): Promise<CurrentSubscription> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
      include: WITH_PLANS,
    });
    return { subscription: subscription ? toDto(subscription) : null };
  }

  // spec §4.2: the partial unique index guards "one open subscription", concurrent requests included. P2002
  // aborts the Postgres transaction, so it is mapped here, outside $transaction.
  async subscribe(userId: string, planCode: string): Promise<SubscribeResult> {
    const plan = await this.activePlan(planCode);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.create({ data: { userId, planId: plan.id }, select: { id: true } });
        const { redirectUrl } = await this.payments.createForSubscription(tx, {
          userId,
          subscriptionId: subscription.id,
          amount: plan.monthlyPrice,
        });
        return { subscriptionId: subscription.id, redirectUrl };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('SUBSCRIPTION_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  // spec §4.2: pricier → now; cheaper → nextPlanId; same → drop nextPlanId. No payment. The row lock queues
  // this behind (or ahead of) a renewal of the same subscription.
  async changePlan(userId: string, planCode: string): Promise<SubscriptionDto> {
    const target = await this.activePlan(planCode);
    const id = await this.prisma.$transaction(async (tx) => {
      const id = await this.lockActiveId(tx, userId);
      const { plan } = await tx.subscription.findUniqueOrThrow({ where: { id }, select: { plan: true } });
      const change = classifyPlanChange(plan, target);
      const data =
        change === 'UPGRADE'
          ? { planId: target.id, nextPlanId: null }
          : change === 'DOWNGRADE'
            ? { nextPlanId: target.id }
            : { nextPlanId: null };
      await tx.subscription.update({ where: { id }, data });
      return id;
    });
    return this.dto(id);
  }

  cancel(userId: string): Promise<SubscriptionDto> {
    return this.setCancelAtPeriodEnd(userId, true);
  }

  resume(userId: string): Promise<SubscriptionDto> {
    return this.setCancelAtPeriodEnd(userId, false);
  }

  // For loans (spec §4.3 step 1): locks the user's ACTIVE subscription row so every borrow of one user queues
  // here. The period check stays with the caller.
  async findActiveForUpdate(tx: Prisma.TransactionClient, userId: string): Promise<ActiveSubscription | null> {
    const rows = await tx.$queryRaw<ActiveSubscription[]>`
      SELECT s.id, s."currentPeriodEnd", p."maxBooks"
      FROM "Subscription" s JOIN "Plan" p ON p.id = s."planId"
      WHERE s."userId" = ${userId} AND s.status = 'ACTIVE'
      FOR UPDATE OF s`;
    return rows[0] ?? null;
  }

  private async setCancelAtPeriodEnd(userId: string, cancelAtPeriodEnd: boolean): Promise<SubscriptionDto> {
    const subscription = await this.prisma.subscription.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } });
    if (!subscription) throw new DomainError('SUBSCRIPTION_INACTIVE');
    const { count } = await this.prisma.subscription.updateMany({
      where: { id: subscription.id, status: 'ACTIVE' },
      data: { cancelAtPeriodEnd },
    });
    if (count === 0) throw new DomainError('SUBSCRIPTION_INACTIVE'); // expired in between
    return this.dto(subscription.id);
  }

  private async lockActiveId(tx: Prisma.TransactionClient, userId: string): Promise<string> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Subscription" WHERE "userId" = ${userId} AND status = 'ACTIVE' FOR UPDATE`;
    if (!rows[0]) throw new DomainError('SUBSCRIPTION_INACTIVE');
    return rows[0].id;
  }

  private async activePlan(code: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({ where: { code, active: true } });
    if (!plan) throw new DomainError('VALIDATION_ERROR', 'Unknown plan', { planCode: 'Gói không tồn tại' });
    return plan;
  }

  private async dto(id: string): Promise<SubscriptionDto> {
    return toDto(await this.prisma.subscription.findUniqueOrThrow({ where: { id }, include: WITH_PLANS }));
  }
}
