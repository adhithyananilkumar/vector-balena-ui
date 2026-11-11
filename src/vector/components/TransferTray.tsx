import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { formatBytes } from '../lib/api';
import { transfers, useTransfers } from '../lib/transfers';
import { Button } from './button';
import TransferProgress from './TransferProgress';
import { VxScope } from './scope';

/**
 * Downloads and image builds follow the user around the app: this tray is on every page except Add device, which
 * shows the same thing in place. It is how a download that is minutes long stays visible and cancellable while the
 * user looks at another device or fleet.
 */
const TransferTray: React.FC = () => {
  const items = useTransfers();
  const { pathname } = useLocation();
  // Add device and a device's own page show the transfer in place
  if (items.length === 0 || pathname.startsWith('/add-device') || /^\/device\/[^/]+\/show/.test(pathname)) return null;

  return (
    <VxScope className='pointer-events-none fixed right-4 bottom-4 z-50 grid w-[min(380px,calc(100vw-2rem))] gap-2'>
      {items.map((item) => (
        <section key={item.id} aria-label={item.title} className='pointer-events-auto grid gap-2 border border-border bg-card px-3.5 py-3 shadow-lg'>
          <p className='flex items-start justify-between gap-2 text-[13px] font-medium'>
            <span className='min-w-0 truncate' title={item.title}>
              {item.title}
            </span>
            {item.state !== 'running' && (
              <button type='button' aria-label='Dismiss' className='shrink-0 text-muted-foreground hover:text-foreground' onClick={() => transfers.dismiss(item.id)}>
                <X className='size-4' aria-hidden />
              </button>
            )}
          </p>
          {item.state === 'running' && <TransferProgress transfer={item} compact onCancel={() => transfers.cancel(item.id)} />}
          {item.state === 'done' && (
            <p className='flex items-start gap-2 text-xs'>
              <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
              <span>
                Saved <code>{item.outcome?.fileName}</code> ({formatBytes(item.outcome?.bytes)}).{' '}
                <Link to='/add-device' className='text-accent underline underline-offset-2'>
                  Open Add device
                </Link>
              </span>
            </p>
          )}
          {item.state === 'error' && (
            <div className='grid gap-2 text-xs text-destructive'>
              <p className='flex items-start gap-2'>
                <TriangleAlert className='mt-0.5 size-3.5 shrink-0' aria-hidden />
                <span>{item.error?.message}</span>
              </p>
              <span>
                <Button asChild variant='outline' size='sm'>
                  <Link to='/add-device'>Open Add device to try again</Link>
                </Button>
              </span>
            </div>
          )}
          {item.state === 'cancelled' && <p className='text-xs text-muted-foreground'>Cancelled. Nothing was saved.</p>}
        </section>
      ))}
    </VxScope>
  );
};

export default TransferTray;
