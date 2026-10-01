import type { Metadata } from 'next';
import { Barlow_Condensed, Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import { HeaderGate } from './header-gate';
import { CurtainOverlay } from '@/components/curtain/curtain-overlay';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const barlow = Barlow_Condensed({
  subsets: ['latin', 'vietnamese'],
  weight: '800',
  style: ['normal', 'italic'],
  variable: '--font-barlow',
  display: 'swap',
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Open Boox',
  description: 'Mượn sách theo gói, mua sách và giao tận nơi.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${barlow.variable} ${beVietnam.variable}`}>
      <body className="flex min-h-screen flex-col gap-[8px] bg-ink px-[8px] pb-[8px] antialiased md:gap-[12px] md:px-[12px] md:pb-[12px]">
        <HeaderGate>
          <SiteHeader />
        </HeaderGate>
        <main className="flex flex-1 flex-col gap-[8px] md:gap-[12px]">{children}</main>
        <HeaderGate>
          <SiteFooter />
        </HeaderGate>
        <CurtainOverlay />
      </body>
    </html>
  );
}
