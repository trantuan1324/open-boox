import type { ReactNode } from 'react';

type ArtProps = { className?: string };

function Art({ children, className = '' }: ArtProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={`obx-art ${className}`}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="#000"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// Giữ nhiều cuốn cùng lúc
export function ArtStack(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="70" y="160" width="180" height="40" rx="8" fill="#ffd731" />
      <rect x="86" y="120" width="160" height="40" rx="8" fill="#fb4903" />
      <rect x="60" y="80" width="170" height="40" rx="8" fill="#55db9c" />
      <rect x="96" y="40" width="130" height="40" rx="8" fill="#fff" />
      <path d="M90 80v40M112 120v40M96 160v40M120 40v40" />
    </Art>
  );
}

// Không hạn trả
export function ArtCalendar(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="80" y="50" width="160" height="150" rx="16" fill="#fff" />
      <path d="M80 92h160M118 34v32M202 34v32" />
      <path d="M130 146c0-16 22-16 30 0s30 16 30 0-22-16-30 0-30 16-30 0z" strokeWidth={7} />
    </Art>
  );
}

// Đổi gói tức thì
export function ArtSwap(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="50" y="64" width="96" height="124" rx="14" fill="#e9ccff" />
      <rect x="174" y="52" width="96" height="124" rx="14" fill="#55db9c" />
      <path d="M118 214c44 18 96 10 124-28M242 186v-26M242 186h-26" />
      <path d="M202 30c-44-18-96-10-124 28M78 58v26M78 58h26" />
    </Art>
  );
}

// Tab "Mượn"
export function ArtBorrow(props: ArtProps) {
  return (
    <Art {...props}>
      <rect x="96" y="40" width="110" height="150" rx="10" fill="#ffd731" />
      <path d="M116 40v150" />
      <path d="M236 92c34 18 34 62 0 80M236 172h22M236 172v-22" strokeWidth={6} />
    </Art>
  );
}

// Tab "Mua"
export function ArtBuy(props: ArtProps) {
  return (
    <Art {...props}>
      <path d="M86 92h148l-12 116H98z" fill="#fff" />
      <path d="M126 92V76a34 34 0 0 1 68 0v16" />
      <rect x="128" y="120" width="64" height="62" rx="6" fill="#fb4903" />
      <path d="M142 120v62" />
    </Art>
  );
}

// Tab "Giao"
export function ArtDeliver(props: ArtProps) {
  return (
    <Art {...props}>
      <path d="M60 84h130v96H60z" fill="#4da2ff" />
      <path d="M190 112h44l26 32v36h-70z" fill="#fff" />
      <circle cx="98" cy="186" r="16" fill="#fff" />
      <circle cx="226" cy="186" r="16" fill="#fff" />
      <path d="M90 84v32h40V84" />
    </Art>
  );
}
