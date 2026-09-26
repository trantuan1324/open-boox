import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-[24px] font-medium uppercase">Không tìm thấy trang</h1>
      <Link href="/" className="text-[12px] font-medium uppercase underline">
        Về trang chủ
      </Link>
    </div>
  );
}
