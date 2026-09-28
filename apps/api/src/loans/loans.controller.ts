import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  type BorrowInput,
  borrowInputSchema,
  type BorrowResult,
  type LoanDto,
  type LoanListQuery,
  loanListQuerySchema,
  type Paged,
  type ReturnInput,
  returnInputSchema,
  type ReturnResult,
} from '@open-boox/shared';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { RevalidationService } from '../revalidation/revalidation.service';
import { LoansService } from './loans.service';

@Controller('loans')
export class LoansController {
  constructor(
    private readonly loans: LoansService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Post()
  async borrow(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(borrowInputSchema)) body: BorrowInput,
  ): Promise<BorrowResult> {
    const result = await this.loans.borrow(user.id, body);
    void this.revalidation.catalogChanged(); // fewer loanable copies (spec §4.9)
    return result;
  }

  // No revalidation: copies only become AVAILABLE when the pickup is DELIVERED (PATCH /admin/shipments/:id).
  @Post('return')
  returnLoans(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(returnInputSchema)) body: ReturnInput,
  ): Promise<ReturnResult> {
    return this.loans.returnLoans(user.id, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(loanListQuerySchema)) query: LoanListQuery,
  ): Promise<Paged<LoanDto>> {
    return this.loans.list(user.id, query.page);
  }
}
