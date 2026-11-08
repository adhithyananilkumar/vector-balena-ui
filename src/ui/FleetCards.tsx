import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  RecordContextProvider,
  useGetList,
  useListContext,
  useCreatePath,
  type RaRecord,
} from 'react-admin';
import { Link, useNavigate } from 'react-router-dom';
import { Cpu, Info, Pencil, Plus, X } from 'lucide-react';
import { Badge } from '../vector/components/badge';
import { BrandMark, lookupDeviceType } from '../vector/components/brands';
import { Button } from '../vector/components/button';
import { VxScope } from '../vector/components/scope';
import DeleteFleetButton from './DeleteFleetButton';

type Rec = RaRecord<any> & Record<string, any>;

const FLEET = 'belongs to-application';
const flag = (value: unknown): boolean => value === true || value === 1;
const shortCommit = (commit: unknown): string => String(commit ?? '').slice(0, 7) || 'unknown';
const when = (value: unknown): string => {
  const date = value ? new Date(String(value)) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
};

/** Counts and lookups shared by every card, fetched once for the whole page. */
const useFleetFacts = () => {
  const page = { pagination: { page: 1, perPage: 1000 } };
  const { data: devices } = useGetList<Rec>('device', { ...page, sort: { field: 'device name', order: 'ASC' } });
  const { data: releases } = useGetList<Rec>('release', { ...page, sort: { field: 'created at', order: 'DESC' } });
  const { data: deviceTypes } = useGetList<Rec>('device type', { ...page, sort: { field: 'slug', order: 'ASC' } });
  const { data: organizations } = useGetList<Rec>('organization', { ...page, sort: { field: 'name', order: 'ASC' } });
  return { devices: devices ?? [], releases: releases ?? [], deviceTypes: deviceTypes ?? [], organizations: organizations ?? [] };
};

type Facts = ReturnType<typeof useFleetFacts>;

const forFleet = (facts: Facts, fleet: Rec) => {
  const devices = facts.devices.filter((device) => device[FLEET] === fleet.id);
  const releases = facts.releases.filter((release) => release[FLEET] === fleet.id);
  const type = facts.deviceTypes.find((item) => item.id === fleet['is for-device type']);
  const organization = facts.organizations.find((item) => item.id === fleet.organization);
  const target = fleet['should be running-release']
    ? releases.find((release) => release.id === fleet['should be running-release'])
    : undefined;
  // a fleet that tracks latest runs its newest successful final release
  const latest = releases.find((release) => release.status === 'success');
  return {
    devices,
    releases,
    online: devices.filter((device) => flag(device['is online'])).length,
    type,
    organization,
    target: flag(fleet['should track latest release']) ? latest : (target ?? latest),
    tracking: flag(fleet['should track latest release']),
  };
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className='min-w-0'>
    <div className='font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase'>{label}</div>
    <div className='mt-0.5 truncate text-[15px] font-semibold tabular-nums'>{value}</div>
  </div>
);

const releaseName = (release: Rec | undefined): string =>
  release ? (String(release.note ?? '').trim().split('\n')[0] || `Release ${shortCommit(release.commit)}`) : '—';

