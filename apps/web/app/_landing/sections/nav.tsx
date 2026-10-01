'use client';

import type { PublicUser } from '@open-boox/shared';
import Link from 'next/link';
import { CurtainLink } from '@/components/curtain/curtain-link';
import { useRef, useState } from 'react';
import { CartLink } from '@/components/cart/cart-link';
import { FULL, REDUCE, gsap, useGSAP } from '../motion/gsap';

const DESKTOP = '(min-width: 992px)';
const PILL = 'obx-btn obx-btn--sm';

// [SM §5.2] Desktop: pills hide on scroll down, return on scroll up; hovering "+" or tabbing into the nav reveals
// them. Below 992px the pills live in a menu opened by "+".
export function Nav({ user }: { user: PublicUser | null }) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useGSAP(() => {
    const header = root.current!;
    const items = gsap.utils.toArray<HTMLElement>('.obx-nav__li', header);
    const plus = header.querySelector<HTMLElement>('.obx-nav__plus')!;
    const mm = gsap.matchMedia();

    mm.add(DESKTOP, () => {
      setOpen(false);
      gsap.set(items, { clearProps: 'transform' }); // drop leftovers from the mobile menu animation
    });

    mm.add(`${DESKTOP} and ${FULL}`, () => {
      let shown = true;
      let lastY = window.scrollY;
      const show = (next: boolean) => {
        if (next === shown) return;
        shown = next;
        gsap.to(items, {
          yPercent: next ? 0 : -300,
          duration: 0.75,
          ease: 'slush-bounce',
          stagger: { each: 0.03, from: next ? 'end' : 'start' },
          overwrite: true,
        });
      };
      const onScroll = () => {
        const y = window.scrollY;
        if (Math.abs(y - lastY) < 10) return;
        show(y <= 50 || y < lastY);
        lastY = y;
      };
      const reveal = () => show(true);
      const leave = () => {
        if (window.scrollY > 50 && !header.contains(document.activeElement)) show(false);
      };

      window.addEventListener('scroll', onScroll, { passive: true });
      plus.addEventListener('pointerenter', reveal);
      header.addEventListener('focusin', reveal);
      header.addEventListener('pointerleave', leave);
      return () => {
        window.removeEventListener('scroll', onScroll);
        plus.removeEventListener('pointerenter', reveal);
        header.removeEventListener('focusin', reveal);
        header.removeEventListener('pointerleave', leave);
      };
    });

    return () => mm.revert();
  });

  // Mobile menu: pills slide in from the right, last one first.
  useGSAP(
    () => {
      if (!open || window.matchMedia(DESKTOP).matches || window.matchMedia(REDUCE).matches) return;
      gsap.fromTo(
        '.obx-nav__li',
        { xPercent: 300 },
        { xPercent: 0, duration: 0.75, ease: 'slush-bounce', stagger: { each: 0.03, from: 'end' } },
      );
    },
    { dependencies: [open], scope: root },
  );

  const toggle = () => {
    if (window.matchMedia(DESKTOP).matches) {
      root.current?.querySelector<HTMLAnchorElement>('.obx-nav__li a')?.focus();
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <header
      ref={root}
      className="obx-nav"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>('.obx-nav__plus')?.focus();
        }
      }}
    >
      <Link href="/" className="obx-nav__logo" aria-label="Open Boox — trang chủ">
        OB
      </Link>
      <nav className="obx-nav__right" aria-label="Chính">
        <button
          type="button"
          className="obx-nav__plus"
          aria-expanded={open}
          aria-controls="obx-nav-pills"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={toggle}
        >
          <span className="obx-nav__plus-h" />
          <span className="obx-nav__plus-v" />
        </button>
        <ul id="obx-nav-pills" className="obx-nav__pills" data-open={open} onClick={() => setOpen(false)}>
          <li className="obx-nav__li">
            <CurtainLink href="/books" className={PILL}>
              Sách
            </CurtainLink>
          </li>
          <li className="obx-nav__li">
            <CurtainLink href="/plans" className={PILL}>
              Gói mượn
            </CurtainLink>
          </li>
          <li className="obx-nav__li">
            <a href="#cach-hoat-dong" className={PILL}>
              Cách hoạt động
            </a>
          </li>
          {user?.role === 'ADMIN' && (
            <li className="obx-nav__li">
              <CurtainLink href="/admin" className={PILL}>
                Quản trị
              </CurtainLink>
            </li>
          )}
          {!user && (
            <li className="obx-nav__li">
              <CurtainLink href="/login" className={PILL}>
                Đăng nhập
              </CurtainLink>
            </li>
          )}
          <li className="obx-nav__li">
            <CartLink />
          </li>
        </ul>
        {user ? (
          <CurtainLink href="/account" className={`${PILL} obx-btn--dark`}>
            Tài khoản
          </CurtainLink>
        ) : (
          <CurtainLink href="/register" className={`${PILL} obx-btn--dark`}>
            Đăng ký ↗
          </CurtainLink>
        )}
      </nav>
    </header>
  );
}
