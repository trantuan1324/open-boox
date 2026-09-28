import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { type MockCallbackInput, mockCallbackSchema, type PaymentDto } from '@open-boox/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { PaymentsService } from './payments.service';
import { RevalidationService } from '../revalidation/revalidation.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PaymentDto> {
    return this.payments.getForUser(user.id, id);
  }

  @Post(':id/mock-callback')
  @HttpCode(200)
  async callback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(mockCallbackSchema)) body: MockCallbackInput,
  ): Promise<PaymentDto> {
    const payment = await this.payments.mockCallback(user.id, id, body.success);
    void this.revalidation.catalogChanged();
    return payment;
  }
}
