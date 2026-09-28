'use client';

import type { PaymentDto } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';
import { PAYMENT_STATUS_LABEL } from '@/lib/orders/labels';

export function MockPaymentPanel({ payment }: { payment: PaymentDto }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = payment.orderId
    ? `/account/orders/${payment.orderId}`
    : payment.subscriptionId
      ? '/account/subscription'
      : '/account';

  async function settle(success: boolean) {
    setPending(true);
    setError(null);
    try {
      await apiClient(`/payments/${payment.id}/mock-callback`, { method: 'POST', body: { success } });
      router.replace(done);
      router.refresh();
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
      setPending(false);
    }
  }

  if (payment.status !== 'PENDING') {
    return (
      <div className="flex flex-col gap-[12px]">
        <p className="text-[16px]">Trạng thái thanh toán: {PAYMENT_STATUS_LABEL[payment.status]}</p>
        <Link href={done} className="self-start text-[12px] font-medium uppercase underline">
          {payment.subscriptionId ? 'Xem gói' : 'Xem đơn hàng'}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-[12px]">
        <Button disabled={pending} onClick={() => settle(true)}>
          Thanh toán thành công
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => settle(false)}>
          Thất bại
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
    </div>
  );
}
