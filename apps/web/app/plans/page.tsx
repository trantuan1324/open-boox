import type { PlanDto } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiPublic } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

export default async function PlansPage() {
  const plans = await apiPublic<PlanDto[]>('/plans');
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Gói mượn sách</PageTitle>
      <p className="text-[16px]">
        Giữ cùng lúc tối đa số cuốn của gói, không hạn trả. Gói tự gia hạn mỗi 30 ngày; nâng cấp có hiệu lực ngay, hạ cấp
        hoặc hủy có hiệu lực từ kỳ sau.
      </p>
      <ul className="grid gap-[24px] md:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.code} className="flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]">
            <h2 className="text-[18px] font-medium uppercase">{plan.name}</h2>
            <p className="text-[16px]">Tối đa {plan.maxBooks} cuốn cùng lúc</p>
            <p className="text-[29px] font-medium">
              {formatVnd(plan.monthlyPrice)}
              <span className="text-[16px] font-normal"> / 30 ngày</span>
            </p>
            <SubscribeButton planCode={plan.code} />
          </li>
        ))}
      </ul>
    </div>
  );
}
