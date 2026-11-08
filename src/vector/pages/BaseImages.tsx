import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Title, useGetList } from 'react-admin';
import { CheckCircle2, Download, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '../components/badge';
import { BrandLabel, BrandMark, lookupDeviceType } from '../components/brands';
import { RichSelect, type RichOption } from '../components/rich-select';
import { Button } from '../components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/card';
import { EmptyBoxDoodle } from '../components/doodles';
import { EmptyState } from '../components/empty-state';
import { Label } from '../components/label';
import { VxScope } from '../components/scope';
import { Select } from '../components/select';
import { authFetch, formatBytes } from '../lib/api';
import { cn } from '../lib/utils';

type State = 'downloading' | 'extracting' | 'ready' | 'error';
interface BaseImage {
  id: string;
  deviceType: string;
  version: string;
  state: State;
  bytesTotal?: number;
  bytesDownloaded: number;
  bytesExtracted: number;
  sizeBytes?: number;
  error?: string;
}

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';
const isActive = (image: BaseImage) => image.state === 'downloading' || image.state === 'extracting';

const Progress: React.FC<{ image: BaseImage }> = ({ image }) => {
  const extracting = image.state === 'extracting';
  const done = extracting ? image.bytesExtracted : image.bytesDownloaded;
  const total = extracting ? undefined : image.bytesTotal;
  const percent = total ? Math.min(100, (done / total) * 100) : undefined;
  return (
    <div className='min-w-[200px]'>
      <div className='h-1 w-full bg-foreground/[0.08]'>
        <div
          className={cn('h-full bg-accent transition-[width] duration-500', percent === undefined && 'w-1/3 animate-pulse')}
          style={percent === undefined ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className='mt-1.5 font-mono text-[11px] text-muted-foreground'>
        {extracting ? 'Unpacking' : 'Downloading'} · {formatBytes(done)}
        {total ? ` of ${formatBytes(total)}` : ''}
      </p>
    </div>
  );
};

const BaseImages: React.FC = () => {
  const { data: deviceTypes } = useGetList('device type', {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: 'slug', order: 'ASC' },
  });

  const [images, setImages] = useState<BaseImage[] | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deviceType, setDeviceType] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [version, setVersion] = useState('');
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await authFetch<{ images: BaseImage[] }>('/image-maker/base-images');
      setImages(result.images);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load base images.');
      setImages((current) => current ?? []);
    }
  }, []);

  const anyActive = images?.some(isActive) ?? false;
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), anyActive ? 2000 : 15000);
    return () => window.clearInterval(timer);
  }, [refresh, anyActive]);

  // versions for the chosen device type
  useEffect(() => {
    setVersions([]);
    setVersion('');
    setVersionsError(null);
    if (!deviceType) return undefined;
    let cancelled = false;
    setLoadingVersions(true);
    authFetch<{ versions: string[] }>(`/image-maker/versions?deviceType=${encodeURIComponent(deviceType)}`)
      .then((result) => {
        if (cancelled) return;
        setVersions(result.versions);
        setVersion(result.versions[0] ?? '');
      })
      .catch((error: unknown) => {
        if (!cancelled) setVersionsError(error instanceof Error ? error.message : 'Unable to list versions.');
      })
      .finally(() => {
        if (!cancelled) setLoadingVersions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceType]);

  const deviceTypeOptions = useMemo<RichOption[]>(
    () =>
      (deviceTypes ?? []).map((type) => {
        const slug = String(type.slug);
        const known = lookupDeviceType(slug);
        return { value: slug, label: known?.name ?? slug, detail: known && known.name !== slug ? slug : undefined, icon: <BrandMark text={slug} kind='board' /> };
      }),
    [deviceTypes],
  );

  const existing = useMemo(
    () => images?.find((image) => image.deviceType === deviceType && image.version === version),
    [images, deviceType, version],
  );

  const download = async () => {
    setStarting(true);
    setActionError(null);
    try {
      await authFetch('/image-maker/base-images', { method: 'POST', body: JSON.stringify({ deviceType, version }) });
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to start the download.');
    } finally {
      setStarting(false);
    }
  };

  const remove = async (image: BaseImage) => {
    if (!window.confirm(`Delete the ${image.deviceType} ${image.version} base image? It can be downloaded again later.`)) {
      return;
    }
    setActionError(null);
    try {
      await authFetch(`/image-maker/base-images/${encodeURIComponent(image.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete the base image.');
    }
  };

  const blocked = anyActive && !existing;
  const buttonLabel = existing?.state === 'ready' ? 'Already downloaded' : existing && isActive(existing) ? 'Downloading…' : 'Download';

  return (
    <VxScope className='w-full pb-6'>
      <Title title='Base images' />

      {(loadError || actionError) && (
        <div role='alert' className='mb-4 border border-destructive/40 px-4 py-3 text-[13px] text-destructive'>
          {actionError ?? loadError}
        </div>
      )}

      <Card className='mb-4'>
        <CardHeader>
          <div>
            <CardTitle>Download a base image</CardTitle>
            <CardDescription>Pick a device type and balenaOS version. Already-downloaded images are reused, not fetched again.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end'>
          <div className='grid gap-2'>
            <Label htmlFor='vx-bi-type'>Device type</Label>
            <RichSelect id='vx-bi-type' value={deviceType} onChange={setDeviceType} options={deviceTypeOptions} placeholder='Choose a device type…' />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='vx-bi-version'>balenaOS version</Label>
            <Select
              id='vx-bi-version'
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              disabled={!deviceType || loadingVersions || versions.length === 0}
            >
              {!deviceType && <option value=''>Choose a device type first</option>}
              {deviceType && loadingVersions && <option value=''>Loading versions…</option>}
              {deviceType && !loadingVersions && versions.length === 0 && <option value=''>No versions found</option>}
              {versions.map((candidate, index) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                  {index === 0 ? '  (latest)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant='accent'
            className='md:min-w-[170px]'
            disabled={!deviceType || !version || starting || blocked || existing?.state === 'ready' || (!!existing && isActive(existing))}
            onClick={() => void download()}
          >
            {starting || (existing && isActive(existing)) ? (
              <Loader2 className='animate-spin' aria-hidden />
            ) : existing?.state === 'ready' ? (
              <CheckCircle2 aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            {buttonLabel}
          </Button>
          {versionsError && <p className='text-xs text-destructive md:col-span-3'>{versionsError}</p>}
          {blocked && !versionsError && (
            <p className='text-xs text-muted-foreground md:col-span-3'>
              Another image is downloading. Images download one at a time because they are large.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Library</CardTitle>
            <CardDescription>Downloaded images, ready to be configured for devices</CardDescription>
          </div>
        </CardHeader>
        {images === undefined ? (
          <CardContent className='text-sm text-muted-foreground'>Loading…</CardContent>
        ) : images.length === 0 ? (
          <EmptyState
            className='py-12'
            doodle={<EmptyBoxDoodle />}
            title='No base images yet'
            text='Download one above. You only need one per device type and version.'
          />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[640px] text-sm'>
              <thead>
                <tr className={cn(microLabel, 'text-left')}>
                  <th className='px-5 py-2.5 font-medium'>Device type</th>
                  <th className='px-3 py-2.5 font-medium'>Version</th>
                  <th className='px-3 py-2.5 font-medium'>Status</th>
                  <th className='px-3 py-2.5 text-right font-medium'>Size</th>
                  <th className='px-5 py-2.5 text-right font-medium'>
                    <span className='sr-only'>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border border-t border-border'>
                {images.map((image) => (
                  <tr key={image.id} className='transition-colors hover:bg-foreground/[0.03]'>
                    <td className='px-5 py-3 font-medium'>
                      <BrandLabel text={image.deviceType} kind='board' />
                    </td>
                    <td className='px-3 py-3 font-mono text-xs'>{image.version}</td>
                    <td className='px-3 py-3'>
                      {isActive(image) ? (
                        <Progress image={image} />
                      ) : image.state === 'ready' ? (
                        <Badge variant='success'>Ready</Badge>
                      ) : (
                        <div>
                          <Badge variant='destructive'>Failed</Badge>
                          <p className='mt-1 max-w-xs text-xs text-destructive'>{image.error}</p>
                        </div>
                      )}
                    </td>
                    <td className='px-3 py-3 text-right font-mono text-xs text-muted-foreground'>
                      {image.state === 'ready' ? formatBytes(image.sizeBytes) : '—'}
                    </td>
                    <td className='px-5 py-3 text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={`Delete ${image.deviceType} ${image.version}`}
                        disabled={isActive(image)}
                        onClick={() => void remove(image)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </VxScope>
  );
};

export default BaseImages;