const FleetCard: React.FC<{ fleet: Rec; facts: Facts; onInfo: () => void }> = ({ fleet, facts, onInfo }) => {
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const info = forFleet(facts, fleet);
  const typeSlug = info.type?.slug;
  return (
    <RecordContextProvider value={fleet as RaRecord}>
      <article className='flex flex-col border border-border bg-card text-card-foreground transition-colors hover:border-foreground/30'>
        <div className='flex items-start gap-4 p-5'>
          <BrandMark text={typeSlug} size={44} />
          <div className='min-w-0 flex-1'>
            <h3 className='truncate text-base leading-tight font-semibold tracking-tight'>{fleet['app name']}</h3>
            <p className='mt-0.5 truncate font-mono text-xs text-muted-foreground'>{fleet.slug}</p>
            <p className='mt-1 truncate text-[13px] text-muted-foreground'>
              {lookupDeviceType(typeSlug)?.name ?? typeSlug ?? 'Unknown device type'}
            </p>
          </div>
          <div className='flex flex-wrap justify-end gap-1.5'>
            {flag(fleet['is host']) && <Badge>Host</Badge>}
            {flag(fleet['is archived']) && <Badge variant='warning'>Archived</Badge>}
            {flag(fleet['is public']) && <Badge variant='accent'>Public</Badge>}
          </div>
        </div>

        <div className='grid grid-cols-3 gap-4 border-y border-border px-5 py-3.5'>
          <Stat
            label='Devices'
            value={
              <>
                {info.devices.length}
                {info.devices.length > 0 && (
                  <span className='ml-1.5 text-xs font-medium text-success'>{info.online} online</span>
                )}
              </>
            }
          />
          <Stat label='Releases' value={info.releases.length} />
          <Stat label={info.tracking ? 'Tracking latest' : 'Pinned to'} value={releaseName(info.target)} />
        </div>

        <div className='mt-auto flex flex-wrap items-center gap-2 p-4'>
          <Button variant='accent' size='sm' onClick={() => navigate(`/add-device?fleet=${fleet.id}`)}>
            <Plus aria-hidden /> Add device
          </Button>
          <Button variant='outline' size='sm' onClick={onInfo}>
            <Info aria-hidden /> Info
          </Button>
          <Button variant='ghost' size='sm' asChild>
            <Link to={createPath({ resource: 'application', type: 'edit', id: fleet.id })}>
              <Pencil aria-hidden /> Edit
            </Link>
          </Button>
          <span className='ml-auto'>
            <DeleteFleetButton size='small' variant='outlined' />
          </span>
        </div>
      </article>
    </RecordContextProvider>
  );
};

const Section: React.FC<React.PropsWithChildren<{ title: string; count?: number }>> = ({ title, count, children }) => (
  <section className='mt-6'>
    <h3 className='mb-2 flex items-baseline gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase'>
      {title}
      {count != null && <span className='text-foreground'>{count}</span>}
    </h3>
    {children}
  </section>
);

const Empty: React.FC<React.PropsWithChildren> = ({ children }) => (
  <p className='border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground'>{children}</p>
);

const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className='min-w-0'>
    <dt className='font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase'>{label}</dt>
    <dd className='mt-0.5 truncate text-[13px]'>{children}</dd>
  </div>
);

