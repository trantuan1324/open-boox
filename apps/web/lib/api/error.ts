import { type ApiErrorBody, type ErrorCode, isErrorCode } from '@open-boox/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    try {
      const body = (await res.json()) as Partial<ApiErrorBody>;
      if (isErrorCode(body.code)) {
        return new ApiError(res.status, body.code, body.message ?? body.code, body.fields);
      }
    } catch {
      // Body was not JSON (e.g. a proxy error page); fall through.
    }
    return new ApiError(res.status, res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR', res.statusText);
  }
}
