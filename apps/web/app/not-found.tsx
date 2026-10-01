import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="sheet mx-auto flex w-full max-w-xl flex-col gap-6 px-[20px] py-[48px] md:px-[32px] md:py-[72px]">
      <h1 className="text-[32px] font-bold uppercase">Không tìm thấy trang</h1>
      <Link href="/" className="text-[12px] font-bold uppercase tracking-[0.03em] underline">
        Về trang chủ
      </Link>
    </div>
  );
}
