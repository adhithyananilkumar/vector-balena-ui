export const isAbsoluteDevicePath = (path: string): boolean => path.trim().startsWith('/') && !path.includes('\0');

export const transferFilename = (path: string): string => {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? 'download';
};

export const isTransferCancellation = (error: unknown, signal: AbortSignal): boolean =>
  signal.aborted || (error instanceof Error && error.name === 'AbortError');

export const createTerminalDecoder = (channel: number): ((buffer: ArrayBuffer) => string) => {
  const decoder = new TextDecoder();
  return (buffer) => {
    if (buffer.byteLength < 5 || new DataView(buffer).getUint32(0) !== channel) {
      throw new Error('The terminal server returned an invalid binary message.');
    }
    return decoder.decode(new Uint8Array(buffer, 4), { stream: true });
  };
};

/** "1.4 MB" style size for transfer progress. */
export const formatTransferBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
};
