import type { ShipmentStatus, ShipmentType } from '@open-boox/shared';

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
  FAILED: 'Giao thất bại',
};

export const SHIPMENT_TYPE_LABEL: Record<ShipmentType, string> = {
  ORDER_DELIVERY: 'Giao đơn mua',
  LOAN_DELIVERY: 'Giao sách mượn',
  LOAN_PICKUP: 'Thu hồi sách mượn',
};
