import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Title, useGetList } from 'react-admin';
import { CheckCircle2, FileJson, FolderOpen, HardDriveDownload, Loader2, Trash2, TriangleAlert, Wand2, X } from 'lucide-react';
import { BrandMark, lookupDeviceType } from '../components/brands';
import DeviceWatch from '../components/DeviceWatch';
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
import {
  baseImageFileName,
  canPickFolder,
  chooseFolder,
  clearlyTooLittleSpace,
  createFlashReadyImage,
  describeSaveError,
  downloadResumable,
  downloadWithBrowser,
  ensureFolderAccess,
  findBaseImage,
  flashReadyFileName,
  forgetFolder,
  formatDuration,
  listBaseImages,
  loadSavedFolder,
  probeFolder,
  removeBaseImage,
  saveBaseImageMeta,
  saveFolder,
  trackProgress,
  uniqueFileName,
  verifyFlashReady,
  verifySavedFile,
  type BaseImageStatus,
  type BootPatch,
  type LocalBaseImage,
  type Progress,
  type SavableFolder,
  type SaveRecovery,
  type Verification,
} from '../lib/imageSave';

interface Ticket {
  job: { id: string; fileName: string; deviceUuid?: string };
  downloadPath: string;
  sizeBytes?: number;
}

interface PatchResponse extends BootPatch {
  fileName: string;
  device?: { id: number; uuid: string };
  sizeBytes?: number;
}

type Provisioning = 'fleet' | 'new' | 'existing';
type Operation = 'base' | 'image' | 'config' | 'stream';

interface Outcome {
  kind: 'image' | 'config' | 'base' | 'stream';
  fileName: string;
  bytes?: number;
  where?: string;
  verification?: Verification;
  deviceUuid?: string;
  at: number;
}

const microLabel = 'font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase';

