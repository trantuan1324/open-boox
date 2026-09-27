import type { ErrorCode } from '@open-boox/shared';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.',
  UNAUTHENTICATED: 'Bạn cần đăng nhập để tiếp tục.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  LOAN_LIMIT_EXCEEDED: 'Bạn đã đạt số sách tối đa của gói.',
  OUT_OF_STOCK: 'Sách đã hết hàng.',
  NO_COPY_AVAILABLE: 'Hiện không còn bản sách để cho mượn.',
  SUBSCRIPTION_INACTIVE: 'Gói đăng ký chưa kích hoạt hoặc đã hết hạn.',
  SUBSCRIPTION_ALREADY_EXISTS: 'Bạn đã có gói đang hoạt động hoặc đang chờ thanh toán.',
  ORDER_NOT_CANCELLABLE: 'Đơn hàng không thể hủy ở trạng thái hiện tại.',
  INVALID_SHIPMENT_TRANSITION: 'Không thể chuyển sang trạng thái giao hàng này.',
  SHIPMENT_ALREADY_RETRIED: 'Lần giao này đã được tạo lại trước đó.',
  LOAN_NOT_RETURNABLE: 'Sách này không ở trạng thái có thể trả.',
  INVALID_COPY_STATE: 'Bản sách không ở trạng thái cho phép thao tác này.',
  DUPLICATE: 'Dữ liệu đã tồn tại.',
  IN_USE: 'Dữ liệu đã phát sinh giao dịch, không thể xóa.',
  UNSUPPORTED_MEDIA_TYPE: 'Định dạng yêu cầu không được hỗ trợ.',
  TOO_MANY_REQUESTS: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.',
  INTERNAL_ERROR: 'Đã có lỗi xảy ra, vui lòng thử lại.',
};

export function messageFor(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}
