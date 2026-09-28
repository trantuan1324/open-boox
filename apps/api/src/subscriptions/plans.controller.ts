import { Controller, Get } from '@nestjs/common';
import type { PlanDto } from '@open-boox/shared';
import { Public } from '../auth/decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Public()
@Controller('plans')
export class PlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(): Promise<PlanDto[]> {
    return this.subscriptions.plans();
  }
}
