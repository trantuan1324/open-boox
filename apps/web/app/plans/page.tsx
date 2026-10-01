import type { PlanDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiPublic } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

const CARD_COLORS = ['bg-sunburst', 'bg-lilac', 'bg-blue'];
const CARD_STICKERS = ['📚', '🪙', '📦'];

export default async function PlansPage() {
  const plans = await apiPublic<PlanDto[]>('/plans');
  return (
    <div className="sheet mx-auto flex w-full max-w-5xl flex-col gap-[40px] px-[20px] py-[48px] md:px-[64px] md:py-[80px]">
      <div className="flex flex-col justify-between gap-[24px] md:flex-row md:items-end">
        <PageTitle>
          Một gói,
          <br />
          <em>cả thư viện</em>
        </PageTitle>
        <p className="max-w-[380px] text-[16px] leading-[1.4] md:text-[18px]">
          Giữ cùng lúc tối đa số cuốn của gói, không hạn trả. Tự gia hạn mỗi 30 ngày; nâng cấp có hiệu lực ngay, hạ cấp
          hoặc hủy có hiệu lực từ kỳ sau.
        </p>
      </div>
      <ul className="grid gap-[16px] md:grid-cols-3">
        {plans.map((plan, i) => (
          <li
            key={plan.code}
            className={`relative flex flex-col gap-[14px] rounded-[20px] border border-ink p-[24px] md:p-[32px] ${CARD_COLORS[i % CARD_COLORS.length]}`}
          >
            <span className="text-[13px] font-bold uppercase tracking-[0.03em]">{plan.name}</span>
            <p className="display text-[48px] md:text-[72px]">
              <em>
                {plan.maxBooks} cuốn
                <br />
                cùng lúc
              </em>
            </p>
            <p className="mt-auto text-[26px] font-bold md:text-[34px]">
              <span className="whitespace-nowrap">{formatVnd(plan.monthlyPrice)}</span>
              <span className="text-[14px] font-medium whitespace-nowrap md:text-[16px]"> / 30 ngày</span>
            </p>
            <SubscribeButton planCode={plan.code} />
            <span
              aria-hidden
              className="absolute -right-[18px] -top-[18px] hidden h-[80px] w-[80px] rotate-[8deg] items-center justify-center rounded-full border border-ink bg-paper text-[36px] md:flex"
            >
              {CARD_STICKERS[i % CARD_STICKERS.length]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
