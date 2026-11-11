import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Title, useGetList } from 'react-admin';
import { CheckCircle2, FileJson, FolderOpen, HardDriveDownload, Loader2, TriangleAlert, X } from 'lucide-react';
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
import {
  canPickFile,
  canPickFolder,
  chooseFile,
  chooseFolder,
  clearlyTooLittleSpace,
  copyResponseToFile,
  describeSaveError,
  downloadWithBrowser,
  ensureFolderAccess,
  forgetFolder,
  formatDuration,
  loadSavedFolder,
  probeFolder,
  saveFolder,
  trackProgress,
  uniqueFileName,
  verifySavedFile,
  type Progress,
  type SavableFile,
  type SavableFolder,
  type SaveRecovery,
  type Verification,
} from '../lib/imageSave';

interface Job {
  id: string;
  state: 'ready';
  fileName: string;
  deviceUuid?: string;
}
interface Ticket {
  job: Job;
  downloadPath: string;
}

/** The file name the server will use, so the save dialog can suggest it before the image is prepared. */
const imageFileName = (deviceType: string, version: string): string =>
  `vector-${deviceType}-${version.replace(/[^0-9A-Za-z.-]/g, '_')}.img`;

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
  const [development, setDevelopment] = useState<'production' | 'development'>('production');
  const [provisioning, setProvisioning] = useState<'fleet' | 'device'>('fleet');
  const [registeredUuid, setRegisteredUuid] = useState<string | undefined>();
  const [network, setNetwork] = useState<'ethernet' | 'wifi'>('ethernet');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiKey, setWifiKey] = useState('');
  const [dnsServers, setDnsServers] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'config' | 'image' | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [folder, setFolder] = useState<SavableFolder | undefined>();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recovery, setRecovery] = useState<SaveRecovery>('none');
  const [warning, setWarning] = useState<string | null>(null);
  const [folderAccess, setFolderAccess] = useState<PermissionState | undefined>();
  const [savedTo, setSavedTo] = useState<{ fileName: string; bytes: number; where: string; verification?: Verification } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const folderPicker = useMemo(() => canPickFolder(), []);

  const fleet = useMemo(() => (fleets ?? []).find((item) => String(item.id) === fleetId), [fleets, fleetId]);
  const deviceType = useMemo(() => {
    const id = fleet?.['is for-device type'];
    return String((deviceTypes ?? []).find((type) => type.id === id)?.slug ?? '');
  }, [fleet, deviceTypes]);

  useEffect(() => {
    void loadSavedFolder().then(async (saved) => {
      setFolder(saved);
      if (saved?.queryPermission) setFolderAccess(await saved.queryPermission({ mode: 'readwrite' }).catch(() => undefined));
    });
  }, []);

  // versions for the fleet's device type
  useEffect(() => {
    setVersions([]);
    setVersion('');
    setVersionsError(null);
    setTicket(null);
    setSavedTo(null);
    setRegisteredUuid(undefined);
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

  const wifiMissing = network === 'wifi' && !wifiSsid.trim();
  const ready = !!fleet && !!deviceType && !!version && !wifiMissing;

  const payload = useCallback(
    () => ({
      appId: Number(fleetId),
      deviceType,
      version,
      developmentMode: development === 'development',
      provisioning,
      network,
      ...(network === 'wifi' ? { wifiSsid: wifiSsid.trim(), wifiKey } : {}),
      ...(dnsServers.trim() ? { dnsServers: dnsServers.trim() } : {}),
    }),
    [fleetId, deviceType, version, development, provisioning, network, wifiSsid, wifiKey, dnsServers],
  );

  // a prepared image belongs to the answers it was prepared with: change one and it has to be prepared again
  const answers = JSON.stringify(payload());
  useEffect(() => {
    setTicket(null);
    setSavedTo(null);
  }, [answers]);

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

  const showProblem = (cause: unknown, where?: string) => {
    const problem = describeSaveError(cause, where);
    if (problem.recovery === 'none') return;
    setError(problem.message);
    setRecovery(problem.recovery);
    if (problem.forgetFolder) {
      setFolder(undefined);
      void forgetFolder();
    }
  };

  const pickFolder = async () => {
    setError(null);
    setRecovery('none');
    try {
      const chosen = await chooseFolder();
      await probeFolder(chosen); // fail now, not after the image has been prepared
      setFolder(chosen);
      setFolderAccess('granted');
      await saveFolder(chosen);
    } catch (e) {
      showProblem(e, 'the folder you chose');
    }
  };

  const clearFolder = () => {
    setFolder(undefined);
    setFolderAccess(undefined);
    void forgetFolder();
  };

  /** The prepared image if it is still valid (with a fresh link), otherwise a newly prepared one. */
  const obtainTicket = async (): Promise<Ticket> => {
    if (ticket) {
      try {
        const fresh = await authFetch<Ticket>(`/image-maker/images/${ticket.job.id}`);
        setTicket(fresh);
        return fresh;
      } catch {
        /* expired or the server restarted: prepare it again below */
      }
    }
    const created = await authFetch<Ticket>('/image-maker/images', { method: 'POST', body: JSON.stringify(payload()) });
    setTicket(created);
    setRegisteredUuid(created.job.deviceUuid);
    return created;
  };

  /**
   * Prepares the image (this is where a device is registered, when asked to) and saves it on this computer. The save
   * location is chosen and checked first, straight from the click, because browsers only allow the dialog right
   * after one, and so that nothing is registered or downloaded for a place that cannot be written to.
   */
  const downloadImage = async () => {
    setError(null);
    setRecovery('none');
    setWarning(null);
    setSavedTo(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('You appear to be offline. Reconnect and try again.');
      setRecovery('retry');
      return;
    }
    const wanted = imageFileName(deviceType, version);
    let target: { file: SavableFile; where: string; name: string } | undefined;
    try {
      if (folder) {
        if (!(await ensureFolderAccess(folder))) {
          const denied = new Error('denied');
          denied.name = 'NotAllowedError';
          throw denied;
        }
        await probeFolder(folder);
        const name = await uniqueFileName(folder, wanted); // never replace an image that is already there
        target = { file: await folder.getFileHandle(name, { create: true }), where: folder.name, name };
      } else if (canPickFile()) {
        const picked = await chooseFile(wanted);
        target = { file: picked, where: 'the location you chose', name: picked.name };
      }
    } catch (e) {
      showProblem(e, folder?.name);
      return;
    }
    if (await clearlyTooLittleSpace(2.5 * 1024 ** 3)) {
      setWarning('Your browser reports very little free space. The image needs roughly 2 to 8 GB; the save fails cleanly if it runs out.');
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy('image');
    try {
      const current = await obtainTicket();
      const url = serverUrl(current.downloadPath);
      if (!target) {
        // no folder access in this browser: a plain download into the browser's own downloads folder
        downloadWithBrowser(url, current.job.fileName);
        setSavedTo({ fileName: current.job.fileName, bytes: 0, where: "your browser's downloads folder" });
        return;
      }
      let track = trackProgress(undefined);
      setProgress({ written: 0, bytesPerSecond: 0 });
      const response = await fetch(url, { signal: controller.signal });
      const bytes = await copyResponseToFile(
        response,
        target.file,
        (written) => setProgress(track(written)),
        controller.signal,
        (total) => {
          track = trackProgress(total);
        },
      );
      const verification = await verifySavedFile(target.file, bytes);
      setSavedTo({ fileName: target.name, bytes, where: target.where, verification });
    } catch (e) {
      showProblem(e, target?.where);
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(null);
    }
  };

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
                  <Button variant='outline' size='sm' disabled={busy !== null} onClick={() => void pickFolder()}>
                    Choose another folder
                  </Button>
                )}
                {(recovery === 'allow-access' || recovery === 'retry' || recovery === 'choose-folder') && ready && (
                  <Button variant='outline' size='sm' disabled={busy !== null} onClick={() => void downloadImage()}>
                    Try again
                  </Button>
                )}
              </span>
            )}
          </div>
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
              onChange={(event) => setVersion(event.target.value)}
              disabled={!deviceType || loadingVersions || versions.length === 0}
            >
              {!deviceType && <option value=''>Choose a fleet first</option>}
              {deviceType && loadingVersions && <option value=''>Loading versions…</option>}
              {versions.map((candidate, index) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                  {index === 0 ? '  (latest)' : ''}
                </option>
              ))}
            </Select>
            {versionsError && <p className='text-xs text-destructive'>{versionsError}</p>}
            {deviceType && version && (
              <p className='text-xs text-muted-foreground'>
                The image goes from balena&apos;s servers through Vector straight to your computer. It is not stored on the server.
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
          {folderPicker ? (
            <div className='grid gap-1.5 border border-input px-3 py-2.5'>
              <span className={microLabel}>Save to</span>
              <span className='flex items-center gap-2 text-sm'>
                <FolderOpen className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                <span className='min-w-0 truncate' title={folder?.name}>
                  {folder ? folder.name : 'Ask me each time (starts in Downloads)'}
                </span>
              </span>
              {folder && folderAccess === 'prompt' && (
                <span className='text-xs text-muted-foreground'>The browser will ask you to allow access to this folder again when you download.</span>
              )}
              {folder && folderAccess === 'denied' && (
                <span className='text-xs text-destructive'>The browser has blocked this folder. Choose it again to allow access.</span>
              )}
              <span className='flex flex-wrap gap-2'>
                <Button variant='outline' size='sm' disabled={busy !== null} onClick={() => void pickFolder()}>
                  {folder ? 'Change folder' : 'Choose a folder'}
                </Button>
                {folder && (
                  <Button variant='ghost' size='sm' disabled={busy !== null} onClick={clearFolder}>
                    Ask each time
                  </Button>
                )}
              </span>
            </div>
          ) : (
            <p className='border border-input px-3 py-2.5 text-xs text-muted-foreground'>
              Your browser saves to its own downloads folder. Use Chrome or Edge if you want to pick the folder here.
            </p>
          )}
          {warning && <p className='border border-warning/40 px-3 py-2 text-xs'>{warning}</p>}
          {busy === 'image' && progress !== null ? (
            <div className='grid gap-2'>
              <p className='flex items-center gap-2 text-sm'>
                <Loader2 className='size-4 animate-spin' aria-hidden />
                {progress.percent !== undefined ? `Saving… ${Math.floor(progress.percent)}%` : 'Saving…'}
              </p>
              {progress.percent !== undefined && (
                <div className='h-1.5 w-full bg-foreground/10' role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress.percent)}>
                  <div className='h-full bg-accent transition-[width]' style={{ width: `${progress.percent}%` }} />
                </div>
              )}
              <p className='text-xs text-muted-foreground'>
                {formatBytes(progress.written)}
                {progress.total ? ` of ${formatBytes(progress.total)}` : ''}
                {progress.bytesPerSecond > 0 ? ` · ${formatBytes(progress.bytesPerSecond)}/s` : ''}
                {progress.etaSeconds !== undefined ? ` · about ${formatDuration(progress.etaSeconds)} left` : ''}
              </p>
              <Button variant='outline' onClick={() => abortRef.current?.abort()}>
                <X aria-hidden />
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant='accent' disabled={!ready || busy !== null} onClick={() => void downloadImage()}>
              {busy === 'image' ? <Loader2 className='animate-spin' aria-hidden /> : <HardDriveDownload aria-hidden />}
              {busy === 'image' ? 'Preparing…' : ticket ? 'Download the image again' : 'Download flash-ready image'}
            </Button>
          )}
          {savedTo && (
            <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
              <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
              <span>
                {savedTo.bytes > 0 ? (
                  <>
                    Saved <code>{savedTo.fileName}</code> ({formatBytes(savedTo.bytes)}) to {savedTo.where}.
                  </>
                ) : (
                  <>
                    <code>{savedTo.fileName}</code> is downloading to {savedTo.where}.
                  </>
                )}{' '}
                Flash it with balenaEtcher.
                {savedTo.verification?.ok && <span className='block text-muted-foreground'>Checked: the file size and disk signature are correct.</span>}
                {savedTo.verification && !savedTo.verification.ok && (
                  <span className='block text-destructive'>
                    {savedTo.verification.problem} Do not flash this file; download the image again.
                  </span>
                )}
              </span>
            </p>
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
            The image is the balenaOS download with this fleet&apos;s config written into it while it streams to you. Nothing is
            kept on the server. It is large (often over a gigabyte), so keep this page open until it finishes. Already flashed
            a drive? Download the config only and replace <code className='mx-1'>config.json</code> on its boot partition.
          </p>
        </CardContent>
      </Card>
      </div>
    </VxScope>
  );
};

export default AddDevice;
