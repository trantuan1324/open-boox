import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  type AddCopiesInput,
  addCopiesSchema,
  type BookCopyDto,
  type StockAdjustInput,
  stockAdjustSchema,
  type StockDto,
} from '@open-boox/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { InventoryService } from './inventory.service';
import { RevalidationService } from '../revalidation/revalidation.service';

@Roles('ADMIN')
@Controller('admin')
export class InventoryAdminController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Post('books/:id/stock')
  @HttpCode(200)
  async adjustStock(
    @Param('id') bookId: string,
    @Body(new ZodValidationPipe(stockAdjustSchema)) body: StockAdjustInput,
  ): Promise<StockDto> {
    const result = await this.inventory.adjustStock(bookId, body.delta);
    void this.revalidation.catalogChanged();
    return result;
  }

  @Post('books/:id/copies')
  async addCopies(
    @Param('id') bookId: string,
    @Body(new ZodValidationPipe(addCopiesSchema)) body: AddCopiesInput,
  ): Promise<BookCopyDto[]> {
    const result = await this.inventory.addCopies(bookId, body.count);
    void this.revalidation.catalogChanged();
    return result;
  }

  @Post('copies/:id/lost')
  @HttpCode(200)
  async markLost(@Param('id') copyId: string): Promise<BookCopyDto> {
    const result = await this.inventory.markCopyLost(copyId);
    void this.revalidation.catalogChanged();
    return result;
  }
}
