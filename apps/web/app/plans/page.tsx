import type { PlanDto } from '@open-boox/shared';
import { StickerBook, StickerCoin, StickerParcel } from '@/app/_landing/svg/stickers';
import { PageTitle } from '@/components/ui/page-title';
import { apiPublic } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

const CARD_COLORS = ['bg-sunburst', 'bg-lilac', 'bg-blue'];
const CARD_STICKERS = [StickerBook, StickerCoin, StickerParcel];

export default async function PlansPage() {
  const plans = await apiPublic<PlanDto[]>('/plans');
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[40px]">
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
        {plans.map((plan, i) => {
          const Sticker = CARD_STICKERS[i % CARD_STICKERS.length];
          return (
            <li
              key={plan.code}
              className={`relative flex min-h-[320px] flex-col items-start gap-[16px] overflow-clip rounded-[30px] border border-ink p-[28px] md:min-h-[420px] ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <span className="text-[13px] font-bold uppercase tracking-[0.03em]">{plan.name}</span>
              <p className="display text-[clamp(56px,6vw,96px)]">
                <em>
                  {plan.maxBooks} cuốn
                  <br />
                  cùng lúc
                </em>
              </p>
              <p className="mt-auto text-[24px] font-bold md:text-[28px]">
                <span className="whitespace-nowrap">{formatVnd(plan.monthlyPrice)}</span>
                <span className="text-[16px] font-medium whitespace-nowrap"> / 30 ngày</span>
              </p>
              <SubscribeButton planCode={plan.code} />
              <Sticker className="absolute top-[16px] right-[16px] w-[72px] rotate-[10deg]" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
