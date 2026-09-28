import { expect, test } from '@playwright/test';
import { deliverShipment, loginAs, openOnlyShipment } from './helpers';

test('subscribe, borrow, admin delivers, return, admin picks it up', async ({ browser }) => {
  const customer = await loginAs(browser, 'CUSTOMER');
  await customer.goto('/plans');
  await customer.getByRole('listitem').filter({ hasText: 'Basic' }).getByRole('button', { name: 'Đăng ký' }).click();
  await customer.waitForURL(/\/checkout\/mock\//);
  await customer.getByRole('button', { name: 'Thanh toán thành công' }).click();
  await customer.waitForURL((url) => url.pathname === '/account/subscription');
  await expect(customer.getByText('Đang hoạt động', { exact: true })).toBeVisible();

  await customer.goto('/books/nha-gia-kim');
  await customer.getByRole('button', { name: 'Thêm vào giỏ mượn' }).click();
  await customer.goto('/borrow/confirm');
  await customer.getByRole('button', { name: 'Xác nhận mượn' }).click();
  await customer.waitForURL((url) => url.pathname === '/account/loans');
  await expect(customer.getByText('Chờ giao', { exact: true })).toBeVisible();

  const admin = await loginAs(browser, 'ADMIN');
  await openOnlyShipment(admin, 'LOAN_DELIVERY');
  await deliverShipment(admin);

  await customer.reload();
  await expect(customer.getByText('Đang mượn', { exact: true })).toBeVisible();
  await customer.getByRole('checkbox', { name: 'Chọn trả Nhà giả kim' }).check();
  await customer.getByRole('button', { name: 'Trả sách (1)' }).click();
  await expect(customer.getByText('Chờ thu hồi', { exact: true })).toBeVisible();

  await openOnlyShipment(admin, 'LOAN_PICKUP');
  await deliverShipment(admin);

  await customer.reload();
  await expect(customer.getByText('Đã trả', { exact: true })).toBeVisible();
});
