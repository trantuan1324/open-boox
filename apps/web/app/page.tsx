const SERVICES = [
  { title: 'Mượn theo gói', body: 'Đăng ký một gói, giữ nhiều cuốn cùng lúc, trả cuốn này để mượn cuốn khác.' },
  { title: 'Mua sách', body: 'Chọn sách, thanh toán một lần, sách là của bạn.' },
  { title: 'Giao tận nơi', body: 'Chúng tôi giao sách đến cửa và đến lấy lại khi bạn trả.' },
];

export default function HomePage() {
  return (
    <section className="flex min-h-[calc(100vh-61px)] flex-col justify-between gap-12 px-6 py-12">
      <div className="flex flex-col gap-4">
        <p className="text-[12px] font-medium uppercase">Đọc nhiều hơn, sở hữu ít hơn.</p>
        <p className="text-[51px] font-medium uppercase leading-[0.9]">Open Boox</p>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {SERVICES.map((s) => (
          <li key={s.title} className="flex flex-col gap-3 border-t border-dashed border-cork-border pt-4">
            <h2 className="text-[24px] font-medium uppercase leading-[1.09]">{s.title}</h2>
            <p className="text-[18px] leading-[1.26]">{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
