import { SHIPPING_FEES, WAREHOUSE_PROVINCE } from '@open-boox/shared';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';

// Rules from builder/spec/app_design.md only; fees come from the shared constants so they cannot drift.
const FAQ = [
  {
    q: 'Phí giao bao nhiêu?',
    a: `Đơn mua sách tính phí giao theo địa chỉ nhận: ${WAREHOUSE_PROVINCE} ${formatVnd(SHIPPING_FEES.INNER)}, các tỉnh khác ${formatVnd(SHIPPING_FEES.OUTER)}.`,
  },
  {
    q: 'Có hạn trả sách không?',
    a: 'Không. Bạn giữ tối đa số cuốn của gói và trả khi đọc xong; trả cuốn nào thì có chỗ mượn cuốn khác.',
  },
  {
    q: 'Đổi hoặc huỷ gói thế nào?',
    a: 'Nâng cấp có hiệu lực ngay, giá mới tính từ lần gia hạn kế tiếp. Hạ gói áp dụng từ kỳ sau. Huỷ gia hạn thì gói vẫn dùng đến hết kỳ, và bạn có thể bật lại trước khi kỳ kết thúc.',
  },
  {
    q: 'Gói hết hạn thì sách đang mượn sao?',
    a: 'Bạn không mượn thêm được, nhưng vẫn trả được những cuốn đang giữ.',
  },
];

// Section 12: sign-up card + FAQ in place of Slush's newsletter and support cards.
export function JoinFaq({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="obx-sheet obx-sheet--frame obx-join" aria-label="Bắt đầu và câu hỏi thường gặp">
      <div className="obx-join__card">
        <h2 className="obx-display obx-join__title" data-anim-slant>
          {signedIn ? 'Vào tài khoản' : 'Tạo tài khoản'}
          <br />
          <em>{signedIn ? 'xem sách đang giữ' : 'mượn cuốn đầu tiên'}</em>
        </h2>
        <Link href={signedIn ? '/account' : '/register'} className="obx-btn obx-btn--dark">
          {signedIn ? 'Tài khoản ↗' : 'Đăng ký ↗'}
        </Link>
      </div>
      <div className="obx-join__card">
        <h2 className="obx-display obx-join__title" data-anim-slant>
          Hỏi nhanh
          <br />
          <em>đáp gọn</em>
        </h2>
        <div className="obx-faq">
          {FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p className="obx-body">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
