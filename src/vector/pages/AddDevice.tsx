import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Title, useGetList } from 'react-admin';
import { CheckCircle2, Download, FileJson, HardDriveDownload, Loader2, TriangleAlert } from 'lucide-react';
import { BrandMark, lookupDeviceType } from '../components/brands';
import { RichSelect, type RichOption } from '../components/rich-select';
import { Button } from '../components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/card';
import { Input } from '../components/input';
import { Label } from '../components/label';
import { VxScope } from '../components/scope';
import { Select } from '../components/select';
import { authFetch, formatBytes } from '../lib/api';
import { cn } from '../lib/utils';
import { serverUrl } from '../../lib/serverUrl';

interface BaseImage {
  deviceType: string;
  version: string;
  state: string;
}
interface Job {
  id: string;
  state: 'building' | 'ready' | 'error';
  fileName: string;
  sizeBytes?: number;
  error?: string;
  deviceUuid?: string;
}

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

/** Two mutually exclusive choices drawn as square toggle buttons. */
const Choice = <T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; title: string; hint: string }>;
  label: string;
}) => (
  <div role='radiogroup' aria-label={label} className='grid gap-2 sm:grid-cols-2'>
    {options.map((option) => (
      <button
        key={option.value}
        type='button'
        role='radio'
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          'border px-3.5 py-3 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring',
          value === option.value ? 'border-accent bg-accent/[0.07]' : 'border-input hover:border-foreground/30',
        )}
      >
        <span className='block text-sm font-medium'>{option.title}</span>
        <span className='mt-0.5 block text-xs text-muted-foreground'>{option.hint}</span>
      </button>
    ))}
  </div>
);

