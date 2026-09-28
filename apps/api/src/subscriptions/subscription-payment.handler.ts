import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import type { PaymentOutcomeHandler } from '../payments/payment-outcome';
import { PaymentsService } from '../payments/payments.service';
import { periodEnd } from './period';

@Injectable()
export class SubscriptionPaymentHandler implements PaymentOutcomeHandler, OnModuleInit {
  constructor(private readonly payments: PaymentsService) {}

  onModuleInit(): void {
    this.payments.registerHandler('subscription', this);
  }

  // spec §4.2: PENDING_PAYMENT → first period from now. ACTIVE → a renewal: the next period follows the old
  // one (the plan was locked in when the renewal payment was created). No other status can have a pending
  // payment, so anything else is a bug: 500 and rollback.
  async onSucceeded(tx: Prisma.TransactionClient, payment: Payment): Promise<void> {
    const subscription = await tx.subscription.findUniqueOrThrow({ where: { id: payment.subscriptionId! } });
    if (subscription.status === 'PENDING_PAYMENT') {
      const start = new Date();
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: periodEnd(start) },
      });
      return;
    }
    if (subscription.status === 'ACTIVE') {
      const start = subscription.currentPeriodEnd!;
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { currentPeriodStart: start, currentPeriodEnd: periodEnd(start) },
      });
      return;
    }
    throw new Error(`Subscription ${subscription.id} is ${subscription.status} and cannot have a pending payment`);
  }

  // A failed first payment cancels; a declined renewal expires. The status guards make both happen once.
  async onFailed(tx: Prisma.TransactionClient, payment: Payment): Promise<void> {
    const id = payment.subscriptionId!;
    const { count } = await tx.subscription.updateMany({
      where: { id, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED' },
    });
    if (count === 0) await tx.subscription.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  }
}
