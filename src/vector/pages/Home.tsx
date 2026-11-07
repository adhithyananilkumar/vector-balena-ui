import React, { useEffect, useMemo, useState } from 'react';
import { Title, useGetIdentity, useGetList } from 'react-admin';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Boxes, CheckSquare, Cpu, Package, Plus, Square, Wifi } from 'lucide-react';
import environment from '../../lib/reactAppEnv';
import { getDeviceOverallState } from '../../lib/deviceStatus';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/card';
import { DeviceDoodle, FleetDoodle, TopologyDoodle } from '../components/doodles';
import { EmptyState } from '../components/empty-state';
import { VxScope } from '../components/scope';
import { Skeleton } from '../components/skeleton';
import { cn } from '../lib/utils';

type DeviceState = 'online' | 'offline' | 'updating' | 'degraded' | 'failed';
type Probe = 'checking' | 'ok' | 'down';

const REFRESH_MS = 30_000;

const classifyDevice = (device: Record<string, unknown>): DeviceState => {
  const state = String(getDeviceOverallState(device)).toLowerCase();
  if (state === 'operational') return 'online';
  if (state === 'disconnected') return 'offline';
  if (state.includes('fail')) return 'failed';
  if (state.includes('updat') || state.includes('config')) return 'updating';
  return 'degraded';
};

const stateMeta: Record<
  DeviceState,
  { label: string; dot: string; badge: 'success' | 'default' | 'warning' | 'destructive' | 'accent' }
> = {
  online: { label: 'Online', dot: 'bg-success', badge: 'success' },
  offline: { label: 'Offline', dot: 'bg-muted-foreground/60', badge: 'default' },
  updating: { label: 'Updating', dot: 'bg-accent', badge: 'accent' },
  degraded: { label: 'Degraded', dot: 'bg-warning', badge: 'warning' },
  failed: { label: 'Update failed', dot: 'bg-destructive', badge: 'destructive' },
};

const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const useProbe = (url: string, headers?: () => HeadersInit): Probe => {
  const [state, setState] = useState<Probe>('checking');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch(url, { headers: headers?.() });
        if (!cancelled) setState(response.ok ? 'ok' : 'down');
      } catch {
        if (!cancelled) setState('down');
      }
    };
    void run();
    const timer = window.setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [url, headers]);

  return state;
};

