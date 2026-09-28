'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { withError } from '@/lib/admin/error-param';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';

export function CancelLoansButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const base = `/admin/shipments/${shipmentId}`;

  async function cancel() {
    if (!window.confirm('Hủy mọi yêu cầu mượn của lần giao này? Sách được trả về kho.')) return;
    setPending(true);
    try {
      await apiClient(`/admin/shipments/${shipmentId}/cancel-loans`, { method: 'POST' });
      router.replace(base);
    } catch (e) {
      router.replace(withError(base, e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      router.refresh();
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" disabled={pending} onClick={cancel} className="self-start">
      Hủy yêu cầu mượn
    </Button>
  );
}
