import Link from 'next/link';
import { StickerBook } from '@/app/_landing/svg/stickers';

export default function NotFound() {
  return (
    <div className="sheet sheet-pad relative flex w-full flex-col gap-[24px]">
      <StickerBook className="absolute top-[24px] right-[24px] w-[72px] -rotate-[8deg] md:w-[110px]" />
      <h1 className="display text-[clamp(48px,8vw,112px)]">
        Không tìm thấy
        <br />
        <em>trang này</em>
      </h1>
      <p className="text-[16px]">Đường dẫn không tồn tại hoặc cuốn sách đã được dời đi.</p>
      <Link
        href="/"
        className="self-start rounded-full border border-ink bg-paper px-[24px] py-[14px] text-[13px] font-bold uppercase leading-none tracking-[0.03em] text-ink transition-all duration-500 ease-bounce hover:-translate-y-[2px] hover:bg-ink hover:text-paper"
      >
        Về trang chủ ↗
      </Link>
    </div>
  );
}
