import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Title, useGetList } from 'react-admin';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '../components/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/card';
import { EmptyBoxDoodle } from '../components/doodles';
import { EmptyState } from '../components/empty-state';
import { Input } from '../components/input';
import { VxScope } from '../components/scope';
import { authFetch, formatBytes } from '../lib/api';
import { cn } from '../lib/utils';
import { formatDuration, savedPercent } from '../../lib/deltaFormat';

interface DeltaRecord {
  id: string;
  srcImage: string;
  destImage: string;
  deltaImage: string;
  status: 'building' | 'ready' | 'failed';
  error?: string;
  firstRequestedAt: number;
  lastRequestedAt: number;
  requests: number;
  devices: string[];
  startedAt?: number;
  finishedAt?: number;
  buildMs?: number;
  pullMs?: number;
  diffMs?: number;
  pushMs?: number;
  srcBytes?: number;
  destBytes?: number;
  deltaBytes?: number;
}

type Row = Record<string, unknown>;
const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

const timeAgo = (at: number): string => {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(at).toLocaleDateString();
};

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card>
    <CardContent className='py-4'>
      <p className={microLabel}>{label}</p>
      <p className='mt-1.5 text-2xl font-semibold tracking-tight'>{value}</p>
      {hint && <p className='mt-0.5 text-xs text-muted-foreground'>{hint}</p>}
    </CardContent>
  </Card>
);

/** Proportional bar of where the build time went: pulling both images, diffing, uploading. */
const TimeSplit: React.FC<{ record: DeltaRecord }> = ({ record }) => {
  const parts = [
    { label: 'Pull', ms: record.pullMs, className: 'bg-foreground/30' },
    { label: 'Diff', ms: record.diffMs, className: 'bg-accent' },
    { label: 'Push', ms: record.pushMs, className: 'bg-success' },
  ];
  const total = parts.reduce((sum, part) => sum + (part.ms ?? 0), 0);
  if (!total) return <span className='text-xs text-muted-foreground'>Not measured</span>;
  return (
    <div className='min-w-[150px]'>
      <div className='flex h-1.5 w-full overflow-hidden bg-foreground/[0.08]' role='img' aria-label='Build time split'>
        {parts.map((part) => (
          <div key={part.label} className={part.className} style={{ width: `${((part.ms ?? 0) / total) * 100}%` }} />
        ))}
      </div>
      <p className='mt-1.5 font-mono text-[11px] text-muted-foreground'>
        {parts.map((part) => `${part.label} ${formatDuration(part.ms)}`).join(' · ')}
      </p>
    </div>
  );
};

