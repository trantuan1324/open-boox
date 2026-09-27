import { Module } from '@nestjs/common';
import { AdminShipmentsController } from './admin-shipments.controller';
import { ShipmentsService } from './shipments.service';

// Low-level: never imports orders/loans; they register ShipmentStatusHandlers here instead (spec §2.1).
@Module({
  controllers: [AdminShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
