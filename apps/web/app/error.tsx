'use client';

import { StickerStar } from '@/app/_landing/svg/stickers';
import { Button } from '@/components/ui/button';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="sheet sheet-pad relative flex w-full flex-col gap-[24px]">
      <StickerStar className="absolute top-[24px] right-[24px] w-[72px] rotate-[12deg] md:w-[110px]" />
      <h1 className="display text-[clamp(48px,8vw,112px)]">
        Ối,
        <br />
        <em>có lỗi rồi!</em>
      </h1>
      <p className="text-[16px]">Vui lòng thử lại sau ít phút.</p>
      <Button variant="ghost" onClick={reset} className="self-start">
        Thử lại
      </Button>
    </div>
  );
}
