'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { curtainStore } from './curtain-store';

type CurtainLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

// Plays the curtain before leaving the landing page. New-tab clicks (modifiers, middle button) and clicks already
// cancelled by the caller (e.g. the end of a carousel drag) behave like a plain link.
export function CurtainLink({ href, onClick, ...rest }: CurtainLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (curtainStore.intercept(href)) event.preventDefault();
  };
  return <Link {...rest} href={href} onClick={handleClick} />;
}
