export type CurtainState = 'idle' | 'covering' | 'covered' | 'revealing';
type Listener = (state: CurtainState, href: string | null) => void;

// idle → covering (link clicked) → covered (panels cover the screen, router.push sent)
// → revealing (route changed or 3s timeout) → idle.
export function createCurtainStore() {
  let state: CurtainState = 'idle';
  let href: string | null = null;
  const listeners = new Set<Listener>();

  const set = (next: CurtainState) => {
    state = next;
    listeners.forEach((listener) => listener(state, href));
  };

  return {
    get: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** true = the click is handled here (preventDefault); false = navigate normally. */
    intercept(target: string): boolean {
      if (!listeners.size) return false;
      if (state === 'revealing') return false;
      if (state !== 'idle') return true;
      href = target;
      set('covering');
      return true;
    },
    markCovered() {
      if (state === 'covering') set('covered');
    },
    beginReveal(): boolean {
      if (state !== 'covered') return false;
      set('revealing');
      return true;
    },
    finish() {
      href = null;
      set('idle');
    },
  };
}

export const curtainStore = createCurtainStore();
