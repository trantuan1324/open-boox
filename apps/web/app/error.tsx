'use client';

import { Button } from '@/components/ui/button';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-[24px] font-medium uppercase">Đã có lỗi xảy ra</h1>
      <p className="text-[16px]">Vui lòng thử lại sau ít phút.</p>
      <Button variant="ghost" onClick={reset} className="self-start">
        Thử lại
      </Button>
    </div>
  );
}
