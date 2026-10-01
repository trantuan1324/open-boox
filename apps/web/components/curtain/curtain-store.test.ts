import { describe, expect, it, vi } from 'vitest';
import { createCurtainStore } from './curtain-store';

describe('curtain store', () => {
  it('lets the link navigate normally when no overlay is listening', () => {
    const store = createCurtainStore();
    expect(store.intercept('/plans')).toBe(false);
    expect(store.get()).toBe('idle');
  });

  it('starts covering and tells the overlay where to go', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.intercept('/plans')).toBe(true);
    expect(store.get()).toBe('covering');
    expect(listener).toHaveBeenCalledWith('covering', '/plans');
  });

  it('swallows clicks while a curtain is running', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.intercept('/plans');
    expect(store.intercept('/books')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reveals only once, and only after covering finished', () => {
    const store = createCurtainStore();
    store.subscribe(() => {});
    expect(store.beginReveal()).toBe(false);
    store.intercept('/plans');
    expect(store.beginReveal()).toBe(false);
    store.markCovered();
    expect(store.get()).toBe('covered');
    expect(store.beginReveal()).toBe(true);
    expect(store.beginReveal()).toBe(false);
    store.finish();
    expect(store.get()).toBe('idle');
  });

  it('stops notifying after unsubscribe', () => {
    const store = createCurtainStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    expect(store.intercept('/plans')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