const FleetInfo: React.FC<{ fleet: Rec; facts: Facts; onClose: () => void }> = ({ fleet, facts, onClose }) => {
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const info = forFleet(facts, fleet);
  const typeSlug = info.type?.slug;

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <VxScope className='fixed inset-0 z-[1300] flex items-center justify-center p-4 sm:p-8'>
      <div className='absolute inset-0 bg-[color-mix(in_oklab,var(--background)_68%,transparent)] backdrop-blur-[3px]' onClick={onClose} aria-hidden />
      <div
        role='dialog'
        aria-modal='true'
        aria-label={`${fleet['app name']} details`}
        className='relative flex max-h-full w-[min(820px,100%)] flex-col border border-border bg-card text-card-foreground shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)]'
      >
        <header className='flex shrink-0 items-center gap-4 border-b border-border px-7 py-5'>
          <BrandMark text={typeSlug} size={44} />
          <div className='min-w-0 flex-1'>
            <h2 className='truncate text-lg leading-tight font-semibold tracking-tight'>{fleet['app name']}</h2>
            <p className='truncate font-mono text-xs text-muted-foreground'>{fleet.slug}</p>
          </div>
          <Button variant='accent' size='sm' onClick={() => navigate(`/add-device?fleet=${fleet.id}`)}>
            <Plus aria-hidden /> Add device
          </Button>
          <Button variant='outline' size='sm' onClick={() => navigate(createPath({ resource: 'application', type: 'edit', id: fleet.id }))}>
            <Pencil aria-hidden /> Edit
          </Button>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='grid size-9 shrink-0 place-items-center text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground'
          >
            <X className='size-4' aria-hidden />
          </button>
        </header>

        <div className='min-h-0 flex-1 overflow-y-auto px-7 pt-2 pb-7'>
          <Section title='Details'>
            <dl className='grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3'>
              <Detail label='Device type'>{lookupDeviceType(typeSlug)?.name ?? typeSlug ?? '—'}</Detail>
              <Detail label='Organization'>{info.organization?.name ?? '—'}</Detail>
              <Detail label='UUID'>
                <span className='font-mono text-xs'>{String(fleet.uuid ?? '').slice(0, 12) || '—'}</span>
              </Detail>
              <Detail label='Release policy'>{info.tracking ? 'Tracks the latest release' : 'Pinned to a release'}</Detail>
              <Detail label='Target release'>{releaseName(info.target)}</Detail>
              <Detail label='Created'>{when(fleet['created at'])}</Detail>
            </dl>
          </Section>

          <Section title='Devices' count={info.devices.length}>
            {info.devices.length === 0 ? (
              <Empty>No devices yet. Use “Add device” to build an image for this fleet.</Empty>
            ) : (
              <ul className='divide-y divide-border border border-border'>
                {info.devices.map((device) => {
                  const running = info.releases.find((release) => release.id === device['is running-release']);
                  const online = flag(device['is online']);
                  return (
                    <li key={device.id}>
                      <Link
                        to={createPath({ resource: 'device', type: 'show', id: device.id })}
                        className='flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-foreground/[0.04]'
                      >
                        <span className={`size-2 shrink-0 rounded-full ${online ? 'bg-success' : 'bg-muted-foreground/40'}`} aria-hidden />
                        <span className='min-w-0 flex-1 truncate font-medium'>{device['device name'] ?? 'Unnamed'}</span>
                        <span className='hidden font-mono text-xs text-muted-foreground sm:block'>{String(device.uuid).slice(0, 7)}</span>
                        <span className='w-32 truncate text-right text-xs text-muted-foreground'>{releaseName(running)}</span>
                        <Badge variant={online ? 'success' : 'default'}>{online ? 'Online' : 'Offline'}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title='Releases' count={info.releases.length}>
            {info.releases.length === 0 ? (
              <Empty>
                Nothing deployed yet. Run <span className='font-mono'>balena deploy {String(fleet.slug ?? fleet['app name'])} --build --note "name"</span>.
              </Empty>
            ) : (
              <ul className='divide-y divide-border border border-border'>
                {info.releases.slice(0, 8).map((release) => (
                  <li key={release.id} className='flex items-center gap-3 px-4 py-2.5 text-[13px]'>
                    <Cpu className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                    <span className='min-w-0 flex-1 truncate font-medium'>{releaseName(release)}</span>
                    <span className='font-mono text-xs text-muted-foreground'>{shortCommit(release.commit)}</span>
                    <span className='hidden text-xs text-muted-foreground sm:block'>{when(release['created at'])}</span>
                    {release.id === info.target?.id && <Badge variant='accent'>Target</Badge>}
                    <Badge variant={release.status === 'success' ? 'success' : 'warning'}>{String(release.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </VxScope>,
    document.body,
  );
};

/** The fleets page: one card per fleet, with its device type's logo, live counts and quick actions. */
export const FleetCards: React.FC = () => {
  const { data, isPending } = useListContext<Rec>();
  const facts = useFleetFacts();
  const [openId, setOpenId] = React.useState<unknown>();
  const open = (data ?? []).find((fleet) => fleet.id === openId);

  if (isPending) return null;
  if (!data?.length) {
    return (
      <p className='border border-dashed border-border p-8 text-center text-sm text-muted-foreground'>
        No fleets yet. Create one to start adding devices.
      </p>
    );
  }
  return (
    <VxScope className='bg-transparent'>
      <div className='grid gap-4 py-4 sm:grid-cols-2 xl:grid-cols-3'>
        {data.map((fleet) => (
          <FleetCard key={String(fleet.id)} fleet={fleet} facts={facts} onInfo={() => setOpenId(fleet.id)} />
        ))}
      </div>
      {open && <FleetInfo fleet={open} facts={facts} onClose={() => setOpenId(undefined)} />}
    </VxScope>
  );
};

export default FleetCards;
