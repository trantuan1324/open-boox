import type { BookSummary, CategoryDto, Paged, PlanDto } from '@open-boox/shared';

// Accent runs cycle yellow → lilac → blue → orange → mint (ui_design/landing-ui-spec.md §2.1).
export const PALETTE = ['#ffd731', '#e9ccff', '#4da2ff', '#fb4903', '#55db9c'] as const;

export const FALLBACK_PLANS: PlanDto[] = [
  { code: 'basic', name: 'Basic', maxBooks: 2, monthlyPrice: 79000 },
  { code: 'standard', name: 'Standard', maxBooks: 3, monthlyPrice: 119000 },
  { code: 'premium', name: 'Premium', maxBooks: 5, monthlyPrice: 179000 },
];

export const FALLBACK_CATEGORIES: CategoryDto[] = [
  { id: 'van-hoc', name: 'Văn học', slug: 'van-hoc' },
  { id: 'kinh-te', name: 'Kinh tế', slug: 'kinh-te' },
  { id: 'tam-ly-ky-nang', name: 'Tâm lý – Kỹ năng', slug: 'tam-ly-ky-nang' },
  { id: 'khoa-hoc', name: 'Khoa học', slug: 'khoa-hoc' },
  { id: 'lich-su', name: 'Lịch sử', slug: 'lich-su' },
  { id: 'thieu-nhi', name: 'Thiếu nhi', slug: 'thieu-nhi' },
];

export interface LandingData {
  plans: PlanDto[];
  categories: CategoryDto[];
  books: BookSummary[];
  total: number | null;
}

export type Fetcher = <T>(path: string) => Promise<T>;

// Each source fails on its own: plans and categories fall back to static copies, books to an empty shelf.
export async function loadLanding(fetcher: Fetcher): Promise<LandingData> {
  const [plans, categories, books] = await Promise.allSettled([
    fetcher<PlanDto[]>('/plans'),
    fetcher<CategoryDto[]>('/categories'),
    fetcher<Paged<BookSummary>>('/books'),
  ]);
  return {
    plans: plans.status === 'fulfilled' ? plans.value : FALLBACK_PLANS,
    categories: categories.status === 'fulfilled' ? categories.value : FALLBACK_CATEGORIES,
    books: books.status === 'fulfilled' ? books.value.items : [],
    total: books.status === 'fulfilled' ? books.value.total : null,
  };
}

export function cheapestPlanPrice(plans: PlanDto[]): number | null {
  return plans.length ? Math.min(...plans.map((p) => p.monthlyPrice)) : null;
}

export function pickFeaturedBook(books: BookSummary[], rand: () => number = Math.random): BookSummary | null {
  const withCover = books.filter((b) => b.coverUrl);
  return withCover.length ? withCover[Math.floor(rand() * withCover.length)] : null;
}

export function cycleColor(i: number, palette: readonly string[] = PALETTE): string {
  return palette[i % palette.length];
}

export interface Step {
  n: number;
  title: string;
  body: string;
}

export type HowCard = { kind: 'step'; step: Step } | { kind: 'stat'; total: number };

export const STEPS: Step[] = [
  { n: 1, title: 'Chọn gói', body: 'Basic, Standard hay Premium — khác nhau ở số cuốn được giữ cùng lúc.' },
  { n: 2, title: 'Chọn sách', body: 'Thêm sách vào giỏ mượn rồi xác nhận một lần.' },
  { n: 3, title: 'Nhận tận nhà', body: 'Sách được giao tới địa chỉ bạn chọn.' },
  { n: 4, title: 'Trả & mượn tiếp', body: 'Báo trả, chúng tôi đến lấy. Chỗ trống trong gói sẵn sàng cho cuốn mới.' },
];

// The stat card goes third, between "Chọn sách" and "Nhận tận nhà"; no stat when the total is unknown or zero.
export function howItWorksCards(total: number | null): HowCard[] {
  const cards: HowCard[] = STEPS.map((step) => ({ kind: 'step', step }));
  if (total) cards.splice(2, 0, { kind: 'stat', total });
  return cards;
}
