import { type ErrorCode, isErrorCode } from '@open-boox/shared';

// spec §6.2c: an admin action's 409 re-renders the page, which may drop the form that would have shown the
// message. The code rides in ?error= and the server page shows it outside the form. Only known codes are shown.
export function errorFromParam(value: string | string[] | undefined): ErrorCode | null {
  const first = Array.isArray(value) ? value[0] : value;
  return isErrorCode(first) ? first : null;
}

export function withError(path: string, code: ErrorCode): string {
  return `${path}?error=${code}`;
}
