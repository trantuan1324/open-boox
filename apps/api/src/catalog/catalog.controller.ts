import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type BookDetail,
  type BookListQuery,
  bookListQuerySchema,
  type BookSummary,
  type CategoryDto,
  type Paged,
} from '@open-boox/shared';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(): Promise<CategoryDto[]> {
    return this.catalog.listCategories();
  }

  @Get('books')
  books(@Query(new ZodValidationPipe(bookListQuerySchema)) query: BookListQuery): Promise<Paged<BookSummary>> {
    return this.catalog.listBooks(query);
  }

  @Get('books/:slug')
  book(@Param('slug') slug: string): Promise<BookDetail> {
    return this.catalog.getBookBySlug(slug);
  }
}
