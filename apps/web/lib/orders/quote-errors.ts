import { ApiError } from '../api/error';
import { messageFor } from '../errors/messages';

export interface QuoteProblem {
  message: string;
  lines: Record<number, string>;
}

// The API names problem lines as items.<index>.<field>; the index is the cart line's position.
export function describeQuoteError(error: unknown): QuoteProblem {
  if (!(error instanceof ApiError)) return { message: messageFor('INTERNAL_ERROR'), lines: {} };
  const lines: Record<number, string> = {};
  for (const [key, message] of Object.entries(error.fields ?? {})) {
    const match = /^items\.(\d+)\./.exec(key);
    if (match) lines[Number(match[1])] = message;
  }
  if (error.code === 'OUT_OF_STOCK') {
    return { message: 'Một số sách không đủ hàng, vui lòng giảm số lượng trong giỏ.', lines };
  }
  if (Object.keys(lines).length > 0) {
    return { message: 'Một số sách trong giỏ không còn bán, vui lòng xóa khỏi giỏ.', lines };
  }
  return { message: messageFor(error.code), lines };
}