const saveJson = (data: unknown, fileName: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const AddDevice: React.FC = () => {
  const { data: fleets } = useGetList('application', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'app name', order: 'ASC' } });
  const { data: deviceTypes } = useGetList('device type', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'slug', order: 'ASC' } });

  const [searchParams] = useSearchParams();
  const [fleetId, setFleetId] = useState(() => searchParams.get('fleet') ?? '');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [downloaded, setDownloaded] = useState<BaseImage[]>([]);
  const [development, setDevelopment] = useState<'production' | 'development'>('production');
  const [provisioning, setProvisioning] = useState<'fleet' | 'device'>('fleet');
  const [registeredUuid, setRegisteredUuid] = useState<string | undefined>();
  const [network, setNetwork] = useState<'ethernet' | 'wifi'>('ethernet');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiKey, setWifiKey] = useState('');
  const [dnsServers, setDnsServers] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'config' | 'image' | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [downloadPath, setDownloadPath] = useState<string | undefined>();

  const fleet = useMemo(() => (fleets ?? []).find((item) => String(item.id) === fleetId), [fleets, fleetId]);
  const deviceType = useMemo(() => {
    const id = fleet?.['is for-device type'];
    return String((deviceTypes ?? []).find((type) => type.id === id)?.slug ?? '');
  }, [fleet, deviceTypes]);

  useEffect(() => {
    authFetch<{ images: BaseImage[] }>('/image-maker/base-images')
      .then((result) => setDownloaded(result.images))
      .catch(() => undefined);
  }, []);

  // versions for the fleet's device type
  useEffect(() => {
    setVersions([]);
    setVersion('');
    setVersionsError(null);
    setJob(null);
    setDownloadPath(undefined);
    setRegisteredUuid(undefined);
    if (!deviceType) return undefined;
    let cancelled = false;
    setLoadingVersions(true);
    authFetch<{ versions: string[] }>(`/image-maker/versions?deviceType=${encodeURIComponent(deviceType)}`)
      .then((result) => {
        if (cancelled) return;
        setVersions(result.versions);
        // prefer a version that is already downloaded, then the latest
        const have = result.versions.find((candidate) => downloaded.some((d) => d.deviceType === deviceType && d.version === candidate && d.state === 'ready'));
        setVersion(have ?? result.versions[0] ?? '');
      })
      .catch((e: unknown) => !cancelled && setVersionsError(e instanceof Error ? e.message : 'Unable to list versions.'))
      .finally(() => !cancelled && setLoadingVersions(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceType]);

  const fleetOptions = useMemo<RichOption[]>(
    () =>
      (fleets ?? []).map((item) => {
        const slug = String((deviceTypes ?? []).find((type) => type.id === item['is for-device type'])?.slug ?? '');
        return {
          value: String(item.id),
          label: String(item['app name'] ?? item.slug ?? item.id),
          detail: slug ? lookupDeviceType(slug)?.name ?? slug : undefined,
          icon: slug ? <BrandMark text={slug} kind='board' /> : undefined,
        };
      }),
    [fleets, deviceTypes],
  );

  const haveBase = downloaded.some((d) => d.deviceType === deviceType && d.version === version && d.state === 'ready');
  const wifiMissing = network === 'wifi' && !wifiSsid.trim();
  const ready = !!fleet && !!deviceType && !!version && !wifiMissing;

  const payload = () => ({
    appId: Number(fleetId),
    deviceType,
    version,
    developmentMode: development === 'development',
    provisioning,
    network,
    ...(network === 'wifi' ? { wifiSsid: wifiSsid.trim(), wifiKey } : {}),
    ...(dnsServers.trim() ? { dnsServers: dnsServers.trim() } : {}),
  });

  const downloadConfig = async () => {
    setBusy('config');
    setError(null);
    try {
      const config = await authFetch<{ uuid?: string }>('/image-maker/config', { method: 'POST', body: JSON.stringify(payload()) });
      saveJson(config, 'config.json');
      setRegisteredUuid(provisioning === 'device' ? config.uuid : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate the config.');
    } finally {
      setBusy(null);
    }
  };

  const prepareImage = async () => {
    setBusy('image');
    setError(null);
    setDownloadPath(undefined);
    try {
      const result = await authFetch<{ job: Job }>('/image-maker/images', { method: 'POST', body: JSON.stringify(payload()) });
      setJob(result.job);
      setRegisteredUuid(result.job.deviceUuid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare the image.');
      setBusy(null);
    }
  };

  // poll while the image is being prepared
  const jobId = job?.state === 'building' ? job.id : undefined;
  const pollRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!jobId) return undefined;
    pollRef.current = window.setInterval(() => {
      authFetch<{ job: Job; downloadPath?: string }>(`/image-maker/images/${jobId}`)
        .then((result) => {
          setJob(result.job);
          if (result.job.state !== 'building') {
            setDownloadPath(result.downloadPath);
            setBusy(null);
            if (result.job.state === 'error') setError(result.job.error ?? 'The image could not be prepared.');
          }
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Lost track of the image.');
          setBusy(null);
          setJob(null);
        });
    }, 1500);
    return () => window.clearInterval(pollRef.current);
  }, [jobId]);

  return (
    <VxScope className='w-full pb-6'>
      <Title title='Add device' />
      {error && (
        <div role='alert' className='mb-4 flex items-start gap-2 border border-destructive/40 px-4 py-3 text-[13px] text-destructive'>
          <TriangleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
          {error}
        </div>
      )}

      <div className='grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]'>
      <div className='grid gap-4'>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>1. Fleet and operating system</CardTitle>
            <CardDescription>The device type comes from the fleet.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='vx-ad-fleet'>Fleet</Label>
            <RichSelect id='vx-ad-fleet' value={fleetId} onChange={setFleetId} options={fleetOptions} placeholder='Choose a fleet…' />
            {deviceType && (
              <p className='text-xs text-muted-foreground'>
                {lookupDeviceType(deviceType)?.name ?? deviceType}
                <span className='ml-2 font-mono opacity-70'>{deviceType}</span>
              </p>
            )}
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='vx-ad-version'>balenaOS version</Label>
            <Select
              id='vx-ad-version'
              value={version}
              onChange={(event) => {
                setVersion(event.target.value);
                setJob(null);
                setDownloadPath(undefined);
              }}
              disabled={!deviceType || loadingVersions || versions.length === 0}
            >
              {!deviceType && <option value=''>Choose a fleet first</option>}
              {deviceType && loadingVersions && <option value=''>Loading versions…</option>}
              {versions.map((candidate, index) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                  {index === 0 ? '  (latest)' : ''}
                  {downloaded.some((d) => d.deviceType === deviceType && d.version === candidate && d.state === 'ready') ? '  · downloaded' : ''}
                </option>
              ))}
            </Select>
            {versionsError && <p className='text-xs text-destructive'>{versionsError}</p>}
            {deviceType && version && (
              <p className={cn('flex items-center gap-1.5 text-xs', haveBase ? 'text-success' : 'text-muted-foreground')}>
                {haveBase ? <CheckCircle2 className='size-3.5' aria-hidden /> : null}
                {haveBase ? (
                  'Base image is downloaded and will be reused.'
                ) : (
                  <>
                    Not downloaded yet.{' '}
                    <Link to='/base-images' className='text-accent underline underline-offset-2'>
                      Download it under Base images
                    </Link>{' '}
                    to build an image.
                  </>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>2. Mode and network</CardTitle>
            <CardDescription>Written into the device&apos;s config.json.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='grid gap-5'>
          <div className='grid gap-2'>
            <Label>Mode</Label>
            <Choice
              label='Mode'
              value={development}
              onChange={setDevelopment}
              options={[
                { value: 'production', title: 'Production', hint: 'Locked down. Recommended for deployed devices.' },
                { value: 'development', title: 'Development', hint: 'Local mode and open SSH, for testing.' },
              ]}
            />
          </div>
          <div className='grid gap-2'>
            <Label>Provisioning</Label>
            <Choice
              label='Provisioning'
              value={provisioning}
              onChange={setProvisioning}
              options={[
                { value: 'fleet', title: 'Fleet-wide', hint: 'One image for many devices. Each registers itself on first boot.' },
                { value: 'device', title: 'This device only', hint: 'Registers the device now. The image works for one device.' },
              ]}
            />
          </div>
          <div className='grid gap-2'>
            <Label>Network</Label>
            <Choice
              label='Network'
              value={network}
              onChange={setNetwork}
              options={[
                { value: 'ethernet', title: 'Ethernet', hint: 'Plug in a cable. No setup needed.' },
                { value: 'wifi', title: 'Wi-Fi', hint: 'Join a wireless network on first boot.' },
              ]}
            />
          </div>
          {network === 'wifi' && (
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='grid gap-2'>
                <Label htmlFor='vx-ad-ssid'>Network name (SSID)</Label>
                <Input id='vx-ad-ssid' value={wifiSsid} maxLength={32} onChange={(event) => setWifiSsid(event.target.value)} />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='vx-ad-key'>Password</Label>
                <Input id='vx-ad-key' type='password' autoComplete='off' value={wifiKey} maxLength={63} onChange={(event) => setWifiKey(event.target.value)} />
              </div>
            </div>
          )}
          <div className='grid gap-2'>
            <Label htmlFor='vx-ad-dns'>DNS servers (optional)</Label>
            <Input
              id='vx-ad-dns'
              value={dnsServers}
              maxLength={80}
              placeholder='for example 192.168.1.1'
              onChange={(event) => setDnsServers(event.target.value)}
            />
            <p className='text-sm text-muted-foreground'>
              Only needed when your server names exist on a private DNS. Separate several addresses with commas.
            </p>
          </div>
        </CardContent>
      </Card>

      </div>
      <Card className='xl:sticky xl:top-20'>
        <CardHeader>
          <div>
            <CardTitle>3. Get your files</CardTitle>
            <CardDescription>The config contains a fleet key. Keep it private and do not share it.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='grid gap-3'>
          <Button variant='outline' disabled={!ready || busy !== null} onClick={() => void downloadConfig()}>
            {busy === 'config' ? <Loader2 className='animate-spin' aria-hidden /> : <FileJson aria-hidden />}
            Download config.json only
          </Button>
          {downloadPath && job?.state === 'ready' ? (
            <Button variant='accent' asChild>
              <a href={serverUrl(downloadPath)} download={job.fileName}>
                <Download aria-hidden />
                Download image ({formatBytes(job.sizeBytes)})
              </a>
            </Button>
          ) : (
            <Button variant='accent' disabled={!ready || !haveBase || busy !== null} onClick={() => void prepareImage()}>
              {busy === 'image' ? <Loader2 className='animate-spin' aria-hidden /> : <HardDriveDownload aria-hidden />}
              {busy === 'image' ? 'Preparing image…' : 'Prepare flash-ready image'}
            </Button>
          )}
          {registeredUuid && (
            <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
              <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
              <span>
                Device registered: <code>{registeredUuid.slice(0, 7)}</code>. It shows as offline until it boots with this config.
              </span>
            </p>
          )}
          <p className='text-xs leading-relaxed text-muted-foreground'>
            The image is a private copy of the base image with this fleet&apos;s config. The link is valid for ten minutes and
            the copy is removed after thirty. Already flashed a drive? Download the config only and replace
            <code className='mx-1'>config.json</code> on its boot partition.
          </p>
        </CardContent>
      </Card>
      </div>
    </VxScope>
  );
};

export default AddDevice;
