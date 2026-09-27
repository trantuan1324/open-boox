import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { UsersModule } from '../users/users.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderPaymentHandler } from './order-payment.handler';
import { OrderShipmentHandler } from './order-shipment.handler';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [InventoryModule, PaymentsModule, ShipmentsModule, UsersModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderPaymentHandler, OrderShipmentHandler],
})
export class OrdersModule {}
