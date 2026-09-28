import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { ShipmentsModule } from '../shipments/shipments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

// Higher level: imports subscriptions, shipments and inventory; none of them imports loans (spec §2.1).
@Module({
  imports: [SubscriptionsModule, ShipmentsModule, InventoryModule, UsersModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
