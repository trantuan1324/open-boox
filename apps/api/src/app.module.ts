import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { LoansModule } from './loans/loans.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { RevalidationModule } from './revalidation/revalidation.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';

// Timers stay off under test: suites call SchedulerService methods directly with a fake time.
// Reads process.env directly — getEnv() here would cache the whole parsed env at import time,
// pinning setup-env.ts's rate-limit overrides before rate-limit.e2e-spec.ts restores the defaults.
const timers = process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()];

@Module({
  imports: [PrismaModule, RevalidationModule, AuthModule, CatalogModule, UsersModule, PaymentsModule, SubscriptionsModule, ShipmentsModule, OrdersModule, LoansModule, SchedulerModule, ...timers],
  controllers: [HealthController],
})
export class AppModule {}
