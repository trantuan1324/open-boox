import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AdminShipmentDetail,
  type AdminShipmentListQuery,
  adminShipmentListQuerySchema,
  type AdminShipmentRow,
  type Paged,
  type ShipmentTransitionInput,
  shipmentTransitionSchema,
} from '@open-boox/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { ShipmentsService } from './shipments.service';

@Roles('ADMIN')
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminShipmentListQuerySchema)) query: AdminShipmentListQuery,
  ): Promise<Paged<AdminShipmentRow>> {
    return this.shipments.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminShipmentDetail> {
    return this.shipments.adminGet(id);
  }

  @Patch(':id')
  transition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(shipmentTransitionSchema)) body: ShipmentTransitionInput,
  ): Promise<AdminShipmentDetail> {
    return this.shipments.transition(id, body.status, body.note);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string): Promise<AdminShipmentDetail> {
    return this.shipments.retry(id);
  }
}
