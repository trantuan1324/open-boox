'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm('Hủy đơn hàng này?')) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/orders/${orderId}/cancel`, { method: 'POST' });
    } catch (e) {
      setError(messageFor(e instanceof ApiError ? e.code : 'INTERNAL_ERROR'));
    } finally {
      setPending(false);
      router.refresh(); // show the real status either way (e.g. paid meanwhile)
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <Button variant="ghost" disabled={pending} onClick={cancel} className="self-start">
        Hủy đơn
      </Button>
      {error && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {error}
        </p>
      )}
    </div>
  );
}
