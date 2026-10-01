'use client';

import type { ErrorCode, SubscribeResult } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { messageFor } from '@/lib/errors/messages';

// Signed out: apiClient's 401 handling sends the visitor to /login?next=/plans.
export function SubscribeButton({ planCode }: { planCode: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  async function subscribe() {
    setPending(true);
    setError(null);
    try {
      const result = await apiClient<SubscribeResult>('/subscriptions', { method: 'POST', body: { planCode } });
      router.push(result.redirectUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'INTERNAL_ERROR');
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <Button disabled={pending} onClick={subscribe} className="self-start">
        Đăng ký
      </Button>
      {error && (
        <p role="alert" className="text-[14px] text-ember">
          {messageFor(error)}{' '}
          {error === 'SUBSCRIPTION_ALREADY_EXISTS' && (
            <Link href="/account/subscription" className="font-bold uppercase tracking-[0.03em] underline">
              Xem gói của bạn
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
