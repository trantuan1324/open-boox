import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AdminBookDetail,
  type AdminBookRow,
  type BookInput,
  bookInputSchema,
  type BookListQuery,
  bookListQuerySchema,
  type Paged,
} from '@open-boox/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@Roles('ADMIN')
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodValidationPipe(bookListQuerySchema)) query: BookListQuery): Promise<Paged<AdminBookRow>> {
    return this.catalog.listAdminBooks(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminBookDetail> {
    return this.catalog.getAdminBook(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(bookInputSchema)) body: BookInput): Promise<AdminBookDetail> {
    return this.catalog.createBook(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(bookInputSchema)) body: BookInput): Promise<AdminBookDetail> {
    return this.catalog.updateBook(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.catalog.deleteBook(id);
  }
}
