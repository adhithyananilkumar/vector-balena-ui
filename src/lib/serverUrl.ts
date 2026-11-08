import environment from './reactAppEnv';

/**
 * Where the Vector server lives. REACT_APP_VECTOR_SERVER_URL is set when the UI is hosted apart from the
 * server (for example on Vercel); left empty, requests go to the page's own origin, which is how the dev
 * proxy in vite.config.mts works.
 */
export const serverBase = (): string => (environment.REACT_APP_VECTOR_SERVER_URL ?? '').trim().replace(/\/+$/, '');

/** Turns a root-relative server path ("/admin-db/user") into the URL to request. */
export const serverUrl = (path: string): string => `${serverBase()}${path}`;

/** WebSocket address for a server path, following the server URL (or the page's origin when unset). */
export const serverWebSocketUrl = (
  path: string,
  location?: Pick<Location, 'protocol' | 'host'>,
): string => {
  const base = serverBase();
  if (base) return `${base.replace(/^http/i, 'ws')}${path}`;
  const origin = location ?? window.location;
  return `${origin.protocol === 'https:' ? 'wss:' : 'ws:'}//${origin.host}${path}`;
};
