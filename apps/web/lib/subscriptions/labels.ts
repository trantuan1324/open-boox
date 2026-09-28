import type { SubscriptionStatus } from '@open-boox/shared';

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  ACTIVE: 'Đang hoạt động',
  EXPIRED: 'Đã hết hạn',
  CANCELLED: 'Đã hủy',
};
