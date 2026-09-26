import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Open Boox',
  description: 'Mượn sách theo gói, mua sách và giao tận nơi.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
