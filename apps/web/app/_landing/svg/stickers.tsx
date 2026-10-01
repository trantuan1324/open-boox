import type { CSSProperties, ReactNode } from 'react';

type StickerProps = { className?: string; style?: CSSProperties };

// Flat stickers with a heavy black outline, drawn for Open Boox (no third-party art).
function Sticker({ children, className = '', style }: StickerProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`obx-sticker ${className}`}
      style={style}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="#000"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function StickerBook(props: StickerProps) {
  return (
    <Sticker {...props}>
      <rect x="28" y="16" width="66" height="88" rx="8" fill="#ffd731" />
      <path d="M42 16v88" />
      <circle cx="60" cy="54" r="5" fill="#000" />
      <circle cx="80" cy="54" r="5" fill="#000" />
      <path d="M60 70q10 9 20 0" />
    </Sticker>
  );
}

export function StickerGlasses(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="36" cy="64" r="22" fill="#e9ccff" />
      <circle cx="84" cy="64" r="22" fill="#e9ccff" />
      <path d="M58 60q2-6 4 0M14 58 6 44M106 58l8-14" />
      <path d="M28 56q6-6 12 0M76 56q6-6 12 0" />
    </Sticker>
  );
}

export function StickerBookmark(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="M36 10h48v98L60 88l-24 20z" fill="#55db9c" />
      <path d="m60 32 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff" />
    </Sticker>
  );
}

export function StickerParcel(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="m16 42 44-22 44 22v50l-44 22-44-22z" fill="#4da2ff" />
      <path d="m16 42 44 22 44-22M60 64v50M38 31l44 22v14" />
    </Sticker>
  );
}

export function StickerCoin(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="60" cy="60" r="42" fill="#ffd731" />
      <circle cx="60" cy="60" r="30" />
      <path d="M66 40v34M56 50h16M66 62q-14-8-16 4t16 6" />
    </Sticker>
  );
}

export function StickerCheck(props: StickerProps) {
  return (
    <Sticker {...props}>
      <circle cx="60" cy="60" r="42" fill="#55db9c" />
      <path d="m40 62 14 14 28-30" strokeWidth={8} />
    </Sticker>
  );
}

export function StickerStar(props: StickerProps) {
  return (
    <Sticker {...props}>
      <path d="M60 8c6 38 14 46 52 52-38 6-46 14-52 52-6-38-14-46-52-52 38-6 46-14 52-52z" fill="#fb4903" />
    </Sticker>
  );
}

export const STICKERS = [StickerBook, StickerGlasses, StickerBookmark, StickerParcel, StickerCoin, StickerCheck];
