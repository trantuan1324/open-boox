'use client';

import Image from 'next/image';
import { useState } from 'react';
import { isOptimizedCoverHost } from '@/lib/books/cover';

export function BookCover({ src, title, sizes }: { src: string | null; title: string; sizes: string }) {
  // Remember which src failed, so a new src (component reused across book pages) gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[12px] bg-bark-brown">
      {src && !failed ? (
        <Image
          src={src}
          alt={`Bìa sách ${title}`}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized={!isOptimizedCoverHost(src)}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="flex h-full items-end p-[12px]">
          <span className="text-[14px] font-medium uppercase leading-[1.1]">{title}</span>
        </div>
      )}
    </div>
  );
}
