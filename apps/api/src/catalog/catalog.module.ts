import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { AdminBooksController } from './admin-books.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [InventoryModule],
  controllers: [CatalogController, AdminBooksController],
  providers: [CatalogService],
})
export class CatalogModule {}