const authHeaders = (): HeadersInit => {
  try {
    const token = window.localStorage.getItem('auth');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const Reveal: React.FC<React.PropsWithChildren<{ delay?: number; className?: string }>> = ({ children, delay = 0, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

const StatCell: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number | string;
  loading: boolean;
  hint: string;
  to: string;
  tone?: 'default' | 'success';
}> = ({ icon: Icon, label, value, loading, hint, to, tone = 'default' }) => (
  <Link
    to={to}
    className='group relative block bg-card p-5 outline-none transition-colors hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
  >
    <div className='flex items-start justify-between'>
      <p className={microLabel}>{label}</p>
      <Icon className='size-4 text-muted-foreground transition-colors group-hover:text-accent' aria-hidden />
    </div>
    {loading ? (
      <Skeleton className='mt-4 h-9 w-14' />
    ) : (
      <p
        className={cn(
          'mt-4 font-mono text-[2.1rem] leading-none font-medium tracking-tight tabular-nums',
          tone === 'success' && Number(value) > 0 && 'text-success',
        )}
      >
        {value}
      </p>
    )}
    <p className='mt-3 text-xs text-muted-foreground'>{hint}</p>
  </Link>
);

const ProbeRow: React.FC<{ label: string; detail: string; state: Probe }> = ({ label, detail, state }) => (
  <li className='flex items-center justify-between gap-3 py-3'>
    <div className='min-w-0'>
      <p className='text-[13px] font-medium'>{label}</p>
      <p className='truncate font-mono text-[11px] text-muted-foreground'>{detail}</p>
    </div>
    {state === 'checking' ? (
      <Skeleton className='h-5 w-24' />
    ) : state === 'ok' ? (
      <Badge variant='success'>Operational</Badge>
    ) : (
      <Badge variant='destructive'>Unreachable</Badge>
    )}
  </li>
);

const Home: React.FC = () => {
  const { data: identity } = useGetIdentity();

  const live = { refetchInterval: REFRESH_MS, refetchIntervalInBackground: false };
  const fleets = useGetList('application', { pagination: { page: 1, perPage: 100 }, sort: { field: 'id', order: 'DESC' } }, live);
  const devices = useGetList('device', { pagination: { page: 1, perPage: 100 }, sort: { field: 'id', order: 'DESC' } }, live);
  const releases = useGetList('release', { pagination: { page: 1, perPage: 1 }, sort: { field: 'id', order: 'DESC' } }, live);

  const apiProbe = useProbe(`${environment.REACT_APP_OPEN_BALENA_API_URL}/ping`);
  const adminProbe = useProbe('/admin-db/actions/access-context', authHeaders);

  const userFleets = useMemo(() => (fleets.data ?? []).filter((fleet) => !fleet['is host']), [fleets.data]);
  const deviceRows = useMemo(() => (devices.data ?? []).map((device) => ({ device, state: classifyDevice(device) })), [devices.data]);
  const counts = useMemo(() => {
    const result: Record<DeviceState, number> = { online: 0, offline: 0, updating: 0, degraded: 0, failed: 0 };
    deviceRows.forEach(({ state }) => (result[state] += 1));
    return result;
  }, [deviceRows]);

  const fleetNames = useMemo(() => {
    const map = new Map<unknown, string>();
    userFleets.forEach((fleet) => map.set(fleet.id, String(fleet['app name'] ?? fleet.id)));
    return map;
  }, [userFleets]);

  const fleetCount = userFleets.length;
  const deviceTotal = devices.total ?? deviceRows.length;
  const releaseTotal = releases.total ?? 0;
  const loadingAny = fleets.isPending || devices.isPending || releases.isPending;
  const sampleNote = deviceTotal > deviceRows.length;
  const name = String(identity?.fullName ?? identity?.username ?? '').split('@')[0];

  const steps = [
    { done: fleetCount > 0, title: 'Create a fleet', text: 'Group devices that run the same software.', to: '/application/create', action: 'Create fleet' },
    { done: deviceTotal > 0, title: 'Add your first device', text: 'Provision a device and bring it online.', to: '/device/create', action: 'Add device' },
    { done: releaseTotal > 0, title: 'Push a release', text: 'Deploy containers to every device in the fleet.', to: '/release', action: 'View releases' },
  ];
  const stepsDone = steps.filter((step) => step.done).length;

  return (
    <VxScope className='mx-auto w-full max-w-[1400px] pb-6'>
      <Title title='Overview' />

      {/* hero */}
      <Reveal>
        <section className='relative overflow-hidden border border-border bg-card'>
          <div
            aria-hidden
            className='absolute inset-0'
            style={{
              backgroundImage:
                'linear-gradient(to right, color-mix(in oklab, var(--foreground) 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 5%, transparent) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              maskImage: 'linear-gradient(to left, #000 0%, transparent 70%)',
              WebkitMaskImage: 'linear-gradient(to left, #000 0%, transparent 70%)',
            }}
          />
          <div className='relative grid items-center gap-8 px-7 py-9 md:grid-cols-[minmax(0,1fr)_minmax(280px,440px)] md:px-10'>
            <div>
              <p className={microLabel}>Overview</p>
              <h1 className='mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight'>
                {greeting()}
                {name ? `, ${name}` : ''}
              </h1>
              <p className='mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground'>
                {loadingAny
                  ? 'Loading your fleet…'
                  : deviceTotal === 0
                    ? 'Your Vector workspace is ready. Connect your first device to start managing your fleet.'
                    : `${counts.online} of ${deviceRows.length} devices online across ${fleetCount} ${fleetCount === 1 ? 'fleet' : 'fleets'}.`}
              </p>
              <div className='mt-7 flex flex-wrap gap-3'>
                <Button asChild variant='accent' size='lg'>
                  <Link to='/device/create'>
                    <Plus aria-hidden /> Add device
                  </Link>
                </Button>
                <Button asChild variant='outline' size='lg'>
                  <Link to='/application'>
                    View fleets <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
            <div className='hidden self-center text-foreground/60 md:block'>
              <TopologyDoodle className='mx-auto block h-auto w-full' />
            </div>
          </div>
        </section>
      </Reveal>

      {/* stats */}
      <Reveal delay={0.05} className='mt-4'>
        <div className='grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4'>
          <StatCell icon={Boxes} label='Fleets' value={fleetCount} loading={fleets.isPending} hint='Groups of devices' to='/application' />
          <StatCell icon={Cpu} label='Devices' value={deviceTotal} loading={devices.isPending} hint='Registered in total' to='/device' />
          <StatCell
            icon={Wifi}
            label='Online now'
            value={counts.online}
            loading={devices.isPending}
            hint={sampleNote ? `Of the latest ${deviceRows.length} devices` : 'Connected and healthy'}
            to='/device'
            tone='success'
          />
          <StatCell icon={Package} label='Releases' value={releaseTotal} loading={releases.isPending} hint='Deployed versions' to='/release' />
        </div>
      </Reveal>

      <div className='mt-4 grid gap-4 lg:grid-cols-3'>
        <div className='grid content-start gap-4 lg:col-span-2'>
          {/* devices */}
          <Reveal delay={0.1}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Devices</CardTitle>
                  <CardDescription>Newest devices and their current state</CardDescription>
                </div>
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/device'>
                    View all <ArrowUpRight aria-hidden />
                  </Link>
                </Button>
              </CardHeader>
              {devices.isPending ? (
                <CardContent className='grid gap-3'>
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className='h-10 w-full' />
                  ))}
                </CardContent>
              ) : deviceRows.length === 0 ? (
                <EmptyState
                  className='py-12'
                  doodle={<DeviceDoodle />}
                  title='No devices yet'
                  text='Add a device to see its status, releases and logs here.'
                  action={
                    <Button asChild variant='accent' size='sm'>
                      <Link to='/device/create'>
                        <Plus aria-hidden /> Add your first device
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full min-w-[520px] text-sm'>
                    <thead>
                      <tr className={cn(microLabel, 'text-left')}>
                        <th className='px-5 py-2.5 font-medium'>Device</th>
                        <th className='px-3 py-2.5 font-medium'>Fleet</th>
                        <th className='px-3 py-2.5 font-medium'>OS</th>
                        <th className='px-5 py-2.5 text-right font-medium'>Status</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border border-t border-border'>
                      {deviceRows.slice(0, 8).map(({ device, state }) => (
                        <tr key={String(device.id)} className='transition-colors hover:bg-foreground/[0.03]'>
                          <td className='px-5 py-3'>
                            <Link
                              to={`/device/${device.id}/show`}
                              className='font-medium outline-none hover:text-accent focus-visible:text-accent'
                            >
                              {String(device['device name'] ?? device.uuid ?? device.id)}
                            </Link>
                            <p className='font-mono text-[11px] text-muted-foreground'>{String(device.uuid ?? '').slice(0, 8)}</p>
                          </td>
                          <td className='px-3 py-3 text-muted-foreground'>{fleetNames.get(device['belongs to-application']) ?? '—'}</td>
                          <td className='px-3 py-3 font-mono text-xs text-muted-foreground'>
                            {device['os version'] ? String(device['os version']) : '—'}
                          </td>
                          <td className='px-5 py-3 text-right'>
                            <Badge variant={stateMeta[state].badge}>
                              <span className={cn('size-1.5', stateMeta[state].dot)} />
                              {stateMeta[state].label}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </Reveal>

          {/* fleets */}
          <Reveal delay={0.15}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Fleets</CardTitle>
                  <CardDescription>Your device groups</CardDescription>
                </div>
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/application/create'>
                    <Plus aria-hidden /> New fleet
                  </Link>
                </Button>
              </CardHeader>
              {fleets.isPending ? (
                <CardContent className='grid gap-3 sm:grid-cols-2'>
                  <Skeleton className='h-14' />
                  <Skeleton className='h-14' />
                </CardContent>
              ) : userFleets.length === 0 ? (
                <EmptyState
                  className='py-10'
                  doodle={<FleetDoodle />}
                  title='No fleets yet'
                  text='Create a fleet to start grouping devices.'
                />
              ) : (
                <ul className='grid gap-px bg-border sm:grid-cols-2'>
                  {userFleets.slice(0, 6).map((fleet) => {
                    const members = deviceRows.filter(({ device }) => device['belongs to-application'] === fleet.id);
                    return (
                      <li key={String(fleet.id)} className='bg-card'>
                        <Link
                          to={`/application/${fleet.id}/show`}
                          className='flex items-center justify-between gap-3 px-5 py-3.5 transition-colors outline-none hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.05]'
                        >
                          <span className='min-w-0'>
                            <span className='block truncate text-sm font-medium'>{String(fleet['app name'] ?? fleet.id)}</span>
                            <span className='block font-mono text-[11px] text-muted-foreground'>
                              {sampleNote ? 'FLEET' : `${members.length} ${members.length === 1 ? 'DEVICE' : 'DEVICES'}`}
                            </span>
                          </span>
                          <ArrowUpRight className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>

        <div className='grid content-start gap-4'>
          {/* fleet health */}
          <Reveal delay={0.12}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Fleet health</CardTitle>
                  <CardDescription>Device states at a glance</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {devices.isPending ? (
                  <Skeleton className='h-2.5 w-full' />
                ) : deviceRows.length === 0 ? (
                  <div className='h-2.5 w-full bg-foreground/[0.07]' />
                ) : (
                  <div className='flex h-2.5 w-full gap-px overflow-hidden'>
                    {(Object.keys(counts) as DeviceState[])
                      .filter((key) => counts[key] > 0)
                      .map((key) => (
                        <motion.div
                          key={key}
                          className={cn('h-full', stateMeta[key].dot)}
                          initial={{ width: 0 }}
                          animate={{ width: `${(counts[key] / deviceRows.length) * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                        />
                      ))}
                  </div>
                )}
                <ul className='mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5'>
                  {(Object.keys(stateMeta) as DeviceState[]).map((key) => (
                    <li key={key} className='flex items-center justify-between text-[13px]'>
                      <span className='flex items-center gap-2 text-muted-foreground'>
                        <span className={cn('size-2', stateMeta[key].dot)} />
                        {stateMeta[key].label}
                      </span>
                      <span className='font-mono font-medium tabular-nums'>{counts[key]}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          {/* getting started */}
          {stepsDone < steps.length && (
            <Reveal delay={0.16}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Get started</CardTitle>
                    <CardDescription>
                      {stepsDone} of {steps.length} complete
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='mb-5 h-1 w-full bg-foreground/[0.07]'>
                    <motion.div
                      className='h-full bg-accent'
                      initial={{ width: 0 }}
                      animate={{ width: `${(stepsDone / steps.length) * 100}%` }}
                      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                    />
                  </div>
                  <ol className='grid gap-4'>
                    {steps.map((step) => (
                      <li key={step.title} className='flex items-start gap-3'>
                        {step.done ? (
                          <CheckSquare className='mt-0.5 size-4 shrink-0 text-success' aria-hidden />
                        ) : (
                          <Square className='mt-0.5 size-4 shrink-0 text-muted-foreground/60' aria-hidden />
                        )}
                        <div className='min-w-0 flex-1'>
                          <p className={cn('text-[13px] font-medium', step.done && 'text-muted-foreground line-through')}>{step.title}</p>
                          <p className='text-xs text-muted-foreground'>{step.text}</p>
                          {!step.done && (
                            <Link
                              to={step.to}
                              className='mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent outline-none hover:underline focus-visible:underline'
                            >
                              {step.action} <ArrowRight className='size-3' aria-hidden />
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </Reveal>
          )}

          {/* system status */}
          <Reveal delay={0.2}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>System status</CardTitle>
                  <CardDescription>Checked every 30 seconds</CardDescription>
                </div>
              </CardHeader>
              <CardContent className='py-2'>
                <ul className='divide-y divide-border'>
                  <ProbeRow label='Vector API' detail={String(environment.REACT_APP_OPEN_BALENA_API_URL ?? '')} state={apiProbe} />
                  <ProbeRow label='Admin gateway' detail='Access control and administration' state={adminProbe} />
                </ul>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </VxScope>
  );
};

export default Home;
