import type { BookSummary } from '@open-boox/shared';
import Image from 'next/image';
import { CurtainLink } from '@/components/curtain/curtain-link';
import { isOptimizedCoverHost } from '@/lib/books/cover';
import { StickerBook } from '../svg/stickers';

// Section 5: three display lines with a featured book card set inline between words ([SM §4 #5], [SM §5.7]).
// Only phrasing content inside the h2: the card is a link around an <img> and spans.
export function Statement({ book }: { book: BookSummary | null }) {
  return (
    <section className="obx-sheet obx-statement">
      <h2 className="obx-display obx-statement__text" data-heading-reveal>
        <span className="obx-statement__line" data-line>
          Mọi cuốn sách
        </span>
        <span className="obx-statement__line" data-line>
          Giao{' '}
          {book?.coverUrl ? (
            <CurtainLink href={`/books/${book.slug}`} className="obx-featured" data-cursor="Xem sách">
              <Image
                src={book.coverUrl}
                alt={`Bìa sách ${book.title}`}
                width={120}
                height={180}
                className="obx-featured__cover"
                unoptimized={!isOptimizedCoverHost(book.coverUrl)}
              />
              <span className="obx-featured__meta">
                <span className="obx-featured__title">{book.title}</span>
                <span>{book.author}</span>
              </span>
            </CurtainLink>
          ) : (
            <span className="obx-featured" aria-hidden="true">
              <StickerBook className="obx-featured__sticker" />
            </span>
          )}{' '}
          tận cửa
        </span>
      </h2>
    </section>
  );
}
