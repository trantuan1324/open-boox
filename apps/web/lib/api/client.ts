import { ApiError } from './error';

const JSON_HEADERS = { 'content-type': 'application/json' };

interface Options {
  method?: string;
  body?: unknown;
}

function send(path: string, { method = 'GET', body }: Options): Promise<Response> {
  const payload = body !== undefined ? JSON.stringify(body) : method === 'GET' ? undefined : '{}';
  return fetch(`/api${path}`, { method, headers: JSON_HEADERS, body: payload, credentials: 'same-origin' });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiClient<T>(path: string, options: Options = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status !== 401 || path.startsWith('/auth/')) return parse<T>(res);

  const refreshed = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: '{}',
    credentials: 'same-origin',
  });
  if (refreshed.ok) return parse<T>(await send(path, options));

  window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  throw await ApiError.fromResponse(res);
}
