import type { PaymentDto } from '@open-boox/shared';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui/page-title';
import { nullOn404 } from '@/lib/api/error';
import { apiServer } from '@/lib/api/server';
import { formatVnd } from '@/lib/format';
import { MockPaymentPanel } from './mock-payment-panel';

export default async function MockPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await apiServer<PaymentDto>(`/payments/${encodeURIComponent(paymentId)}`).catch(nullOn404);
  if (!payment) notFound();

  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[31px]">
      <PageTitle>Thanh toán thử</PageTitle>
      <div className="flex max-w-[560px] flex-col gap-[31px]">
        <p className="text-[16px]">Cổng thanh toán giả lập — chọn kết quả để tiếp tục.</p>
        <p className="text-[29px] font-medium">{formatVnd(payment.amount)}</p>
        <MockPaymentPanel payment={payment} />
      </div>
    </div>
  );
}