/** Mutually exclusive choices drawn as square toggle buttons. */
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
  <div role='radiogroup' aria-label={label} className={cn('grid gap-2', options.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
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

/** Appends the resume position to a signed download link. */
const withFrom = (path: string, from: number): string => serverUrl(`${path}${path.includes('?') ? '&' : '?'}from=${from}`);

const Step: React.FC<{ n: number; title: string; state?: 'done' | 'todo' | 'blocked'; children: React.ReactNode }> = ({ n, title, state = 'todo', children }) => (
  <div className={cn('grid gap-2 border px-3.5 py-3', state === 'done' ? 'border-success/40' : 'border-input', state === 'blocked' && 'opacity-60')}>
    <span className='flex items-center gap-2 text-sm font-medium'>
      <span className={cn('grid size-5 place-items-center border font-mono text-[11px]', state === 'done' ? 'border-success text-success' : 'border-input text-muted-foreground')}>
        {state === 'done' ? <CheckCircle2 className='size-3.5' aria-hidden /> : n}
      </span>
      {title}
    </span>
    {children}
  </div>
);

const AddDevice: React.FC = () => {
  const { data: fleets } = useGetList('application', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'app name', order: 'ASC' } });
  const { data: deviceTypes } = useGetList('device type', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'slug', order: 'ASC' } });

  const [searchParams] = useSearchParams();
  const [fleetId, setFleetId] = useState(() => searchParams.get('fleet') ?? '');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState('');
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [development, setDevelopment] = useState<'production' | 'development'>('production');
  const [provisioning, setProvisioning] = useState<Provisioning>('fleet');
  const [existingUuid, setExistingUuid] = useState('');
  const [network, setNetwork] = useState<'ethernet' | 'wifi'>('ethernet');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiKey, setWifiKey] = useState('');
  const [dnsServers, setDnsServers] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<SaveRecovery>('none');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [progress, setProgress] = useState<{ label: string; value: Progress } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [folder, setFolder] = useState<SavableFolder | undefined>();
  const [folderAccess, setFolderAccess] = useState<PermissionState | undefined>();
  const [base, setBase] = useState<BaseImageStatus | 'checking' | undefined>();
  const [library, setLibrary] = useState<LocalBaseImage[]>([]);
  const folderPicker = useMemo(() => canPickFolder(), []);

  const fleet = useMemo(() => (fleets ?? []).find((item) => String(item.id) === fleetId), [fleets, fleetId]);
  const fleetName = String(fleet?.['app name'] ?? '');
  const deviceType = useMemo(() => {
    const id = fleet?.['is for-device type'];
    return String((deviceTypes ?? []).find((type) => type.id === id)?.slug ?? '');
  }, [fleet, deviceTypes]);

  const { data: fleetDevices } = useGetList(
    'device',
    { pagination: { page: 1, perPage: 200 }, sort: { field: 'device name', order: 'ASC' }, filter: { 'belongs to-application': Number(fleetId) } },
    { enabled: Boolean(fleetId) && provisioning === 'existing' },
  );

  useEffect(() => {
    void loadSavedFolder().then(async (saved) => {
      setFolder(saved);
      if (saved?.queryPermission) setFolderAccess(await saved.queryPermission({ mode: 'readwrite' }).catch(() => undefined));
    });
  }, []);

  // versions for the fleet's device type (only the ones balena really offers, so this takes a few seconds)
  useEffect(() => {
    setVersions([]);
    setVersion('');
    setVersionsError(null);
    setTicket(null);
    setOutcome(null);
    if (!deviceType) return undefined;
    let cancelled = false;
    setLoadingVersions(true);
    authFetch<{ versions: string[] }>(`/image-maker/versions?deviceType=${encodeURIComponent(deviceType)}`)
      .then((result) => {
        if (cancelled) return;
        setVersions(result.versions);
        setVersion(result.versions[0] ?? '');
      })
      .catch((e: unknown) => !cancelled && setVersionsError(e instanceof Error ? e.message : 'Unable to list versions.'))
      .finally(() => !cancelled && setLoadingVersions(false));
    return () => {
      cancelled = true;
    };
  }, [deviceType]);

  /** Looks in the images folder: is this OS version already on this computer? */
  const refreshLibrary = useCallback(async () => {
    if (!folder || !deviceType || !version) {
      setBase(undefined);
      return;
    }
    setBase('checking');
    try {
      setBase(await findBaseImage(folder, deviceType, version));
      setLibrary(await listBaseImages(folder));
    } catch {
      // permission not granted yet (it is asked for when a button is pressed) or the folder is gone: treat as unknown
      setBase(undefined);
    }
  }, [folder, deviceType, version]);
  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

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

  const wifiMissing = network === 'wifi' && !wifiSsid.trim();
  const existingMissing = provisioning === 'existing' && !existingUuid;
  const ready = !!fleet && !!deviceType && !!version && !wifiMissing && !existingMissing;

  const payload = useCallback(
    () => ({
      appId: Number(fleetId),
      deviceType,
      version,
      developmentMode: development === 'development',
      provisioning: provisioning === 'fleet' ? 'fleet' : 'device',
      ...(provisioning === 'existing' ? { deviceUuid: existingUuid } : {}),
      network,
      ...(network === 'wifi' ? { wifiSsid: wifiSsid.trim(), wifiKey } : {}),
      ...(dnsServers.trim() ? { dnsServers: dnsServers.trim() } : {}),
    }),
    [fleetId, deviceType, version, development, provisioning, existingUuid, network, wifiSsid, wifiKey, dnsServers],
  );

  // a prepared download belongs to the answers it was prepared with: change one and it has to be prepared again
  const answers = JSON.stringify(payload());
  useEffect(() => {
    setTicket(null);
  }, [answers]);

  const fail = (cause: unknown, where?: string) => {
    const problem = describeSaveError(cause, where);
    if (problem.recovery === 'none') return;
    setError(problem.message);
    setRecovery(problem.recovery);
    if (problem.forgetFolder) {
      setFolder(undefined);
      setBase(undefined);
      void forgetFolder();
    }
  };

  const begin = (operation: Operation) => {
    setError(null);
    setRecovery('none');
    setNotice(null);
    setOutcome(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(operation);
    return controller;
  };
  const finish = () => {
    abortRef.current = null;
    setProgress(null);
    setBusy(null);
  };

  /** The remembered folder must be usable now: allowed, present and writable. Checked before anything is prepared. */
  const useFolder = async (): Promise<SavableFolder> => {
    if (!folder) throw new Error('Choose a folder for your OS images first.');
    if (!(await ensureFolderAccess(folder))) {
      const denied = new Error('denied');
      denied.name = 'NotAllowedError';
      throw denied;
    }
    await probeFolder(folder);
    setFolderAccess('granted');
    return folder;
  };

  const pickFolder = async () => {
    setError(null);
    setRecovery('none');
    try {
      const chosen = await chooseFolder();
      await probeFolder(chosen); // fail now, not after something has been prepared
      setFolder(chosen);
      setFolderAccess('granted');
      await saveFolder(chosen);
    } catch (e) {
      fail(e, 'the folder you chose');
    }
  };

  const clearFolder = () => {
    setFolder(undefined);
    setFolderAccess(undefined);
    setBase(undefined);
    setLibrary([]);
    void forgetFolder();
  };

  const track = (label: string) => {
    let tracker = trackProgress(undefined);
    return {
      set: (written: number, total?: number) => setProgress({ label, value: tracker(written, total) }),
      reset: (total?: number) => {
        tracker = trackProgress(total);
      },
    };
  };

  /** Downloads the balenaOS base image into the images folder, once; later images are made from it without downloading. */
  const downloadBase = async () => {
    const controller = begin('base');
    let where = folder?.name;
    try {
      const target = await useFolder();
      where = target.name;
      if (await clearlyTooLittleSpace(2.5 * 1024 ** 3)) {
        setNotice('Your browser reports very little free space. The image needs roughly 2 to 8 GB; the save fails cleanly if it runs out.');
      }
      const link = await authFetch<Ticket>('/image-maker/os-downloads', { method: 'POST', body: JSON.stringify({ deviceType, version }) });
      const name = baseImageFileName(deviceType, version);
      const file = await target.getFileHandle(name, { create: true }); // appears only when complete
      const progressFor = track('Downloading balenaOS');
      progressFor.reset(link.sizeBytes);
      const bytes = await downloadResumable({
        urlFor: (from) => withFrom(link.downloadPath, from),
        file,
        knownTotal: link.sizeBytes,
        signal: controller.signal,
        onProgress: progressFor.set,
        onRetry: (info) =>
          setNotice(info.reason === 'restarting from the beginning' ? 'Restarting the download from the beginning…' : `The connection was interrupted. Resuming from ${formatBytes(info.written)} (attempt ${info.attempt + 1})…`),
      });
      setNotice(null);
      const verification = await verifySavedFile(file, bytes);
      if (!verification.ok) throw new Error(`${verification.problem} Download the base image again.`);
      await saveBaseImageMeta(target, name, { deviceType, version, size: bytes, savedAt: new Date().toISOString() });
      setOutcome({ kind: 'base', fileName: name, bytes, where: target.name, verification, at: Date.now() });
      await refreshLibrary();
    } catch (e) {
      fail(e, where);
    } finally {
      finish();
    }
  };

  /** Makes the flash-ready image on this computer from the local base image, registering a device first when asked. */
  const createImage = async () => {
    const controller = begin('image');
    let registered: string | undefined;
    let where = folder?.name;
    try {
      const target = await useFolder();
      where = target.name;
      const status = await findBaseImage(target, deviceType, version);
      if (status.state !== 'present') throw new Error('The base image is not on this computer yet. Download it first.');
      setProgress({ label: 'Preparing the configuration', value: { written: 0, bytesPerSecond: 0 } });
      const patch = await authFetch<PatchResponse>('/image-maker/boot-patch', { method: 'POST', body: JSON.stringify(payload()) });
      registered = patch.device?.uuid;
      const name = await uniqueFileName(target, flashReadyFileName(fleetName, deviceType, version)); // never replaces an image
      const file = await target.getFileHandle(name, { create: true });
      const progressFor = track('Creating the flash-ready image');
      progressFor.reset(status.file.size);
      const bytes = await createFlashReadyImage({
        base: status.file,
        target: file,
        patch,
        signal: controller.signal,
        onProgress: (copied, total) => progressFor.set(copied, total),
      });
      const verification = await verifyFlashReady(file, bytes, patch);
      setOutcome({ kind: 'image', fileName: name, bytes, where: target.name, verification, deviceUuid: registered, at: Date.now() });
    } catch (e) {
      fail(e, where);
      if (registered) {
        setNotice(
          `The device ${registered.slice(0, 7)} was registered before this failed. Choose "Existing device" to make its image again without registering another.`,
        );
      }
    } finally {
      finish();
    }
  };

  const downloadConfig = async () => {
    begin('config');
    try {
      const config = await authFetch<{ uuid?: string }>('/image-maker/config', { method: 'POST', body: JSON.stringify(payload()) });
      saveJson(config, 'config.json');
      setOutcome({ kind: 'config', fileName: 'config.json', deviceUuid: provisioning !== 'fleet' ? config.uuid : undefined, at: Date.now() });
    } catch (e) {
      fail(e);
      setError((previous) => previous ?? 'Unable to generate the config.');
    } finally {
      finish();
    }
  };

  /** Browsers that cannot write into a chosen folder: one download of the finished image, streamed by the server. */
  const downloadStreamed = async () => {
    begin('stream');
    try {
      const current = await authFetch<Ticket>('/image-maker/images', { method: 'POST', body: JSON.stringify(payload()) });
      downloadWithBrowser(serverUrl(current.downloadPath), current.job.fileName);
      setOutcome({ kind: 'stream', fileName: current.job.fileName, where: "your browser's downloads folder", deviceUuid: current.job.deviceUuid, at: Date.now() });
    } catch (e) {
      fail(e);
    } finally {
      finish();
    }
  };

  const removeFromLibrary = async (name: string) => {
    if (!folder) return;
    try {
      await removeBaseImage(folder, name);
    } catch (e) {
      fail(e, folder.name);
    }
    await refreshLibrary();
  };

  const baseState = base === 'checking' || base === undefined ? base : base.state;
  const baseReady = baseState === 'present';
  const working = busy !== null;
  const progressPercent = progress?.value.percent;

  return (
    <VxScope className='w-full pb-6'>
      <Title title='Add device' />
      {error && (
        <div role='alert' className='mb-4 flex items-start gap-2 border border-destructive/40 px-4 py-3 text-[13px] text-destructive'>
          <TriangleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
          <div className='grid gap-2'>
            <span>{error}</span>
            {recovery !== 'none' && (
              <span className='flex flex-wrap gap-2'>
                {recovery === 'choose-folder' && folderPicker && (
                  <Button variant='outline' size='sm' disabled={working} onClick={() => void pickFolder()}>
                    Choose another folder
                  </Button>
                )}
                {recovery === 'redownload' && (
                  <Button variant='outline' size='sm' disabled={working || !folder} onClick={() => void downloadBase()}>
                    Download the base image again
                  </Button>
                )}
                {(recovery === 'allow-access' || recovery === 'retry' || recovery === 'choose-folder') && ready && (
                  <Button variant='outline' size='sm' disabled={working} onClick={() => void (baseReady ? createImage() : downloadBase())}>
                    Try again
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <div className='grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
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
                  onChange={(event) => setVersion(event.target.value)}
                  disabled={!deviceType || loadingVersions || versions.length === 0}
                >
                  {!deviceType && <option value=''>Choose a fleet first</option>}
                  {deviceType && loadingVersions && <option value=''>Checking balena for available versions…</option>}
                  {versions.map((candidate, index) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                      {index === 0 ? '  (latest)' : ''}
                    </option>
                  ))}
                </Select>
                {loadingVersions && (
                  <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Loader2 className='size-3.5 animate-spin' aria-hidden />
                    Checking which versions balena offers (a few seconds the first time)…
                  </p>
                )}
                {versionsError && <p className='text-xs text-destructive'>{versionsError}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>2. Mode, device and network</CardTitle>
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
                <Label>Which device is this for?</Label>
                <Choice
                  label='Provisioning'
                  value={provisioning}
                  onChange={setProvisioning}
                  options={[
                    { value: 'fleet', title: 'Any device (fleet-wide)', hint: 'One image for many devices. Each registers itself on first boot.' },
                    { value: 'new', title: 'A new device', hint: 'Registers one device now. The image works for that device only.' },
                    { value: 'existing', title: 'A registered device', hint: 'Make the image for a device that is already in this fleet.' },
                  ]}
                />
                {provisioning === 'existing' && (
                  <div className='grid gap-2 pt-1'>
                    <Label htmlFor='vx-ad-device'>Device</Label>
                    <Select id='vx-ad-device' value={existingUuid} onChange={(event) => setExistingUuid(event.target.value)} disabled={!fleetId}>
                      <option value=''>{fleetId ? ((fleetDevices ?? []).length ? 'Choose a device…' : 'No devices in this fleet yet') : 'Choose a fleet first'}</option>
                      {(fleetDevices ?? []).map((device) => (
                        <option key={String(device.id)} value={String(device.uuid)}>
                          {String(device['device name'] ?? device.uuid)} · {String(device.uuid).slice(0, 7)}
                        </option>
                      ))}
                    </Select>
                    <p className='text-xs text-muted-foreground'>A new key is created for that device and written into the image. Its old key keeps working until the device is reflashed.</p>
                  </div>
                )}
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
                    {/* off + a field name that is not a login: password managers must not fill their own credentials in here */}
                    <Input
                      id='vx-ad-ssid'
                      name='device-wifi-network-name'
                      autoComplete='off'
                      autoCapitalize='off'
                      spellCheck={false}
                      data-lpignore='true'
                      data-1p-ignore='true'
                      value={wifiSsid}
                      maxLength={32}
                      onChange={(event) => setWifiSsid(event.target.value)}
                    />
                  </div>
                  <div className='grid gap-2'>
                    <Label htmlFor='vx-ad-key'>Password</Label>
                    <Input
                      id='vx-ad-key'
                      name='device-wifi-network-key'
                      type='password'
                      autoComplete='new-password'
                      data-lpignore='true'
                      data-1p-ignore='true'
                      value={wifiKey}
                      maxLength={63}
                      onChange={(event) => setWifiKey(event.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className='grid gap-2'>
                <Label htmlFor='vx-ad-dns'>DNS servers (optional)</Label>
                <Input
                  id='vx-ad-dns'
                  name='device-dns-servers'
                  autoComplete='off'
                  value={dnsServers}
                  maxLength={80}
                  placeholder='for example 192.168.1.1'
                  onChange={(event) => setDnsServers(event.target.value)}
                />
                <p className='text-sm text-muted-foreground'>Only needed when your server names exist on a private DNS. Separate several addresses with commas.</p>
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
            {folderPicker ? (
              <>
                <Step n={1} title='Choose where images are kept' state={folder ? 'done' : 'todo'}>
                  <p className='text-xs text-muted-foreground'>A folder on this computer. balenaOS is downloaded into it once and reused for every device, so it is not downloaded again.</p>
                  <span className='flex items-center gap-2 text-sm'>
                    <FolderOpen className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                    <span className='min-w-0 truncate' title={folder?.name}>
                      {folder ? folder.name : 'No folder chosen yet'}
                    </span>
                  </span>
                  {folder && folderAccess === 'prompt' && (
                    <span className='text-xs text-muted-foreground'>The browser will ask you to allow access to this folder again when you continue.</span>
                  )}
                  {folder && folderAccess === 'denied' && <span className='text-xs text-destructive'>The browser has blocked this folder. Choose it again to allow access.</span>}
                  <span className='flex flex-wrap gap-2'>
                    <Button variant={folder ? 'outline' : 'accent'} size='sm' disabled={working} onClick={() => void pickFolder()}>
                      {folder ? 'Change folder' : 'Choose a folder'}
                    </Button>
                    {folder && (
                      <Button variant='ghost' size='sm' disabled={working} onClick={clearFolder}>
                        Forget folder
                      </Button>
                    )}
                  </span>
                </Step>

                <Step n={2} title={`Base image${version ? `: balenaOS ${version}` : ''}`} state={baseReady ? 'done' : folder && version ? 'todo' : 'blocked'}>
                  {!folder || !version ? (
                    <p className='text-xs text-muted-foreground'>{!folder ? 'Choose a folder first.' : 'Choose a fleet and a version first.'}</p>
                  ) : baseState === 'checking' ? (
                    <p className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <Loader2 className='size-3.5 animate-spin' aria-hidden />
                      Looking in your folder…
                    </p>
                  ) : baseState === 'present' && base && typeof base === 'object' && base.state === 'present' ? (
                    <>
                      <p className='text-xs text-success'>
                        On this computer: <code>{base.name}</code> ({formatBytes(base.file.size)}). It will be reused, nothing to download.
                      </p>
                      <span>
                        <Button variant='ghost' size='sm' disabled={working} onClick={() => void downloadBase()}>
                          Download it again
                        </Button>
                      </span>
                    </>
                  ) : (
                    <>
                      <p className='text-xs text-muted-foreground'>
                        {baseState === 'incomplete'
                          ? 'A file with this name is in the folder but it is not complete. Download it again.'
                          : 'Not on this computer yet. The download is about 200 MB and takes up to 1 GB on disk. It is checked against balena\'s checksum.'}
                      </p>
                      <span>
                        <Button variant={ready || deviceType ? 'accent' : 'outline'} size='sm' disabled={working || !deviceType || !version} onClick={() => void downloadBase()}>
                          {busy === 'base' ? <Loader2 className='animate-spin' aria-hidden /> : <HardDriveDownload aria-hidden />}
                          Download base image
                        </Button>
                      </span>
                    </>
                  )}
                </Step>

                <Step n={3} title='Create the flash-ready image' state={outcome?.kind === 'image' ? 'done' : baseReady && ready ? 'todo' : 'blocked'}>
                  <p className='text-xs text-muted-foreground'>
                    Copies the base image and writes this fleet&apos;s configuration into the copy, here on your computer.
                    {provisioning === 'new' && ' A new device is registered now.'}
                  </p>
                  <span>
                    <Button variant='accent' size='sm' disabled={working || !baseReady || !ready} onClick={() => void createImage()}>
                      {busy === 'image' ? <Loader2 className='animate-spin' aria-hidden /> : <Wand2 aria-hidden />}
                      Create image
                    </Button>
                  </span>
                  {baseReady && !ready && <span className='text-xs text-muted-foreground'>Finish the choices on the left first.</span>}
                </Step>
              </>
            ) : (
              <Step n={1} title='Download the flash-ready image' state={outcome?.kind === 'stream' ? 'done' : ready ? 'todo' : 'blocked'}>
                <p className='text-xs text-muted-foreground'>
                  This browser cannot keep a library of images in a folder, so the finished image is streamed to your downloads folder in one go. Use Chrome or Edge to keep a base image and
                  reuse it.
                </p>
                <span>
                  <Button variant='accent' size='sm' disabled={working || !ready} onClick={() => void downloadStreamed()}>
                    {busy === 'stream' ? <Loader2 className='animate-spin' aria-hidden /> : <HardDriveDownload aria-hidden />}
                    Download flash-ready image
                  </Button>
                </span>
              </Step>
            )}

            <div className='grid gap-2 border-t border-border pt-3'>
              <span className={microLabel}>Already flashed a drive?</span>
              <Button variant='outline' disabled={working || !ready} onClick={() => void downloadConfig()}>
                {busy === 'config' ? <Loader2 className='animate-spin' aria-hidden /> : <FileJson aria-hidden />}
                Download config.json only
              </Button>
              <p className='text-xs text-muted-foreground'>
                Replaces <code>config.json</code> on the boot partition of a drive that already runs balenaOS. It does not register a device by itself: with &quot;Any device&quot; the device registers on its
                first boot.
              </p>
            </div>

            {notice && <p className='border border-input px-3 py-2 text-xs'>{notice}</p>}

            {working && progress && (
              <div className='grid gap-2 border border-accent/40 px-3.5 py-3'>
                <p className='flex items-center gap-2 text-sm'>
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                  {progress.label}
                  {progressPercent !== undefined ? ` · ${Math.floor(progressPercent)}%` : ''}
                </p>
                {progressPercent !== undefined && (
                  <div className='h-1.5 w-full bg-foreground/10' role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progressPercent)}>
                    <div className='h-full bg-accent transition-[width]' style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
                <p className='text-xs text-muted-foreground'>
                  {formatBytes(progress.value.written)}
                  {progress.value.total ? ` of ${formatBytes(progress.value.total)}` : ''}
                  {progress.value.bytesPerSecond > 0 ? ` · ${formatBytes(progress.value.bytesPerSecond)}/s` : ''}
                  {progress.value.etaSeconds !== undefined ? ` · about ${formatDuration(progress.value.etaSeconds)} left` : ''}
                </p>
                <p className='text-xs text-muted-foreground'>If the connection drops it continues where it stopped. Keep this page open.</p>
                <span>
                  <Button variant='outline' size='sm' onClick={() => abortRef.current?.abort()}>
                    <X aria-hidden />
                    Cancel
                  </Button>
                </span>
              </div>
            )}
            {busy && !progress && (
              <p className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Loader2 className='size-3.5 animate-spin' aria-hidden />
                {busy === 'base' ? 'Preparing the download…' : busy === 'config' ? 'Generating the configuration…' : 'Working…'}
              </p>
            )}

            {outcome && (
              <div className='grid gap-3'>
                <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
                  <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
                  <span>
                    {outcome.kind === 'config' ? (
                      <>
                        <code>config.json</code> downloaded.
                      </>
                    ) : outcome.kind === 'stream' ? (
                      <>
                        <code>{outcome.fileName}</code> is downloading to {outcome.where}.
                      </>
                    ) : (
                      <>
                        Saved <code>{outcome.fileName}</code>
                        {outcome.bytes ? ` (${formatBytes(outcome.bytes)})` : ''} in {outcome.where}.
                      </>
                    )}
                    {outcome.deviceUuid && (
                      <span className='block'>
                        Device <code>{outcome.deviceUuid.slice(0, 7)}</code> is registered. It shows as offline until it boots with this config.
                      </span>
                    )}
                    {outcome.verification?.ok && <span className='block text-muted-foreground'>Checked: the file was read back and is complete.</span>}
                    {outcome.verification && !outcome.verification.ok && (
                      <span className='block text-destructive'>{outcome.verification.problem} Do not use this file; create it again.</span>
                    )}
                    {outcome.kind === 'base' && <span className='block text-muted-foreground'>Next: create the flash-ready image (step 3).</span>}
                  </span>
                </p>
                {(outcome.kind === 'image' || outcome.kind === 'config' || outcome.kind === 'stream') && fleet && (
                  <DeviceWatch
                    fleetId={Number(fleetId)}
                    fleetName={fleetName}
                    expectedUuid={outcome.deviceUuid}
                    since={outcome.at}
                    made={outcome.kind === 'config' ? 'config' : 'image'}
                  />
                )}
              </div>
            )}

            {folderPicker && folder && library.length > 0 && (
              <details className='border border-input px-3.5 py-2.5'>
                <summary className='cursor-pointer text-xs text-muted-foreground'>Base images on this computer ({library.length})</summary>
                <ul className='mt-2 grid gap-1.5'>
                  {library.map((item) => (
                    <li key={item.name} className='flex items-center justify-between gap-2 text-xs'>
                      <span className='min-w-0 truncate' title={item.name}>
                        {item.meta.deviceType} · {item.meta.version} · {formatBytes(item.meta.size)}
                      </span>
                      <Button variant='ghost' size='sm' disabled={working} aria-label={`Delete ${item.name}`} onClick={() => void removeFromLibrary(item.name)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </VxScope>
  );
};

export default AddDevice;
