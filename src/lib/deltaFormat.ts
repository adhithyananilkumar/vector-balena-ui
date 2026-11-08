export const formatDuration = (ms: number | undefined): string => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.floor(seconds / 60)} m ${Math.round(seconds % 60)} s`;
};

/** Share of the full download a delta avoids, 0–100; undefined when sizes are unknown. */
export const savedPercent = (record: { destBytes?: number; deltaBytes?: number }): number | undefined => {
  if (!record.destBytes || record.deltaBytes == null) return undefined;
  return Math.max(0, Math.min(100, (1 - record.deltaBytes / record.destBytes) * 100));
};
