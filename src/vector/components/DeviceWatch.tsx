import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetList } from 'react-admin';
import { CheckCircle2, CircleDashed, Loader2, Wifi, WifiOff } from 'lucide-react';
import { getDeviceOverallState, isDeviceOnline } from '../../lib/deviceStatus';
import { cn } from '../lib/utils';

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

type Row = Record<string, unknown> & { id: number | string };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * What to do with the image and what to expect, with the fleet's devices watched live: the page does not stay on
 * "done" with no sign of the device, it shows the device appear and come online.
 *
 * - A single-device image: that device (already registered) goes from offline to online when it boots.
 * - A fleet-wide image: any device that registers itself in the fleet after \`since\` is shown.
 */
const DeviceWatch: React.FC<{
  fleetId: number;
  fleetName: string;
  /** Uuid of the device the image is for, when it is for one device. */
  expectedUuid?: string;
  /** When the image or config was made (ms). Devices registered before are not "new". */
  since: number;
  /** What was made, for the first step. */
  made: 'image' | 'config';
  /** Hide the instructions and show only the live status (right after a device is added). */
  statusOnly?: boolean;
}> = ({ fleetId, fleetName, expectedUuid, since, made, statusOnly = false }) => {
  const { data, isPending } = useGetList(
    'device',
    { pagination: { page: 1, perPage: 100 }, sort: { field: 'id', order: 'DESC' }, filter: { 'belongs to-application': fleetId } },
    { refetchInterval: 5000, refetchIntervalInBackground: false },
  );

  const devices = useMemo(() => (data ?? []) as Row[], [data]);
  const mine = expectedUuid ? devices.find((device) => text(device.uuid) === expectedUuid) : undefined;
  const fresh = useMemo(
    () =>
      expectedUuid
        ? []
        : devices.filter((device) => {
            const created = Date.parse(text(device['created at']));
            return Number.isFinite(created) && created >= since - 5000;
          }),
    [devices, expectedUuid, since],
  );
  const shown = mine ? [mine] : fresh;
  const anyOnline = shown.some((device) => isDeviceOnline(device));

  const steps = [
    made === 'image'
      ? 'Write the image to the SD card or USB drive with balenaEtcher (or `balena local flash`).'
      : 'Write config.json into the boot partition of a drive that already runs balenaOS (the small partition called resin-boot), replacing the file there.',
    'Put the drive in the device, connect Ethernet (or have the Wi-Fi in range) and power it on.',
    expectedUuid
      ? 'The first boot takes a few minutes. This device then comes online below.'
      : 'The first boot takes a few minutes. The device registers itself in the fleet and appears below.',
  ];

  return (
    <div className='grid gap-3 border border-input px-3.5 py-3' aria-live='polite'>
      {!statusOnly && (
        <>
          <span className={microLabel}>What happens next</span>
          <ol className='grid gap-1.5 text-[13px]'>
            {steps.map((step, index) => (
              <li key={step} className='flex gap-2'>
                <span className='mt-px font-mono text-xs text-muted-foreground'>{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className={cn('grid gap-1.5', !statusOnly && 'border-t border-border pt-3')}>
        <span className={microLabel}>Device status</span>
        {shown.length === 0 ? (
          <p className='flex items-center gap-2 text-[13px] text-muted-foreground'>
            {isPending ? <Loader2 className='size-4 animate-spin' aria-hidden /> : <CircleDashed className='size-4' aria-hidden />}
            {isPending
              ? 'Checking the fleet…'
              : expectedUuid
                ? `Waiting for the device to appear in ${fleetName}…`
                : `Waiting for a new device to register itself in ${fleetName}. This page checks every few seconds.`}
          </p>
        ) : (
          <ul className='grid gap-1.5'>
            {shown.map((device) => {
              const online = isDeviceOnline(device);
              return (
                <li key={String(device.id)} className='flex flex-wrap items-center gap-2 text-[13px]'>
                  {online ? <Wifi className='size-4 text-success' aria-hidden /> : <WifiOff className='size-4 text-muted-foreground' aria-hidden />}
                  <Link to={`/device/${device.id}/show`} className='font-medium text-accent underline underline-offset-2'>
                    {text(device['device name']) || text(device.uuid).slice(0, 7)}
                  </Link>
                  <code className='text-xs text-muted-foreground'>{text(device.uuid).slice(0, 7)}</code>
                  <span className={cn('text-xs', online ? 'text-success' : 'text-muted-foreground')}>
                    {online ? 'Online' : getDeviceOverallState(device) === 'Awaiting first boot' ? 'Added, awaiting its first boot' : getDeviceOverallState(device)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {anyOnline && (
          <p className='flex items-center gap-2 text-[13px] text-success'>
            <CheckCircle2 className='size-4' aria-hidden />
            Your device is online. You can open it to see its logs and deploy to it.
          </p>
        )}
      </div>
    </div>
  );
};

export default DeviceWatch;
