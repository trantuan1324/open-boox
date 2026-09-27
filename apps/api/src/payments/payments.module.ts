import { Module } from '@nestjs/common';
import { MockGateway, PaymentGateway } from './payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// Low-level: never imports orders/subscriptions; they register handlers here instead (spec §2.1).
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PaymentGateway, useClass: MockGateway }],
  exports: [PaymentsService],
})
export class PaymentsModule {}
