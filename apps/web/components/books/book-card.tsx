import type { BookSummary } from '@open-boox/shared';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import { BookCover } from './book-cover';

export function BookCard({ book }: { book: BookSummary }) {
  const soldOut = book.salePrice !== null && book.saleStock === 0;
  return (
    <Link
      href={`/books/${book.slug}`}
      className="flex h-full flex-col gap-[8px] rounded-[20px] border border-ink bg-paper p-[16px] transition hover:-translate-y-1"
    >
      <BookCover src={book.coverUrl} title={book.title} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" />
      <div className="flex flex-col gap-[4px]">
        <h2 className="display text-[20px] leading-[0.9]">{book.title}</h2>
        <p className="text-[14px]">{book.author}</p>
        <p className="text-[14px] font-bold">{book.salePrice === null ? 'Không bán' : formatVnd(book.salePrice)}</p>
        {soldOut && <p className="text-[11px] font-bold uppercase tracking-[0.03em] text-ember">Hết hàng</p>}
        {book.availableCopies > 0 && (
          <p className="text-[11px] font-bold uppercase tracking-[0.03em]">Có thể mượn</p>
        )}
      </div>
    </Link>
  );
}
