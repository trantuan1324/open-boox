'use client';

import type { SubscriptionDto } from '@open-boox/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';
import { formatVnd } from '@/lib/format';
import type { PlanOption } from '@/lib/subscriptions/plan-options';

const box = 'flex flex-col gap-[18px] rounded-[12px] border border-dashed border-cork-border p-[24px]';

export function SubscriptionActions({ subscription, options }: { subscription: SubscriptionDto; options: PlanOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'change-plan' | 'cancel' | 'resume', body?: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/subscriptions/${action}`, { method: 'POST', body });
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      setPending(false);
      router.refresh(); // show the real state either way (e.g. expired meanwhile)
    }
  }

  return (
    <>
      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Đổi gói</h2>
        {options.length === 0 ? (
          <p className="text-[16px]">Không có gói nào khác.</p>
        ) : (
          <ul className="flex flex-col gap-[12px]">
            {options.map(({ plan, change, label }) => (
              <li key={plan.code} className="flex flex-wrap items-center justify-between gap-[12px]">
                <span className="text-[16px]">
                  {plan.name} · {plan.maxBooks} cuốn · {formatVnd(plan.monthlyPrice)}
                </span>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      'change-plan',
                      { planCode: plan.code },
                      change === 'UPGRADE' ? `Nâng cấp lên ${plan.name} ngay? Giá mới áp dụng từ lần gia hạn kế tiếp.` : undefined,
                    )
                  }
                >
                  {label}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={box}>
        <h2 className="text-[18px] font-medium uppercase">Gia hạn tự động</h2>
        {subscription.cancelAtPeriodEnd ? (
          <Button disabled={pending} onClick={() => run('resume')} className="self-start">
            Tiếp tục gói
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run('cancel', undefined, 'Hủy gia hạn? Bạn vẫn dùng gói tới hết kỳ hiện tại.')}
            className="self-start"
          >
            Hủy gia hạn
          </Button>
        )}
      </section>
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
    </>
  );
}
