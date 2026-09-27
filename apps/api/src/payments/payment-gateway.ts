import { Injectable } from '@nestjs/common';

// Abstract class so it doubles as the DI token (spec §4.1).
export abstract class PaymentGateway {
  abstract createCheckout(payment: { id: string }): { redirectUrl: string };
}

@Injectable()
export class MockGateway extends PaymentGateway {
  createCheckout(payment: { id: string }): { redirectUrl: string } {
    return { redirectUrl: `/checkout/mock/${payment.id}` };
  }
}
