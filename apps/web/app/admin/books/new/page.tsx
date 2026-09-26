import type { CategoryDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiPublic } from '@/lib/api/server';
import { BookForm } from '../book-form';

export default async function NewBookPage() {
  const categories = await apiPublic<CategoryDto[]>('/categories');
  return (
    <div className="flex flex-col gap-[31px]">
      <PageTitle>Thêm sách</PageTitle>
      <BookForm categories={categories} />
    </div>
  );
}
