import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Clock } from './clock';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [PaymentsModule, AuthModule, SubscriptionsModule],
  providers: [SchedulerService, Clock],
})
export class SchedulerModule {}
