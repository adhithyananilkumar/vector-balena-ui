import React from 'react';
import { Loader2, X } from 'lucide-react';
import { formatBytes } from '../lib/api';
import { formatDuration } from '../lib/imageSave';
import type { Transfer } from '../lib/transfers';
import { Button } from './button';

/** The progress of a running transfer: what it is doing, how far, how fast, and Cancel. Shared by the page and the tray. */
const TransferProgress: React.FC<{ transfer: Transfer; onCancel: () => void; compact?: boolean }> = ({ transfer, onCancel, compact }) => {
  const progress = transfer.progress;
  const percent = progress?.percent;
  return (
    <div className='grid gap-2' role='status' aria-live='polite'>
      <p className='flex items-center gap-2 text-sm'>
        <Loader2 className='size-4 shrink-0 animate-spin' aria-hidden />
        <span className='min-w-0 truncate'>
          {transfer.label}
          {percent !== undefined ? ` · ${Math.floor(percent)}%` : ''}
        </span>
      </p>
      {percent !== undefined && (
        <div className='h-1.5 w-full bg-foreground/10' role='progressbar' aria-label={transfer.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(percent)}>
          <div className='h-full bg-accent transition-[width]' style={{ width: `${percent}%` }} />
        </div>
      )}
      {progress && (
        <p className='text-xs text-muted-foreground'>
          {formatBytes(progress.written)}
          {progress.total ? ` of ${formatBytes(progress.total)}` : ''}
          {progress.bytesPerSecond > 0 ? ` · ${formatBytes(progress.bytesPerSecond)}/s` : ''}
          {progress.etaSeconds !== undefined ? ` · about ${formatDuration(progress.etaSeconds)} left` : ''}
        </p>
      )}
      {transfer.notice && <p className='border border-input px-2.5 py-1.5 text-xs'>{transfer.notice}</p>}
      {!compact && <p className='text-xs text-muted-foreground'>You can leave this page: it keeps going and shows in the corner of every page. If the connection drops it continues where it stopped.</p>}
      <span>
        <Button variant='outline' size='sm' onClick={onCancel}>
          <X aria-hidden />
          Cancel
        </Button>
      </span>
    </div>
  );
};

export default TransferProgress;
