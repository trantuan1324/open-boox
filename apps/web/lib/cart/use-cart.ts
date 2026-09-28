'use client';

import { CART_KEY, parseCart } from './cart';
import { useStoredList } from './use-stored-list';

export function useCart() {
  return useStoredList(CART_KEY, parseCart);
}
