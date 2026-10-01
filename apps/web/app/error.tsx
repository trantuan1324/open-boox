'use client';

import { Button } from '@/components/ui/button';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="sheet mx-auto flex w-full max-w-xl flex-col gap-6 px-[20px] py-[48px] md:px-[32px] md:py-[72px]">
      <h1 className="text-[32px] font-bold uppercase">Đã có lỗi xảy ra</h1>
      <p className="text-[16px]">Vui lòng thử lại sau ít phút.</p>
      <Button variant="ghost" onClick={reset} className="self-start">
        Thử lại
      </Button>
    </div>
  );
}
