import type { BookSummary } from '@open-boox/shared';
import Link from 'next/link';
import { BookCover } from '@/components/books/book-cover';
import { cycleColor } from '../data';
import { STICKERS } from '../svg/stickers';
import { Marquee } from '../ui/marquee';

const TILE_PALETTE = ['#4da2ff', '#ffd731', '#55db9c', '#e9ccff'];

// Section 11: book covers and authors from the catalog instead of partner logos. Sticker tiles when the API is down.
export function CoverMarquee({ books }: { books: BookSummary[] }) {
  return (
    <section className="obx-sheet obx-sheet--frame obx-covers" aria-label="Sách trong kho">
      <Marquee speed={25} repeat={books.length ? Math.max(1, Math.ceil(12 / books.length)) : 2}>
        {books.length
          ? books.map((book, i) => (
              <Link
                key={book.id}
                href={`/books/${book.slug}`}
                className="obx-cover-tile"
                style={{ background: cycleColor(i, TILE_PALETTE) }}
                data-cursor="Xem sách"
              >
                <span className="obx-cover-tile__cover">
                  <BookCover src={book.coverUrl} title={book.title} sizes="120px" />
                </span>
                <span className="obx-cover-tile__author">{book.author}</span>
              </Link>
            ))
          : STICKERS.map((Sticker, i) => (
              <span key={i} className="obx-cover-tile" style={{ background: cycleColor(i, TILE_PALETTE) }}>
                <Sticker className="obx-cover-tile__sticker" />
              </span>
            ))}
      </Marquee>
    </section>
  );
}
