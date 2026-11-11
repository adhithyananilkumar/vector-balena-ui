/**
 * The help pages are written against the placeholder domain `mydomain.com`. Replace it with the domain of the
 * server this UI is configured for, so commands can be copied as they are.
 *
 * - `api.fleet.example.com` (REACT_APP_OPEN_BALENA_API_URL) means the server domain is `fleet.example.com`.
 * - `admin.mydomain.com` is the placeholder for the address of this UI, taken from the browser's location.
 *
 * Anything that cannot be derived leaves the text unchanged.
 */

const PLACEHOLDER = 'mydomain.com';

const replaceAll = (text: string, search: string, replacement: string): string => text.split(search).join(replacement);

const hostOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
};

/** The server domain behind an API URL: the host without its leading `api.` label. */
export const serverDomainFromApiUrl = (apiUrl: string | undefined): string | undefined => {
  const host = hostOf(apiUrl);
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return undefined;
  const domain = host.replace(/^api\./, '');
  return domain.includes('.') ? domain : undefined;
};

export const personalizeDoc = (source: string, apiUrl: string | undefined, uiOrigin?: string): string => {
  let text = source;

  const uiHost = hostOf(uiOrigin);
  if (uiOrigin && uiHost && uiHost !== 'localhost') {
    text = replaceAll(text, `https://admin.${PLACEHOLDER}`, uiOrigin.replace(/\/$/, ''));
    text = replaceAll(text, `admin.${PLACEHOLDER}`, uiHost);
  }

  const domain = serverDomainFromApiUrl(apiUrl);
  if (domain) {
    text = replaceAll(text, PLACEHOLDER, domain);
  }

  return text;
};
