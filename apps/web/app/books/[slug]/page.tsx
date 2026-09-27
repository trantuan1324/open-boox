import type { BookDetail } from '@open-boox/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { BookCover } from '@/components/books/book-cover';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiPublic } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await apiPublic<BookDetail>(`/books/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(nullOn404);
  if (!book) notFound();

  return (
    <div className="mx-auto grid max-w-5xl gap-[41px] px-[24px] py-[41px] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <BookCover src={book.coverUrl} title={book.title} sizes="(min-width: 768px) 40vw, 100vw" />
      <div className="flex flex-col gap-[24px]">
        <Link href={`/books?category=${book.categorySlug}`} className="self-start text-[12px] font-medium uppercase underline">
          {book.categoryName}
        </Link>
        <PageTitle>{book.title}</PageTitle>
        <p className="text-[18px]">{book.author}</p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-[31px] gap-y-[12px] rounded-[12px] border border-dashed border-cork-border p-[24px] text-[16px]">
          <dt className="text-[12px] font-medium uppercase">Mua</dt>
          <dd>
            {book.salePrice === null ? (
              'Không bán'
            ) : (
              <>
                {formatVnd(book.salePrice)} ·{' '}
                {book.saleStock > 0 ? (
                  `Còn ${book.saleStock} cuốn để bán`
                ) : (
                  <span className="text-ember-accent">Hết hàng</span>
                )}
              </>
            )}
          </dd>
          <dt className="text-[12px] font-medium uppercase">Mượn</dt>
          <dd>{book.availableCopies > 0 ? `Còn ${book.availableCopies} bản cho mượn` : 'Hiện không còn bản cho mượn'}</dd>
          <dt className="text-[12px] font-medium uppercase">ISBN</dt>
          <dd>{book.isbn}</dd>
        </dl>
        {book.salePrice !== null && book.saleStock > 0 && (
          <AddToCartButton
            book={{ bookId: book.id, slug: book.slug, title: book.title, coverUrl: book.coverUrl, salePrice: book.salePrice }}
          />
        )}
        {book.description && <p className="whitespace-pre-line text-[16px] leading-[1.5]">{book.description}</p>}
      </div>
    </div>
  );
}
