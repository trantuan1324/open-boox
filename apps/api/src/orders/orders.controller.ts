import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type OrderDetail,
  type OrderInput,
  orderInputSchema,
  type OrderListQuery,
  orderListQuerySchema,
  type OrderQuote,
  type OrderSummary,
  type Paged,
  type PlaceOrderResult,
} from '@open-boox/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { OrdersService } from './orders.service';
import { RevalidationService } from '../revalidation/revalidation.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Post('quote')
  @HttpCode(200)
  quote(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(orderInputSchema)) body: OrderInput): Promise<OrderQuote> {
    return this.orders.quote(user.id, body);
  }

  @Post()
  async place(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderInputSchema)) body: OrderInput,
  ): Promise<PlaceOrderResult> {
    const result = await this.orders.place(user.id, body);
    void this.revalidation.catalogChanged(); // stock was taken (spec §4.9)
    return result;
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(orderListQuerySchema)) query: OrderListQuery,
  ): Promise<Paged<OrderSummary>> {
    return this.orders.list(user.id, query.page);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.orders.detail(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetail> {
    const order = await this.orders.cancel(user.id, id);
    void this.revalidation.catalogChanged();
    return order;
  }
}
