import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type AdminLoanListQuery,
  adminLoanListQuerySchema,
  type AdminLoanRow,
  type AdminShipmentDetail,
  type Paged,
} from '@open-boox/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { RevalidationService } from '../revalidation/revalidation.service';
import { LoansService } from './loans.service';

// cancel-loans sits under /admin/shipments but belongs here: loans owns Loan, and shipments must not import
// loans (spec §2.1, §4.6).
@Roles('ADMIN')
@Controller('admin')
export class AdminLoansController {
  constructor(
    private readonly loans: LoansService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get('loans')
  list(@Query(new ZodValidationPipe(adminLoanListQuerySchema)) query: AdminLoanListQuery): Promise<Paged<AdminLoanRow>> {
    return this.loans.adminList(query);
  }

  @Post('shipments/:id/cancel-loans')
  @HttpCode(200)
  async cancelLoans(@Param('id') id: string): Promise<AdminShipmentDetail> {
    const shipment = await this.loans.cancelLoans(id);
    void this.revalidation.catalogChanged(); // copies are AVAILABLE again (spec §4.9)
    return shipment;
  }
}
