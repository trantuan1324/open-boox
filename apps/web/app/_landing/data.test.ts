import type { BookSummary, PlanDto } from '@open-boox/shared';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CATEGORIES,
  FALLBACK_PLANS,
  PALETTE,
  STEPS,
  cheapestPlanPrice,
  cycleColor,
  howItWorksCards,
  loadLanding,
  pickFeaturedBook,
  type Fetcher,
} from './data';

const book = (slug: string, coverUrl: string | null): BookSummary => ({
  id: slug,
  slug,
  title: slug,
  author: 'Tác giả',
  isbn: '000',
  coverUrl,
  salePrice: null,
  categoryName: 'Văn học',
  categorySlug: 'van-hoc',
  saleStock: 0,
  availableCopies: 1,
});

const plan = (code: string, monthlyPrice: number): PlanDto => ({ code, name: code, maxBooks: 2, monthlyPrice });

describe('loadLanding', () => {
  it('returns every source when the API answers', async () => {
    const plans = [plan('basic', 79000)];
    const categories = [{ id: 'c', name: 'Văn học', slug: 'van-hoc' }];
    const books = [book('a', null)];
    const fetcher: Fetcher = async <T,>(path: string) =>
      ({ '/plans': plans, '/categories': categories, '/books': { items: books, total: 40, page: 1, pageSize: 12 } })[
        path
      ] as T;
    expect(await loadLanding(fetcher)).toEqual({ plans, categories, books, total: 40 });
  });

  it('falls back per source when calls fail', async () => {
    const fetcher: Fetcher = async () => {
      throw new Error('down');
    };
    expect(await loadLanding(fetcher)).toEqual({
      plans: FALLBACK_PLANS,
      categories: FALLBACK_CATEGORIES,
      books: [],
      total: null,
    });
  });

  it('keeps the sources that worked when only books fail', async () => {
    const plans = [plan('basic', 79000)];
    const fetcher: Fetcher = async <T,>(path: string) => {
      if (path === '/books') throw new Error('down');
      return (path === '/plans' ? plans : []) as T;
    };
    const data = await loadLanding(fetcher);
    expect(data.plans).toBe(plans);
    expect(data.categories).toEqual([]);
    expect(data.total).toBeNull();
  });
});

describe('cheapestPlanPrice', () => {
  it('returns the lowest monthly price', () => {
    expect(cheapestPlanPrice([plan('a', 119000), plan('b', 79000), plan('c', 179000)])).toBe(79000);
  });

  it('returns null without plans', () => {
    expect(cheapestPlanPrice([])).toBeNull();
  });
});

describe('pickFeaturedBook', () => {
  it('only picks books that have a cover', () => {
    const books = [book('a', null), book('b', 'https://x/b.jpg'), book('c', 'https://x/c.jpg')];
    expect(pickFeaturedBook(books, () => 0)?.slug).toBe('b');
    expect(pickFeaturedBook(books, () => 0.99)?.slug).toBe('c');
  });

  it('returns null when no book has a cover', () => {
    expect(pickFeaturedBook([book('a', null)], () => 0)).toBeNull();
    expect(pickFeaturedBook([], () => 0)).toBeNull();
  });
});

describe('cycleColor', () => {
  it('wraps around the palette', () => {
    expect(cycleColor(0)).toBe(PALETTE[0]);
    expect(cycleColor(PALETTE.length + 1)).toBe(PALETTE[1]);
    expect(cycleColor(3, ['#1', '#2'])).toBe('#2');
  });
});

describe('howItWorksCards', () => {
  it('puts the stat card third when there are books', () => {
    const cards = howItWorksCards(120);
    expect(cards.map((c) => c.kind)).toEqual(['step', 'step', 'stat', 'step', 'step']);
    expect(cards[2]).toEqual({ kind: 'stat', total: 120 });
  });

  it('shows only the steps when the total is unknown or zero', () => {
    expect(howItWorksCards(null)).toEqual(STEPS.map((step) => ({ kind: 'step', step })));
    expect(howItWorksCards(0)).toHaveLength(STEPS.length);
  });
});
