'use client';

import { BORROW_CART_KEY, parseBorrowCart } from './borrow-cart';
import { useStoredList } from './use-stored-list';

export function useBorrowCart() {
  return useStoredList(BORROW_CART_KEY, parseBorrowCart);
}
