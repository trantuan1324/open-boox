import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { OrderPaymentHandler } from './order-payment.handler';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [InventoryModule, PaymentsModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderPaymentHandler],
})
export class OrdersModule {}
