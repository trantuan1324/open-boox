import type { AdminBookDetail, CategoryDto } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiPublic, apiServer } from '@/lib/api/server';
import { BookForm } from '../book-form';
import { CopiesPanel } from '../copies-panel';
import { DeleteBookButton } from '../delete-book-button';
import { StockPanel } from '../stock-panel';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, categories] = await Promise.all([
    apiServer<AdminBookDetail>(`/admin/books/${encodeURIComponent(id)}`).catch(nullOn404),
    apiPublic<CategoryDto[]>('/categories'),
  ]);
  if (!book) notFound();

  return (
    <div className="flex flex-col gap-[41px]">
      <div className="flex flex-col gap-[12px]">
        <PageTitle>{book.title}</PageTitle>
        <Link href={`/books/${book.slug}`} className="self-start text-[12px] font-medium uppercase underline">
          Xem trang công khai
        </Link>
      </div>
      <BookForm categories={categories} book={book} />
      <StockPanel bookId={book.id} quantity={book.saleStock} />
      <CopiesPanel bookId={book.id} copies={book.copies} />
      <DeleteBookButton bookId={book.id} />
    </div>
  );
}
