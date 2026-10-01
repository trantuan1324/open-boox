import { CurtainLink } from '@/components/curtain/curtain-link';
import { Marquee } from '../ui/marquee';

const LINKS = [
  { href: '/books', label: 'Sách' },
  { href: '/plans', label: 'Gói mượn' },
  { href: '/account/orders', label: 'Đơn hàng' },
  { href: '/account', label: 'Tài khoản' },
];

const WORDS = ['Mượn', 'Mua', 'Giao', 'Đọc'];

// Section 13: tile marquee + indigo badge, 2×2 link tiles, mint card with the slogan.
export function Footer() {
  return (
    <footer className="obx-footer">
      <div className="obx-footer__band">
        <Marquee speed={20} repeat={2}>
          {WORDS.map((word, i) => (
            <span key={word} className={`obx-tile obx-tile--${i % 2 ? 'blue' : 'ember'}`}>
              <span className={`obx-display obx-tile__text${i % 2 ? ' obx-italic' : ''}`}>{word}</span>
            </span>
          ))}
        </Marquee>
        <span className="obx-footer__badge" aria-hidden="true">
          OB
        </span>
      </div>
      <div className="obx-footer__grid">
        <nav className="obx-footer__tiles" aria-label="Chân trang">
          {LINKS.map((link) => (
            <CurtainLink key={link.href} href={link.href} className="obx-footer__tile">
              <span aria-hidden="true">↗</span>
              <span className="obx-display">{link.label}</span>
            </CurtainLink>
          ))}
        </nav>
        <div className="obx-footer__card">
          <p className="obx-display obx-footer__slogan" data-anim-slant>
            Chọn gói.
            <br />
            <em>Rồi cứ thế mà đọc.</em>
          </p>
          <div className="obx-footer__meta">
            <span>© 2026 Open Boox</span>
            <span>Mượn · Mua · Giao tận nơi</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
