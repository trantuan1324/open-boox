'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const CHANGE_EVENT = 'ob-cart-change';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked: behave as an empty list
  }
}

// undefined on the server and during hydration means "not loaded yet", distinct from an empty list.
const serverSnapshot = (): undefined => undefined;

// A list kept in localStorage and synced across tabs; `parse` turns anything unreadable into [].
export function useStoredList<T>(key: string, parse: (raw: string | null) => T[]) {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, () => readRaw(key), serverSnapshot);
  const lines = useMemo(() => parse(raw ?? null), [raw, parse]);

  const update = useCallback(
    (change: (lines: T[]) => T[]) => {
      const next = change(parse(readRaw(key)));
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage blocked or full: nothing to persist to
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, parse],
  );
  const clear = useCallback(() => update(() => []), [update]);

  return { lines, ready: raw !== undefined, update, clear };
}
