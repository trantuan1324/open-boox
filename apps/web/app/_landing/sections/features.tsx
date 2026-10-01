import type { PlanDto } from '@open-boox/shared';
import { CurtainLink } from '@/components/curtain/curtain-link';
import type { ComponentType } from 'react';
import { ArtCalendar, ArtStack, ArtSwap } from '../svg/illustrations';

type Feature = { line1: string; line2: string; body: string; tone: string; Art: ComponentType<{ className?: string }> };

function features(plans: PlanDto[]): Feature[] {
  const counts = plans.map((p) => p.maxBooks);
  const range = counts.length ? `${Math.min(...counts)}–${Math.max(...counts)}` : 'nhiều';
  return [
    {
      line1: 'Giữ nhiều cuốn',
      line2: 'cùng lúc',
      body: `Mỗi gói cho giữ ${range} cuốn cùng lúc. Đọc xong cuốn nào thì trả cuốn đó.`,
      tone: 'lilac',
      Art: ArtStack,
    },
    {
      line1: 'Không hạn trả',
      line2: 'đọc thong thả',
      body: 'Không có ngày phải trả. Cuốn sách ở với bạn tới khi bạn muốn đổi.',
      tone: 'blue',
      Art: ArtCalendar,
    },
    {
      line1: 'Đổi gói',
      line2: 'tức thì',
      body: 'Nâng cấp có hiệu lực ngay. Hạ gói hay huỷ gia hạn thì áp dụng từ kỳ sau.',
      tone: 'sunburst',
      Art: ArtSwap,
    },
  ];
}

// Section 4: zig-zag rows; char reveal on the heading, 3D reveal on the card ([SM §5.6], [SM §5.8]).
export function Features({ plans }: { plans: PlanDto[] }) {
  return (
    <section className="obx-sheet obx-features" aria-label="Vì sao Open Boox">
      {features(plans).map(({ line1, line2, body, tone, Art }, i) => (
        <article key={line1} className={`obx-feature${i % 2 ? ' obx-feature--flip' : ''}`}>
          <div className="obx-feature__text">
            <h2 className="obx-display obx-feature__title" data-anim-slant>
              {line1}
              <br />
              <em>{line2}</em>
            </h2>
            <p className="obx-body">{body}</p>
            <CurtainLink href="/plans" className="obx-btn obx-btn--dark">
              Xem các gói ↗
            </CurtainLink>
          </div>
          <div className="obx-feature__visual" data-card-reveal="wrap">
            <div className={`obx-card obx-card--${tone}`} data-card-reveal="card">
              <Art />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
