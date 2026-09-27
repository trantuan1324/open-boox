import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/error';
import { describeQuoteError } from './quote-errors';

describe('describeQuoteError', () => {
  it('maps OUT_OF_STOCK fields to cart line indexes', () => {
    const error = new ApiError(409, 'OUT_OF_STOCK', 'x', { 'items.1.quantity': 'Chỉ còn 1 cuốn' });
    expect(describeQuoteError(error)).toEqual({
      message: 'Một số sách không đủ hàng, vui lòng giảm số lượng trong giỏ.',
      lines: { 1: 'Chỉ còn 1 cuốn' },
    });
  });

  it('explains books no longer for sale', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', { 'items.0.bookId': 'Sách không tồn tại hoặc không còn bán' });
    expect(describeQuoteError(error)).toEqual({
      message: 'Một số sách trong giỏ không còn bán, vui lòng xóa khỏi giỏ.',
      lines: { 0: 'Sách không tồn tại hoặc không còn bán' },
    });
  });

  it('falls back to the generic message for other errors', () => {
    expect(describeQuoteError(new ApiError(404, 'NOT_FOUND', 'x'))).toEqual({ message: 'Không tìm thấy dữ liệu.', lines: {} });
    expect(describeQuoteError(new Error('network'))).toEqual({ message: 'Đã có lỗi xảy ra, vui lòng thử lại.', lines: {} });
  });
});
