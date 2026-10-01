import type { PlanDto } from '@open-boox/shared';
import { CurtainLink } from '@/components/curtain/curtain-link';
import { formatVnd } from '@/lib/format';
import { cycleColor } from '../data';
import { StickerBook, StickerCoin, StickerStar } from '../svg/stickers';

const PLAN_PALETTE = ['#ffd731', '#e9ccff', '#4da2ff'];
const PLAN_STICKERS = [StickerBook, StickerCoin, StickerStar];

// Section 10: the three plans in place of Slush's persona cards.
export function Plans({ plans }: { plans: PlanDto[] }) {
  return (
    <section className="obx-sheet obx-plans" aria-labelledby="obx-plans-title">
      <h2 id="obx-plans-title" className="obx-display obx-plans__title" data-anim-slant>
        Một gói,
        <br />
        <em>cả thư viện</em>
      </h2>
      <div className="obx-plans__grid" data-card-reveal="wrap">
        {plans.map((plan, i) => {
          const Sticker = PLAN_STICKERS[i % PLAN_STICKERS.length];
          return (
            <article
              key={plan.code}
              className="obx-plan"
              style={{ background: cycleColor(i, PLAN_PALETTE) }}
              data-card-reveal="card"
            >
              <h3 className="obx-plan__name">{plan.name}</h3>
              <p className="obx-display obx-plan__books">
                {plan.maxBooks} cuốn
                <br />
                <em>cùng lúc</em>
              </p>
              <p className="obx-plan__price">
                {formatVnd(plan.monthlyPrice)} <span>/ 30 ngày</span>
              </p>
              <CurtainLink href="/plans" className="obx-btn obx-btn--dark obx-btn--sm">
                Chọn {plan.name} ↗
              </CurtainLink>
              <Sticker className="obx-plan__sticker" />
            </article>
          );
        })}
      </div>
    </section>
  );
}
