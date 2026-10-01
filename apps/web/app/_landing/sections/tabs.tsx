'use client';

import { CurtainLink } from '@/components/curtain/curtain-link';
import { type KeyboardEvent, useRef, useState } from 'react';
import { FULL, Flip, REDUCE, ScrollTrigger, SplitText, gsap, useGSAP } from '../motion/gsap';
import { ArtBorrow, ArtBuy, ArtDeliver } from '../svg/illustrations';

const TABS = [
  {
    id: 'muon',
    label: 'Mượn',
    title: ['Mượn theo gói', 'trả khi xong'],
    body: 'Chọn gói, thêm sách vào giỏ mượn rồi xác nhận. Giữ tối đa số cuốn của gói, không hạn trả.',
    href: '/plans',
    link: 'Xem các gói',
    color: '#e9ccff',
    Art: ArtBorrow,
  },
  {
    id: 'mua',
    label: 'Mua',
    title: ['Mua đứt', 'giữ trên kệ'],
    body: 'Thích cuốn nào thì mua luôn. Thanh toán một lần, sách là của bạn.',
    href: '/books',
    link: 'Vào kho sách',
    color: '#ffd731',
    Art: ArtBuy,
  },
  {
    id: 'giao',
    label: 'Giao',
    title: ['Giao tận cửa', 'lấy tận nhà'],
    body: 'Đơn mua và sách mượn đều được giao tận nơi. Khi trả, chúng tôi đến tận nhà lấy lại.',
    href: '/account/orders',
    link: 'Theo dõi đơn',
    color: '#55db9c',
    Art: ArtDeliver,
  },
];

// Section 8 ([SM §5.11]): the black pill follows the active tab with Flip; the old panel fades out while the new
// one's title chars, text and art come in from 0.2s. Panels share one grid cell, so no height tween. Auto-advances
// to the second tab once when scrolled into view.
export function Tabs() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const previous = useRef(0);
  const flipState = useRef<Flip.FlipState | null>(null);
  const splits = useRef<SplitText[]>([]);
  const running = useRef<gsap.core.Timeline | null>(null);

  const select = (index: number) => {
    if (index === activeRef.current) return;
    flipState.current = Flip.getState(root.current!.querySelector('.obx-tabs__pill'));
    activeRef.current = index;
    setActive(index);
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(FULL, () => {
        splits.current = gsap.utils
          .toArray<HTMLElement>('.obx-tab-panel__title', root.current)
          .map((el) => SplitText.create(el, { type: 'words,chars' }));
        ScrollTrigger.create({
          trigger: root.current,
          start: 'center 75%',
          once: true,
          onEnter: () => {
            if (activeRef.current === 0) select(1);
          },
        });
        return () => {
          splits.current = [];
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  useGSAP(
    () => {
      const from = previous.current;
      previous.current = active;
      const state = flipState.current;
      flipState.current = null;
      if (from === active || window.matchMedia(REDUCE).matches) return;

      running.current?.progress(1);
      const panels = gsap.utils.toArray<HTMLElement>('.obx-tab-panel', root.current);
      const oldPanel = panels[from];
      const newPanel = panels[active];
      const find = (panel: HTMLElement, selector: string) => panel.querySelector<HTMLElement>(selector)!;

      if (state) {
        Flip.from(state, { targets: root.current!.querySelector('.obx-tabs__pill'), duration: 0.5, ease: 'slush' });
      }

      const tl = gsap.timeline({ defaults: { ease: 'slush', duration: 0.65 } });
      tl.set(oldPanel, { visibility: 'visible' }, 0)
        .set(newPanel, { zIndex: 1 }, 0)
        .set(oldPanel, { zIndex: 0 }, 0)
        .to(find(oldPanel, '.obx-tab-panel__text'), { autoAlpha: 0, yPercent: 10 }, 0)
        .to(find(oldPanel, '.obx-tab-panel__art'), { autoAlpha: 0, xPercent: -15 }, 0)
        .fromTo(
          find(newPanel, '.obx-tab-panel__visual'),
          { backgroundColor: TABS[from].color },
          { backgroundColor: TABS[active].color },
          0,
        )
        .set(find(newPanel, '.obx-tab-panel__text'), { autoAlpha: 0, yPercent: 0 }, 0)
        .set(find(newPanel, '.obx-tab-panel__text'), { autoAlpha: 1 }, 0.2)
        .fromTo(
          splits.current[active]?.chars ?? [],
          { x: '-0.25em', autoAlpha: 0 },
          { x: 0, autoAlpha: 1, ease: 'slush-bounce', stagger: { each: 0.015, from: 'end' } },
          0.2,
        )
        .fromTo(
          newPanel.querySelectorAll('.obx-tab-panel__body, .obx-tab-panel__link'),
          { x: '-3em', autoAlpha: 0 },
          { x: 0, autoAlpha: 1 },
          0.275,
        )
        .fromTo(
          find(newPanel, '.obx-tab-panel__art'),
          { xPercent: 0, yPercent: 10, autoAlpha: 0 },
          { xPercent: 0, yPercent: 0, autoAlpha: 1 },
          0.2,
        )
        .set(oldPanel, { clearProps: 'visibility' })
        .set([oldPanel, newPanel], { clearProps: 'zIndex' });
      running.current = tl;
    },
    { dependencies: [active], scope: root },
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
    const next = (activeRef.current + step) % TABS.length;
    select(next);
    root.current?.querySelector<HTMLButtonElement>(`#obx-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <section ref={root} className="obx-sheet obx-tabs" aria-labelledby="obx-tabs-title">
      <h2 id="obx-tabs-title" className="sr-only">
        Mượn, mua hay giao
      </h2>
      <div role="tablist" aria-label="Cách dùng Open Boox" className="obx-tabs__list" onKeyDown={onKeyDown}>
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            id={`obx-tab-${tab.id}`}
            type="button"
            role="tab"
            className="obx-tabs__tab"
            aria-selected={i === active}
            aria-controls={`obx-panel-${tab.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') select(i);
            }}
          >
            {i === active && <span className="obx-tabs__pill" data-flip-id="tab-pill" aria-hidden="true" />}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="obx-tabs__panels">
        {TABS.map((tab, i) => (
          <div
            key={tab.id}
            id={`obx-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`obx-tab-${tab.id}`}
            className="obx-tab-panel"
            data-active={i === active}
            inert={i !== active}
          >
            <div className="obx-tab-panel__visual" style={{ backgroundColor: tab.color }}>
              <tab.Art className="obx-tab-panel__art" />
            </div>
            <div className="obx-tab-panel__text">
              <h3 className="obx-display obx-tab-panel__title">
                {tab.title[0]}
                <br />
                <em>{tab.title[1]}</em>
              </h3>
              <p className="obx-body obx-tab-panel__body">{tab.body}</p>
              <CurtainLink href={tab.href} className="obx-btn obx-btn--dark obx-tab-panel__link">
                {tab.link} ↗
              </CurtainLink>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
