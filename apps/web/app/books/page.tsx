import { type BookListQuery, bookListQuerySchema, type BookSummary, type CategoryDto, type Paged } from '@open-boox/shared';
import Link from 'next/link';
import { BookCard } from '@/components/books/book-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { PageTitle } from '@/components/ui/page-title';
import { TextField } from '@/components/ui/text-field';
import { apiPublic } from '@/lib/api/server';
import { bookSearch, filterHref } from '@/lib/books/filters';

const AVAILABILITY = [
  { value: 'sale', label: 'Có bán' },
  { value: 'loan', label: 'Cho mượn' },
] as const;

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = bookListQuerySchema.parse(await searchParams);
  const [categories, result] = await Promise.all([
    apiPublic<CategoryDto[]>('/categories'),
    apiPublic<Paged<BookSummary>>(`/books${bookSearch(filters)}`),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (change: Partial<BookListQuery>) => filterHref('/books', filters, change);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Sách</PageTitle>
      <form action="/books" className="flex max-w-md items-end gap-[12px]">
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        {filters.availability && <input type="hidden" name="availability" value={filters.availability} />}
        <div className="flex-1">
          <TextField label="Tìm theo tên hoặc tác giả" name="q" type="search" defaultValue={filters.q ?? ''} />
        </div>
        <Button type="submit" variant="ghost">
          Tìm
        </Button>
      </form>
      <nav aria-label="Thể loại" className="flex flex-wrap gap-[8px]">
        <Chip href={href({ category: undefined })} active={!filters.category}>
          Tất cả
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={href({ category: c.slug })} active={filters.category === c.slug}>
            {c.name}
          </Chip>
        ))}
      </nav>
      <nav aria-label="Tình trạng" className="flex flex-wrap gap-[8px]">
        {AVAILABILITY.map((a) => {
          const active = filters.availability === a.value;
          return (
            <Chip key={a.value} href={href({ availability: active ? undefined : a.value })} active={active}>
              {a.label}
            </Chip>
          );
        })}
      </nav>
      {result.items.length === 0 ? (
        <div className="flex flex-col gap-[12px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
          <p className="text-[16px]">Không tìm thấy sách phù hợp.</p>
          <Link href="/books" className="self-start text-[12px] font-medium uppercase underline">
            Xóa bộ lọc
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-[24px] sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((book) => (
            <li key={book.id}>
              <BookCard book={book} />
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-medium uppercase">
          {filters.page > 1 && <Link href={href({ page: filters.page - 1 })}>Trước</Link>}
          <span>
            Trang {filters.page}/{totalPages}
          </span>
          {filters.page < totalPages && <Link href={href({ page: filters.page + 1 })}>Sau</Link>}
        </nav>
      )}
    </div>
  );
}
