import { Injectable } from '@nestjs/common';

export type ChargeOutcome = 'SUCCEEDED' | 'FAILED';

// Abstract class so it doubles as the DI token (spec §4.1).
export abstract class PaymentGateway {
  abstract createCheckout(payment: { id: string }): { redirectUrl: string };
  // Charges without the customer present (auto-renewal, spec §4.2); a real gateway would use a stored method.
  abstract charge(payment: { id: string; amount: number }): Promise<ChargeOutcome>;
}

@Injectable()
export class MockGateway extends PaymentGateway {
  createCheckout(payment: { id: string }): { redirectUrl: string } {
    return { redirectUrl: `/checkout/mock/${payment.id}` };
  }

  // The declined branch is only reachable from tests with a fake gateway (spec §4.1).
  async charge(): Promise<ChargeOutcome> {
    return 'SUCCEEDED';
  }
}
