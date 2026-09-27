import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type AdminOrderDetail,
  type AdminOrderListQuery,
  adminOrderListQuerySchema,
  type AdminOrderRow,
  type Paged,
} from '@open-boox/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { OrdersService } from './orders.service';

// Read-only: every delivery action lives under /admin/shipments (spec §4.5, §4.6).
@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(adminOrderListQuerySchema)) query: AdminOrderListQuery): Promise<Paged<AdminOrderRow>> {
    return this.orders.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminOrderDetail> {
    return this.orders.adminDetail(id);
  }
}
