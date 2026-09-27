import type { Payment, Prisma } from '@prisma/client';

export type PaymentTarget = 'order' | 'subscription';

// Implemented by the module that owns the payment's target (orders now, subscriptions in M4) and registered
// with PaymentsService.registerHandler in onModuleInit. Both methods run inside settle's transaction and
// must never write Payment (spec §2.1, §4.1).
export interface PaymentOutcomeHandler {
  onSucceeded(tx: Prisma.TransactionClient, payment: Payment): Promise<void>;
  onFailed(tx: Prisma.TransactionClient, payment: Payment): Promise<void>;
}

export function targetOf(payment: Pick<Payment, 'orderId'>): PaymentTarget {
  return payment.orderId ? 'order' : 'subscription';
}
