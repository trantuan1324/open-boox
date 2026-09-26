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

@Roles('ADMIN')
@Controller('admin')
export class InventoryAdminController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('books/:id/stock')
  @HttpCode(200)
  adjustStock(
    @Param('id') bookId: string,
    @Body(new ZodValidationPipe(stockAdjustSchema)) body: StockAdjustInput,
  ): Promise<StockDto> {
    return this.inventory.adjustStock(bookId, body.delta);
  }

  @Post('books/:id/copies')
  addCopies(
    @Param('id') bookId: string,
    @Body(new ZodValidationPipe(addCopiesSchema)) body: AddCopiesInput,
  ): Promise<BookCopyDto[]> {
    return this.inventory.addCopies(bookId, body.count);
  }

  @Post('copies/:id/lost')
  @HttpCode(200)
  markLost(@Param('id') copyId: string): Promise<BookCopyDto> {
    return this.inventory.markCopyLost(copyId);
  }
}
