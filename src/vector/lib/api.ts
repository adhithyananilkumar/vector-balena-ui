import { serverUrl } from '../../lib/serverUrl';
/** Calls the Vector UI server as the signed-in user and returns the parsed JSON (or nothing for 204). */
export const authFetch = async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
  let token = '';
  try {
    token = window.localStorage.getItem('auth') ?? '';
  } catch {
    // storage blocked: the request will be rejected with a normal 401
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(serverUrl(path), { ...init, headers });
  if (!response.ok) {
    let message = `The server answered HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // not JSON: keep the generic message
    }
    throw new Error(message);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
};

export const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
};
