import type { LoanStatus } from '@open-boox/shared';

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  REQUESTED: 'Chờ giao',
  ACTIVE: 'Đang mượn',
  RETURN_REQUESTED: 'Chờ thu hồi',
  RETURNED: 'Đã trả',
  CANCELLED: 'Đã hủy',
};
