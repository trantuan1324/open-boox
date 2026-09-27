'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CART_KEY, type CartLine, parseCart } from './cart';

const CHANGE_EVENT = 'ob-cart-change';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_KEY);
  } catch {
    return null; // storage blocked: behave as an empty cart
  }
}

// undefined on the server and during hydration means "not loaded yet", distinct from an empty cart.
const serverSnapshot = (): undefined => undefined;

export function useCart() {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, serverSnapshot);
  const lines = useMemo(() => parseCart(raw ?? null), [raw]);

  const update = useCallback((change: (lines: CartLine[]) => CartLine[]) => {
    const next = change(parseCart(readRaw()));
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      // storage blocked or full: nothing to persist to
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const clear = useCallback(() => update(() => []), [update]);

  return { lines, ready: raw !== undefined, update, clear };
}
