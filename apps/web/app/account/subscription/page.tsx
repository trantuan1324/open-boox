import type { CurrentSubscription, PlanDto } from '@open-boox/shared';
import Link from 'next/link';
import { PageTitle } from '@/components/ui/page-title';
import { apiPublic, apiServer } from '@/lib/api/server';
import { formatDate, formatVnd } from '@/lib/format';
import { SUBSCRIPTION_STATUS_LABEL } from '@/lib/subscriptions/labels';
import { planOptions } from '@/lib/subscriptions/plan-options';
import { SubscriptionActions } from './subscription-actions';

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export default async function SubscriptionPage() {
  const [{ subscription }, plans] = await Promise.all([
    apiServer<CurrentSubscription>('/subscriptions/current'),
    apiPublic<PlanDto[]>('/plans'),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Gói đăng ký</PageTitle>
      {!subscription ? (
        <div className={box}>
          <p className="text-[16px]">Bạn chưa có gói nào đang hoạt động.</p>
          <Link href="/plans" className="self-start text-[12px] font-medium uppercase underline">
            Xem các gói
          </Link>
        </div>
      ) : (
        <>
          <section className={box}>
            <h2 className="text-[18px] font-medium uppercase">{subscription.plan.name}</h2>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-[31px] gap-y-[12px] text-[16px]">
              <dt className="text-[12px] font-medium uppercase">Trạng thái</dt>
              <dd>{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</dd>
              <dt className="text-[12px] font-medium uppercase">Số cuốn</dt>
              <dd>Tối đa {subscription.plan.maxBooks} cuốn cùng lúc</dd>
              <dt className="text-[12px] font-medium uppercase">Giá</dt>
              <dd>{formatVnd(subscription.plan.monthlyPrice)} / 30 ngày</dd>
              {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                <>
                  <dt className="text-[12px] font-medium uppercase">Kỳ hiện tại</dt>
                  <dd>
                    {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
                  </dd>
                </>
              )}
            </dl>
            {subscription.status === 'PENDING_PAYMENT' && subscription.pendingPaymentId && (
              <Link
                href={`/checkout/mock/${subscription.pendingPaymentId}`}
                className="self-start rounded-[36px] bg-bark-brown px-6 py-3.5 text-[14px] font-medium uppercase leading-none"
              >
                Thanh toán
              </Link>
            )}
            {subscription.nextPlan && subscription.currentPeriodEnd && (
              <p className="text-[16px]">
                Từ {formatDate(subscription.currentPeriodEnd)} chuyển sang gói {subscription.nextPlan.name}.
              </p>
            )}
            {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
              <p className="text-[16px] text-ember-accent">Gói sẽ kết thúc ngày {formatDate(subscription.currentPeriodEnd)}.</p>
            )}
          </section>
          {subscription.status === 'ACTIVE' && (
            <SubscriptionActions subscription={subscription} options={planOptions(subscription, plans)} />
          )}
        </>
      )}
    </div>
  );
}
