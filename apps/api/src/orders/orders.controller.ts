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

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quote')
  @HttpCode(200)
  quote(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(orderInputSchema)) body: OrderInput): Promise<OrderQuote> {
    return this.orders.quote(user.id, body);
  }

  @Post()
  place(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(orderInputSchema)) body: OrderInput,
  ): Promise<PlaceOrderResult> {
    return this.orders.place(user.id, body);
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
}
