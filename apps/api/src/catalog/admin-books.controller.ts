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
import { RevalidationService } from '../revalidation/revalidation.service';

@Roles('ADMIN')
@Controller('admin/books')
export class AdminBooksController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  list(@Query(new ZodValidationPipe(bookListQuerySchema)) query: BookListQuery): Promise<Paged<AdminBookRow>> {
    return this.catalog.listAdminBooks(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminBookDetail> {
    return this.catalog.getAdminBook(id);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(bookInputSchema)) body: BookInput): Promise<AdminBookDetail> {
    const book = await this.catalog.createBook(body);
    void this.revalidation.catalogChanged();
    return book;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(bookInputSchema)) body: BookInput): Promise<AdminBookDetail> {
    const book = await this.catalog.updateBook(id, body);
    void this.revalidation.catalogChanged();
    return book;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.catalog.deleteBook(id);
    void this.revalidation.catalogChanged();
  }
}
