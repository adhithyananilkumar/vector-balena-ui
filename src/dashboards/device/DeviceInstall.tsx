import * as React from 'react';
import { Link } from 'react-router-dom';
import { useRecordContext } from 'react-admin';
import { CheckCircle2, Download, TriangleAlert } from 'lucide-react';
import { AWAITING_FIRST_BOOT, getDeviceOverallState } from '../../lib/deviceStatus';
import { formatBytes } from '../../vector/lib/api';
import { transfers, useTransfers } from '../../vector/lib/transfers';
import TransferProgress from '../../vector/components/TransferProgress';
import { Button } from '../../vector/components/button';
import { VxScope } from '../../vector/components/scope';

/**
 * Install the OS on this device: the live download (the same one the corner tray shows) and the buttons to download
 * the image or config.json again. Shown while the device has never connected, or when a transfer for its fleet exists.
 */
const DeviceInstall: React.FC = () => {
  const device = useRecordContext<Record<string, unknown>>();
  const items = useTransfers();
  if (!device) return null;

  const fleetId = Number(device['belongs to-application']);
  const uuid = String(device.uuid ?? '');
  const waiting = getDeviceOverallState(device as never) === AWAITING_FIRST_BOOT;
  const related = items.filter((item) => item.kind === 'base' || item.key.endsWith(`:${fleetId}`));
  if (!waiting && related.length === 0) return null;

  const link = `/add-device?fleet=${fleetId}&device=${encodeURIComponent(uuid)}`;
  return (
    <VxScope className='mb-4 grid gap-3 border border-border bg-card px-4 py-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <p className='text-sm font-medium'>Install the OS</p>
          <p className='text-xs text-muted-foreground'>
            {waiting ? 'This device has not connected yet. Put the OS on a drive, power it on, and it comes online here.' : 'Downloads for this device.'}
          </p>
        </div>
        <span className='flex flex-wrap gap-2'>
          <Button asChild variant='accent' size='sm'>
            <Link to={link}>
              <Download className='size-3.5' aria-hidden /> Download OS image
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link to={link}>Download config.json</Link>
          </Button>
        </span>
      </div>
      {related.map((item) => (
        <section key={item.id} aria-label={item.title} className='grid gap-2 border-t border-border pt-3'>
          <p className='text-[13px] font-medium'>{item.title}</p>
          {item.state === 'running' && <TransferProgress transfer={item} compact onCancel={() => transfers.cancel(item.id)} />}
          {item.state === 'done' && (
            <p className='flex items-center gap-2 text-xs'>
              <CheckCircle2 className='size-3.5 text-success' aria-hidden /> Saved <code>{item.outcome?.fileName}</code> ({formatBytes(item.outcome?.bytes)}).
            </p>
          )}
          {item.state === 'error' && (
            <p className='flex items-center gap-2 text-xs text-destructive'>
              <TriangleAlert className='size-3.5' aria-hidden /> {item.error?.message}
            </p>
          )}
          {item.state === 'cancelled' && <p className='text-xs text-muted-foreground'>Cancelled. Nothing was saved.</p>}
        </section>
      ))}
    </VxScope>
  );
};

export default DeviceInstall;
