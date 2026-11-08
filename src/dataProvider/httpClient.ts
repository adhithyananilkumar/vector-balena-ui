import { HttpError } from 'react-admin';
import type { HttpClient } from './odataDataProvider';
import { withPermissionHint } from '../lib/httpErrorMessage';
import { serverUrl } from '../lib/serverUrl';

export const withPermissionHints =
  (httpClient: HttpClient): HttpClient =>
  async (url, options) => {
    try {
      return await httpClient(url, options);
    } catch (error) {
      if (error instanceof HttpError) {
        error.message = withPermissionHint(error.message, error.status);
      }
      throw error;
    }
  };

/** Sends root-relative requests ("/admin-db/...") to the Vector server; absolute URLs pass through untouched. */
export const withServerBase =
  (httpClient: HttpClient): HttpClient =>
  (url, options) =>
    httpClient(url.startsWith('/') && !url.startsWith('//') ? serverUrl(url) : url, options);
