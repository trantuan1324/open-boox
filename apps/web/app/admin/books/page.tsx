import { type AdminBookRow, type BookListQuery, bookListQuerySchema, type Paged } from '@open-boox/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/page-title';
import { TextField } from '@/components/ui/text-field';
import { apiServer } from '@/lib/api/server';
import { bookSearch, filterHref } from '@/lib/books/filters';
import { formatVnd } from '@/lib/format';

const TH = 'py-[10px] pr-[18px] text-left text-[12px] font-medium uppercase';
const TD = 'py-[10px] pr-[18px] text-[14px]';

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q, page } = bookListQuerySchema.parse(await searchParams);
  const result = await apiServer<Paged<AdminBookRow>>(`/admin/books${bookSearch({ q, page })}`);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (change: Partial<BookListQuery>) => filterHref('/admin/books', { q, page }, change);

  return (
    <div className="flex flex-col gap-[31px]">
      <div className="flex flex-wrap items-end justify-between gap-[18px]">
        <PageTitle>Sách</PageTitle>
        <Link
          href="/admin/books/new"
          className="rounded-[36px] bg-bark-brown px-[24px] py-[14px] text-[14px] font-medium uppercase leading-none"
        >
          Thêm sách
        </Link>
      </div>
      <form action="/admin/books" className="flex max-w-md items-end gap-[12px]">
        <div className="flex-1">
          <TextField label="Tìm theo tên hoặc tác giả" name="q" type="search" defaultValue={q ?? ''} />
        </div>
        <Button type="submit" variant="ghost">
          Tìm
        </Button>
      </form>
      {result.items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-cork-border p-[24px] text-[16px]">Chưa có sách nào phù hợp.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-dashed border-cork-border">
              <tr>
                <th className={TH}>Tên sách</th>
                <th className={TH}>Thể loại</th>
                <th className={TH}>Giá</th>
                <th className={TH}>Tồn bán</th>
                <th className={TH}>Bản sẵn / tổng</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((book) => {
                const copies = Object.values(book.copyCounts).reduce((a, b) => a + b, 0);
                return (
                  <tr key={book.id} className="border-b border-dashed border-cork-border">
                    <td className={TD}>
                      <Link href={`/admin/books/${book.id}`} className="underline">
                        {book.title}
                      </Link>
                    </td>
                    <td className={TD}>{book.categoryName}</td>
                    <td className={TD}>{book.salePrice === null ? '—' : formatVnd(book.salePrice)}</td>
                    <td className={TD}>{book.saleStock}</td>
                    <td className={TD}>
                      {book.copyCounts.AVAILABLE} / {copies}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-[18px] text-[12px] font-medium uppercase">
          {page > 1 && <Link href={href({ page: page - 1 })}>Trước</Link>}
          <span>
            Trang {page}/{totalPages}
          </span>
          {page < totalPages && <Link href={href({ page: page + 1 })}>Sau</Link>}
        </nav>
      )}
    </div>
  );
}
