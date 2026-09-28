import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PlansController } from './plans.controller';
import { SubscriptionPaymentHandler } from './subscription-payment.handler';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// Never imports loans; loans imports this module for findActiveForUpdate (spec §2.1).
@Module({
  imports: [PaymentsModule],
  controllers: [PlansController, SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionPaymentHandler],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
