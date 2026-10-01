import type { PlanDto } from '@open-boox/shared';
import { formatVnd } from '@/lib/format';
import { cheapestPlanPrice } from '../data';
import { Marquee } from '../ui/marquee';

export function Banner({ plans }: { plans: PlanDto[] }) {
  const price = cheapestPlanPrice(plans);
  const items = [
    ...(price === null ? [] : [`Gói mượn từ ${formatVnd(price)}/30 ngày`]),
    'Giao & nhận sách tận nhà',
    'Trả cuốn này, mượn cuốn khác',
  ];
  return (
    <div className="obx-banner">
      <Marquee speed={25} repeat={3} label="Thông báo">
        {items.map((text) => (
          <span key={text} className="obx-banner__item">
            {text}
            <span aria-hidden="true">✦</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
