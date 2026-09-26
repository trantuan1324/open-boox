import type { BookSummary } from '@open-boox/shared';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import { BookCover } from './book-cover';

export function BookCard({ book }: { book: BookSummary }) {
  const soldOut = book.salePrice !== null && book.saleStock === 0;
  return (
    <Link href={`/books/${book.slug}`} className="flex flex-col gap-[12px]">
      <BookCover src={book.coverUrl} title={book.title} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" />
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[16px] font-medium uppercase leading-[1.1]">{book.title}</h2>
        <p className="text-[14px]">{book.author}</p>
        <p className="text-[14px]">{book.salePrice === null ? 'Không bán' : formatVnd(book.salePrice)}</p>
        {soldOut && <p className="text-[12px] font-medium uppercase text-ember-accent">Hết hàng</p>}
        {book.availableCopies > 0 && <p className="text-[12px] font-medium uppercase">Có thể mượn</p>}
      </div>
    </Link>
  );
}
