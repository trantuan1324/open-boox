import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  type CurrentSubscription,
  type PlanCodeInput,
  planCodeInputSchema,
  type SubscribeResult,
  type SubscriptionDto,
} from '@open-boox/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('current')
  current(@CurrentUser() user: AuthUser): Promise<CurrentSubscription> {
    return this.subscriptions.current(user.id);
  }

  @Post()
  subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(planCodeInputSchema)) body: PlanCodeInput,
  ): Promise<SubscribeResult> {
    return this.subscriptions.subscribe(user.id, body.planCode);
  }

  @Post('change-plan')
  @HttpCode(200)
  changePlan(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(planCodeInputSchema)) body: PlanCodeInput,
  ): Promise<SubscriptionDto> {
    return this.subscriptions.changePlan(user.id, body.planCode);
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser): Promise<SubscriptionDto> {
    return this.subscriptions.cancel(user.id);
  }

  @Post('resume')
  @HttpCode(200)
  resume(@CurrentUser() user: AuthUser): Promise<SubscriptionDto> {
    return this.subscriptions.resume(user.id);
  }
}
