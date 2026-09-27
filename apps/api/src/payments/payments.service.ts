import { Injectable } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import type { PaymentDto } from '@open-boox/shared';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway } from './payment-gateway';
import { type PaymentOutcomeHandler, type PaymentTarget, targetOf } from './payment-outcome';

export const STALE_PAYMENT_MS = 30 * 60_000;

type Outcome = 'SUCCEEDED' | 'FAILED';

const DTO_SELECT = { id: true, amount: true, status: true, orderId: true } as const;

function toDto({ id, amount, status, orderId }: Payment): PaymentDto {
  return { id, amount, status, orderId };
}

@Injectable()
export class PaymentsService {
  private readonly handlers = new Map<PaymentTarget, PaymentOutcomeHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
  ) {}

  registerHandler(target: PaymentTarget, handler: PaymentOutcomeHandler): void {
    if (this.handlers.has(target)) throw new Error(`Payment outcome handler for "${target}" is already registered`);
    this.handlers.set(target, handler);
  }

  async createForOrder(
    tx: Prisma.TransactionClient,
    data: { userId: string; orderId: string; amount: number },
  ): Promise<{ redirectUrl: string }> {
    const payment = await tx.payment.create({ data, select: { id: true } });
    return this.gateway.createCheckout(payment);
  }

  // The single owner of every Payment transition out of PENDING (spec §4.1). Returns the payment as it now
  // stands; callers decide from its status. A domain error from onSucceeded (a business conflict) rolls that
  // attempt back and the payment is failed instead, as a real gateway would decline it.
  async settle(paymentId: string, outcome: Outcome): Promise<Payment> {
    if (outcome === 'SUCCEEDED') {
      try {
        return await this.prisma.$transaction((tx) => this.transition(tx, paymentId, 'SUCCEEDED'));
      } catch (error) {
        if (!(error instanceof DomainError) || error.code === 'NOT_FOUND') throw error;
      }
    }
    return this.prisma.$transaction((tx) => this.transition(tx, paymentId, 'FAILED'));
  }

  async getForUser(userId: string, paymentId: string): Promise<PaymentDto> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId }, select: DTO_SELECT });
    if (!payment) throw new DomainError('NOT_FOUND');
    return payment;
  }

  async mockCallback(userId: string, paymentId: string, success: boolean): Promise<PaymentDto> {
    await this.getForUser(userId, paymentId);
    return toDto(await this.settle(paymentId, success ? 'SUCCEEDED' : 'FAILED'));
  }

  async findStalePendingIds(createdBefore: Date): Promise<string[]> {
    const rows = await this.prisma.payment.findMany({
      where: { status: 'PENDING', createdAt: { lt: createdBefore } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async transition(tx: Prisma.TransactionClient, paymentId: string, status: Outcome): Promise<Payment> {
    // Conditional update: concurrent settles serialize on the row lock; the loser matches 0 rows and
    // returns the winner's result without calling any handler (idempotent).
    const { count } = await tx.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status } });
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError('NOT_FOUND');
    if (count === 1) {
      const target = targetOf(payment);
      const handler = this.handlers.get(target);
      // A missing registration must not let a payment settle silently: 500 and the transaction rolls back.
      if (!handler) throw new Error(`No payment outcome handler registered for "${target}"`);
      await (status === 'SUCCEEDED' ? handler.onSucceeded(tx, payment) : handler.onFailed(tx, payment));
    }
    return payment;
  }
}
