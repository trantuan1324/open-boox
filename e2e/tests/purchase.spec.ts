import { expect, test } from '@playwright/test';
import { deliverShipment, loginAs, openOnlyShipment } from './helpers';

test('buy a book, pay with the mock gateway, admin delivers it', async ({ browser }) => {
  const customer = await loginAs(browser, 'CUSTOMER');
  await customer.goto('/books/rung-na-uy');
  await customer.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();

  await customer.goto('/checkout');
  // Enabled once the quote for the default address arrives.
  await customer.getByRole('button', { name: 'Đặt hàng' }).click();
  await customer.waitForURL(/\/checkout\/mock\//);
  await customer.getByRole('button', { name: 'Thanh toán thành công' }).click();
  await customer.waitForURL(/\/account\/orders\/[^/]+$/);
  const orderUrl = customer.url();
  await expect(customer.getByText('Đã thanh toán', { exact: true }).first()).toBeVisible();

  const admin = await loginAs(browser, 'ADMIN');
  await openOnlyShipment(admin, 'ORDER_DELIVERY');
  await deliverShipment(admin);

  await customer.goto(orderUrl);
  await expect(customer.getByText('Đã giao', { exact: true }).first()).toBeVisible();
  await expect(customer.getByText('Đã thanh toán', { exact: true })).toHaveCount(0);
});
