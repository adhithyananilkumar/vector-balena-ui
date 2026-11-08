import { Box, Tooltip } from '@mui/material';
import * as React from 'react';
import { useRecordContext } from 'react-admin';
import { isDeviceOnline } from '../../lib/deviceStatus';

/** One metric: label, a large value and a thin bar. Offline devices show dashes instead of stale numbers. */
const Metric: React.FC<{
  label: string;
  value: number;
  display?: string;
  detail?: string;
  offline: boolean;
}> = ({ label, value, display, detail, offline }) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const hot = clamped >= 85;
  return (
    <Tooltip placement='top' arrow title={offline ? 'Unavailable while the device is offline' : (detail ?? '')}>
      <Box sx={{ p: '14px 16px', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>{label}</Box>
          <Box sx={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {offline ? '—' : (display ?? `${Math.round(clamped)}%`)}
          </Box>
        </Box>
        <Box sx={{ mt: 1.25, height: 4, bgcolor: 'action.hover' }}>
          <Box
            sx={{
              height: '100%',
              width: offline ? 0 : `${clamped}%`,
              bgcolor: hot ? 'error.main' : 'secondary.main',
              transition: 'width 0.4s ease',
            }}
          />
        </Box>
      </Box>
    </Tooltip>
  );
};

const UsageWidget = () => {
  const record = useRecordContext();

  if (!record) return null;

  const offline = !isDeviceOnline(record);
  const ratio = (used: number, total: number) => (isFinite(used / total) ? (used / total) * 100 : 0);
  const detail = (used: number, total: number) => (isFinite(used / total) ? `${used} MB of ${total} MB` : '');

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        '& > *': { borderRight: 1, borderBottom: 1, borderColor: 'divider' },
        borderTop: 1,
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      <Metric label='CPU' offline={offline} value={isFinite(record['cpu usage']) ? record['cpu usage'] : 0} />
      <Metric
        label='Temperature'
        offline={offline}
        value={isFinite(record['cpu temp']) ? (record['cpu temp'] / 90) * 100 : 0}
        display={isFinite(record['cpu temp']) ? `${record['cpu temp']}°C` : undefined}
      />
      <Metric
        label='Storage'
        offline={offline}
        value={ratio(record['storage usage'], record['storage total'])}
        detail={detail(record['storage usage'], record['storage total'])}
      />
      <Metric
        label='Memory'
        offline={offline}
        value={ratio(record['memory usage'], record['memory total'])}
        detail={detail(record['memory usage'], record['memory total'])}
      />
    </Box>
  );
};

export default UsageWidget;