const Deltas: React.FC = () => {
  const list = { pagination: { page: 1, perPage: 1000 }, sort: { field: 'id', order: 'ASC' as const } };
  const { data: images } = useGetList('image', list);
  const { data: services } = useGetList('service', list);
  const { data: links } = useGetList('image-is part of-release', list);
  const { data: releases } = useGetList('release', list);

  const [records, setRecords] = useState<DeltaRecord[] | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await authFetch<{ records: DeltaRecord[] }>('/deltas/records');
      setRecords(result.records);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load delta records.');
      setRecords((current) => current ?? []);
    }
  }, []);
  const anyBuilding = records?.some((record) => record.status === 'building') ?? false;
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), anyBuilding ? 2000 : 15000);
    return () => window.clearInterval(timer);
  }, [refresh, anyBuilding]);

  // image hash (from the registry path) -> what it is: service, release name, revision
  const describe = useMemo(() => {
    const serviceName = new Map<unknown, string>((services ?? []).map((s: Row) => [s.id, String(s['service name'])]));
    const releaseById = new Map<unknown, Row>((releases ?? []).map((r: Row) => [r.id, r]));
    const releaseOfImage = new Map<unknown, unknown>((links ?? []).map((l: Row) => [l.image, l['is part of-release']]));
    const byHash = new Map<string, { service: string; release: string; revision?: number }>();
    for (const image of images ?? []) {
      const hash = String(image['is stored at-image location'] ?? '').split('/').pop() ?? '';
      const release = releaseById.get(releaseOfImage.get(image.id));
      const note = String(release?.note ?? '').trim().split('\n')[0];
      byHash.set(hash, {
        service: serviceName.get(image['is a build of-service']) ?? 'service',
        release: note || (release ? `Release ${String(release.commit ?? '').slice(0, 7)}` : 'Unknown release'),
        revision: release?.revision == null ? undefined : Number(release.revision),
      });
    }
    return (hash: string) => byHash.get(hash) ?? { service: 'unknown', release: `image ${hash.slice(0, 7)}`, revision: undefined };
  }, [images, services, links, releases]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records ?? [];
    return (records ?? []).filter((record) => {
      const from = describe(record.srcImage);
      const to = describe(record.destImage);
      return [from.service, from.release, to.release, record.status].some((text) => text.toLowerCase().includes(needle));
    });
  }, [records, query, describe]);

  const measured = (records ?? []).filter((record) => record.status === 'ready' && record.buildMs != null);
  const sized = (records ?? []).filter((record) => savedPercent(record) !== undefined);
  const averageBuild = measured.length ? measured.reduce((sum, r) => sum + (r.buildMs ?? 0), 0) / measured.length : undefined;
  const averageSaved = sized.length ? sized.reduce((sum, r) => sum + (savedPercent(r) ?? 0), 0) / sized.length : undefined;
  const totalSaved = sized.reduce((sum, r) => sum + ((r.destBytes ?? 0) - (r.deltaBytes ?? 0)) * Math.max(1, r.devices.length), 0);

  return (
    <VxScope className='w-full pb-6'>
      <Title title='Delta builds' />

      {error && (
        <div role='alert' className='mb-4 border border-destructive/40 px-4 py-3 text-[13px] text-destructive'>
          {error}
        </div>
      )}

      <div className='mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <Stat label='Deltas built' value={String(records?.length ?? 0)} hint={`${records?.filter((r) => r.status === 'failed').length ?? 0} failed`} />
        <Stat label='Average build time' value={formatDuration(averageBuild && Math.round(averageBuild))} hint='Pull, diff and upload' />
        <Stat label='Average saving' value={averageSaved === undefined ? '—' : `${averageSaved.toFixed(0)}%`} hint='Of the full image download' />
        <Stat label='Data saved' value={formatBytes(totalSaved)} hint='Across the devices that updated' />
      </div>

      <Card>
        <CardHeader className='flex-wrap gap-3'>
          <div>
            <CardTitle>Delta builds</CardTitle>
            <CardDescription>
              A delta is the difference between two releases of a service. Devices download it instead of the whole image.
            </CardDescription>
          </div>
          <Input
            aria-label='Search delta builds'
            placeholder='Search by service or release'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className='w-full sm:w-64'
          />
        </CardHeader>
        {records === undefined ? (
          <CardContent className='text-sm text-muted-foreground'>Loading…</CardContent>
        ) : visible.length === 0 ? (
          <EmptyState
            className='py-12'
            doodle={<EmptyBoxDoodle />}
            title={records.length === 0 ? 'No deltas yet' : 'Nothing matches'}
            text={
              records.length === 0
                ? 'Turn on BALENA_SUPERVISOR_DELTA=1 for a fleet. The first update of a service after that is built here.'
                : 'Try another search.'
            }
          />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[980px] text-sm'>
              <thead>
                <tr className={cn(microLabel, 'text-left')}>
                  <th className='px-5 py-2.5 font-medium'>Update</th>
                  <th className='px-3 py-2.5 font-medium'>Status</th>
                  <th className='px-3 py-2.5 font-medium'>Size</th>
                  <th className='px-3 py-2.5 font-medium'>Build time</th>
                  <th className='px-3 py-2.5 text-right font-medium'>Devices</th>
                  <th className='px-5 py-2.5 text-right font-medium'>Requested</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border border-t border-border'>
                {visible.map((record) => {
                  const from = describe(record.srcImage);
                  const to = describe(record.destImage);
                  const saved = savedPercent(record);
                  return (
                    <tr key={record.id} className='align-top transition-colors hover:bg-foreground/[0.03]'>
                      <td className='px-5 py-3'>
                        <p className='font-mono text-[11px] text-muted-foreground'>{to.service}</p>
                        <p className='mt-0.5 flex flex-wrap items-center gap-1.5 font-medium'>
                          {from.release}
                          <ArrowRight className='size-3.5 text-muted-foreground' aria-hidden />
                          {to.release}
                        </p>
                      </td>
                      <td className='px-3 py-3'>
                        {record.status === 'building' ? (
                          <Badge className='gap-1'>
                            <Loader2 className='size-3 animate-spin' aria-hidden />
                            Building
                          </Badge>
                        ) : record.status === 'ready' ? (
                          <Badge variant='success'>Ready</Badge>
                        ) : (
                          <div>
                            <Badge variant='destructive'>Failed</Badge>
                            <p className='mt-1 max-w-[220px] text-xs text-destructive'>{record.error}</p>
                          </div>
                        )}
                      </td>
                      <td className='px-3 py-3'>
                        {record.deltaBytes == null ? (
                          <span className='text-xs text-muted-foreground'>Not measured</span>
                        ) : (
                          <div className='min-w-[170px]'>
                            <p className='font-mono text-xs'>
                              {formatBytes(record.deltaBytes)}
                              <span className='text-muted-foreground'> of {formatBytes(record.destBytes)}</span>
                            </p>
                            {saved !== undefined && (
                              <div className='mt-1.5 h-1.5 w-full bg-foreground/[0.08]'>
                                <div className='h-full bg-success' style={{ width: `${saved}%` }} />
                              </div>
                            )}
                            {saved !== undefined && <p className='mt-1 text-[11px] text-success'>{saved.toFixed(0)}% smaller download</p>}
                          </div>
                        )}
                      </td>
                      <td className='px-3 py-3'>
                        <p className='font-mono text-xs'>{formatDuration(record.buildMs)}</p>
                        <div className='mt-1.5'>
                          <TimeSplit record={record} />
                        </div>
                      </td>
                      <td className='px-3 py-3 text-right font-mono text-xs' title={record.devices.join('\n')}>
                        {record.devices.length}
                        <span className='block text-[11px] text-muted-foreground'>{record.requests} requests</span>
                      </td>
                      <td className='px-5 py-3 text-right text-xs text-muted-foreground'>{timeAgo(record.lastRequestedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </VxScope>
  );
};

export default Deltas;
