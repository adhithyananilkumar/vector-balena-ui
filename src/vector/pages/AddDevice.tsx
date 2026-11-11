import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Title, useDataProvider, useGetList } from 'react-admin';
import { CheckCircle2, FileJson, FolderOpen, HardDriveDownload, Loader2, Trash2, TriangleAlert, Wand2 } from 'lucide-react';
import { BrandMark, lookupDeviceType } from '../components/brands';
import DeviceWatch from '../components/DeviceWatch';
import TransferProgress from '../components/TransferProgress';
import { RichSelect, type RichOption } from '../components/rich-select';
import { Button } from '../components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/card';
import { Input } from '../components/input';
import { Label } from '../components/label';
import { VxScope } from '../components/scope';
import { Select } from '../components/select';
import { wifiConnectionFile } from '../lib/wifi';
import { authFetch, formatBytes } from '../lib/api';
import { cn } from '../lib/utils';
import { serverUrl } from '../../lib/serverUrl';
import {
  canPickFolder,
  chooseFolder,
  describeSaveError,
  downloadWithBrowser,
  findBaseImage,
  forgetFolder,
  listBaseImages,
  loadSavedFolder,
  probeFolder,
  removeBaseImage,
  saveFolder,
  type BaseImageStatus,
  type LocalBaseImage,
  type SavableFolder,
  type SaveRecovery,
} from '../lib/imageSave';
import { transfers, useTransfers, type Transfer } from '../lib/transfers';

interface Ticket {
  job: { id: string; fileName: string; deviceUuid?: string };
  downloadPath: string;
}

interface AddedDevice {
  id: number;
  uuid: string;
  name?: string;
}

type Mode = 'new' | 'existing' | 'fleet';

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

const saveText = (text: string, fileName: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const saveJson = (data: unknown, fileName: string) => saveText(JSON.stringify(data, null, 2), fileName, 'application/json');

interface WizardStep {
  n: number;
  title: string;
  summary: string;
  state: 'done' | 'todo';
  locked: boolean;
  busy?: boolean;
}

/** The sections of the page as a list: where you are, what is finished, and the answer given in each. */
const Stepper: React.FC<{ steps: WizardStep[]; current: number; onGo: (n: number) => void }> = ({ steps, current, onGo }) => (
  <nav aria-label='Add device steps' className='lg:sticky lg:top-20'>
    <ol className='grid gap-1'>
      {steps.map((item) => {
        const active = item.n === current;
        return (
          <li key={item.n}>
            <button
              type='button'
              disabled={item.locked}
              aria-current={active ? 'step' : undefined}
              onClick={() => onGo(item.n)}
              className={cn(
                'flex w-full items-start gap-3 border px-3 py-2.5 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring',
                active ? 'border-accent bg-accent/[0.07]' : 'border-transparent hover:border-input',
                item.locked && 'cursor-not-allowed opacity-50 hover:border-transparent',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center border font-mono text-[11px]',
                  item.state === 'done' ? 'border-success text-success' : active ? 'border-accent text-accent' : 'border-input text-muted-foreground',
                )}
              >
                {item.busy ? <Loader2 className='size-3.5 animate-spin' aria-hidden /> : item.state === 'done' ? <CheckCircle2 className='size-3.5' aria-hidden /> : item.n}
              </span>
              <span className='min-w-0'>
                <span className='block text-sm font-medium'>{item.title}</span>
                <span className='block truncate text-xs text-muted-foreground' title={item.summary}>
                  {item.summary}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);

const Step: React.FC<{ n: number | string; title: string; state?: 'done' | 'todo' | 'blocked'; children: React.ReactNode }> = ({ n, title, state = 'todo', children }) => (
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

/** What went wrong in a transfer, with the buttons that fix it. */
const TransferFailure: React.FC<{
  transfer: Transfer;
  onChooseFolder: () => void;
  onRetry: () => void;
  onRedownload: () => void;
  disabled: boolean;
}> = ({ transfer, onChooseFolder, onRetry, onRedownload, disabled }) => {
  const error = transfer.error;
  if (!error) return null;
  const recovery: SaveRecovery = error.recovery;
  return (
    <div role='alert' className='grid gap-2 border border-destructive/40 px-3 py-2.5 text-xs text-destructive'>
      <p className='flex items-start gap-2'>
        <TriangleAlert className='mt-0.5 size-3.5 shrink-0' aria-hidden />
        <span>{error.message}</span>
      </p>
      {error.registeredDevice && (
        <p className='text-foreground'>
          The device <code>{error.registeredDevice.slice(0, 7)}</code> was already added to your fleet, so nothing is lost: try again and the image is made for the same device.
        </p>
      )}
      <span className='flex flex-wrap gap-2'>
        {recovery === 'choose-folder' && (
          <Button variant='outline' size='sm' disabled={disabled} onClick={onChooseFolder}>
            Choose another folder
          </Button>
        )}
        {recovery === 'redownload' && (
          <Button variant='outline' size='sm' disabled={disabled} onClick={onRedownload}>
            Download the base image again
          </Button>
        )}
        {recovery !== 'redownload' && (
          <Button variant='outline' size='sm' disabled={disabled} onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant='ghost' size='sm' onClick={() => transfers.dismiss(transfer.id)}>
          Dismiss
        </Button>
      </span>
    </div>
  );
};

/**
 * What was entered so far. It lives in memory for the session, so leaving the page (a download keeps going in the
 * corner) and coming back finds the same step and answers. The Wi-Fi password is never written to storage.
 */
interface Draft {
  fleetId?: string;
  version?: string;
  development?: 'production' | 'development';
  network?: 'ethernet' | 'wifi';
  wifiSsid?: string;
  wifiKey?: string;
  dnsServers?: string;
  mode?: Mode;
  existingUuid?: string;
  added?: AddedDevice | null;
  step?: number;
  maxStep?: number;
}
let draft: Draft = {};

const AddDevice: React.FC = () => {
  const dataProvider = useDataProvider();
  const { data: fleets } = useGetList('application', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'app name', order: 'ASC' } });
  const { data: deviceTypes } = useGetList('device type', { pagination: { page: 1, perPage: 1000 }, sort: { field: 'slug', order: 'ASC' } });

  const [searchParams] = useSearchParams();
  // a link to another fleet starts from scratch instead of inheriting the last fleet's answers and device
  const linkedFleet = searchParams.get('fleet');
  if (linkedFleet && linkedFleet !== draft.fleetId) draft = {};
  const [fleetId, setFleetId] = useState(() => searchParams.get('fleet') ?? draft.fleetId ?? '');
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState(draft.version ?? '');
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [development, setDevelopment] = useState<'production' | 'development'>(draft.development ?? 'production');
  const [network, setNetwork] = useState<'ethernet' | 'wifi'>(draft.network ?? 'ethernet');
  const [wifiSsid, setWifiSsid] = useState(draft.wifiSsid ?? '');
  const [wifiKey, setWifiKey] = useState(draft.wifiKey ?? '');
  const [dnsServers, setDnsServers] = useState(draft.dnsServers ?? '');

  const [mode, setMode] = useState<Mode>(searchParams.get('device') ? 'existing' : (draft.mode ?? 'new'));
  const [deviceName, setDeviceName] = useState('');
  const [added, setAdded] = useState<AddedDevice | null>(draft.added ?? null);
  const [adding, setAdding] = useState(false);
  const [existingUuid, setExistingUuid] = useState(searchParams.get('device') ?? draft.existingUuid ?? '');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configBusy, setConfigBusy] = useState(false);
  const [configDone, setConfigDone] = useState<{ at: number; uuid?: string; wifi?: boolean } | null>(null);
  const [streamBusy, setStreamBusy] = useState(false);
  const [streamDone, setStreamDone] = useState<{ at: number; fileName: string } | null>(null);

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

  const { data: fleetDevices, refetch: refetchDevices } = useGetList(
    'device',
    { pagination: { page: 1, perPage: 200 }, sort: { field: 'device name', order: 'ASC' }, filter: { 'belongs to-application': Number(fleetId) } },
    { enabled: Boolean(fleetId) && mode === 'existing' },
  );

  const allTransfers = useTransfers();
  const running = allTransfers.find((item) => item.state === 'running');
  const baseKey = `base:${deviceType}:${version}`;
  const imageKey = `image:${deviceType}:${version}:${fleetId}`;
  const baseTransfer = allTransfers.find((item) => item.key === baseKey);
  const imageTransfer = allTransfers.find((item) => item.key === imageKey);
  const elsewhere = running && running.key !== baseKey && running.key !== imageKey ? running : undefined;

  useEffect(() => {
    void loadSavedFolder().then(async (saved) => {
      setFolder(saved);
      if (saved?.queryPermission) setFolderAccess(await saved.queryPermission({ mode: 'readwrite' }).catch(() => undefined));
    });
  }, []);

  // a transfer that found the remembered folder unusable: stop offering it
  useEffect(() => {
    if (allTransfers.some((item) => item.error?.forgetFolder)) {
      setFolder(undefined);
      setBase(undefined);
    }
  }, [allTransfers]);

  // a device added for one fleet is not this fleet's any more when the fleet changes
  const lastFleet = useRef(fleetId);
  useEffect(() => {
    if (lastFleet.current === fleetId) return;
    lastFleet.current = fleetId;
    setAdded(null);
    setExistingUuid('');
    setConfigDone(null);
    setStreamDone(null);
  }, [fleetId]);

  // versions for the fleet's device type (only the ones balena really offers, so this takes a few seconds)
  const wantedVersion = useRef(draft.version ?? '');
  useEffect(() => {
    setVersions([]);
    setVersionsError(null);
    if (!deviceType) {
      setVersion('');
      return undefined;
    }
    let cancelled = false;
    setLoadingVersions(true);
    authFetch<{ versions: string[] }>(`/image-maker/versions?deviceType=${encodeURIComponent(deviceType)}`)
      .then((result) => {
        if (cancelled) return;
        setVersions(result.versions);
        setVersion(result.versions.includes(wantedVersion.current) ? wantedVersion.current : (result.versions[0] ?? ''));
        wantedVersion.current = '';
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
  }, [refreshLibrary, baseTransfer?.state]);

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

  const targetUuid = mode === 'existing' ? existingUuid : mode === 'new' ? added?.uuid ?? '' : '';
  const targetReady = mode === 'fleet' || Boolean(targetUuid);
  const wifiMissing = network === 'wifi' && !wifiSsid.trim();
  const choicesReady = !!fleet && !!deviceType && !!version && !wifiMissing;
  const ready = choicesReady && targetReady;
  const canAdd = !!fleet && !!deviceType && !!version && !adding;

  const payload = useCallback(
    () => ({
      appId: Number(fleetId),
      deviceType,
      version,
      developmentMode: development === 'development',
      provisioning: mode === 'fleet' ? 'fleet' : 'device',
      ...(mode !== 'fleet' && targetUuid ? { deviceUuid: targetUuid } : {}),
      network,
      ...(network === 'wifi' ? { wifiSsid: wifiSsid.trim(), wifiKey } : {}),
      ...(dnsServers.trim() ? { dnsServers: dnsServers.trim() } : {}),
    }),
    [fleetId, deviceType, version, development, mode, targetUuid, network, wifiSsid, wifiKey, dnsServers],
  );

  const failWith = (cause: unknown, where?: string) => {
    const problem = describeSaveError(cause, where);
    if (problem.recovery === 'none') return;
    setError(problem.message);
    if (problem.forgetFolder) {
      setFolder(undefined);
      setBase(undefined);
      void forgetFolder();
    }
  };

  const addDeviceToFleet = async () => {
    setError(null);
    setAdding(true);
    try {
      const result = await authFetch<{ device: AddedDevice }>('/image-maker/devices', {
        method: 'POST',
        body: JSON.stringify({ appId: Number(fleetId), deviceType, version, ...(deviceName.trim() ? { name: deviceName.trim() } : {}) }),
      });
      setAdded(result.device);
      setDeviceName('');
      void refetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add the device.');
    } finally {
      setAdding(false);
    }
  };

  const removeAdded = async () => {
    if (!added) return;
    if (!window.confirm(`Remove the device ${added.name ?? added.uuid.slice(0, 7)} from ${fleetName}? Nothing has booted with it yet.`)) return;
    setError(null);
    try {
      await dataProvider.delete('device', { id: added.id, previousData: { id: added.id } });
      setAdded(null);
      setConfigDone(null);
      void refetchDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The device could not be removed.');
    }
  };

  const pickFolder = async () => {
    setError(null);
    try {
      const chosen = await chooseFolder();
      await probeFolder(chosen); // fail now, not after something has been prepared
      setFolder(chosen);
      setFolderAccess('granted');
      await saveFolder(chosen);
    } catch (e) {
      failWith(e, 'the folder you chose');
    }
  };

  const clearFolder = () => {
    setFolder(undefined);
    setFolderAccess(undefined);
    setBase(undefined);
    setLibrary([]);
    void forgetFolder();
  };

  const startBase = () => {
    if (!folder) return;
    setError(null);
    const result = transfers.startBase({ folder, deviceType, version });
    if (!result.ok) setNotice(result.reason === 'same' ? 'This download is already running.' : `Another download is running (${result.running.title}). It must finish or be cancelled first.`);
    else setNotice(null);
  };

  const startImage = () => {
    if (!folder || !fleet) return;
    setError(null);
    const result = transfers.startImage({ folder, deviceType, version, fleetId: Number(fleetId), fleetName, payload: payload() });
    if (!result.ok) setNotice(result.reason === 'same' ? 'This image is already being made.' : `Another download is running (${result.running.title}). It must finish or be cancelled first.`);
    else setNotice(null);
  };

  const downloadConfig = async () => {
    setError(null);
    setConfigBusy(true); // independent of any large download that is running
    try {
      const config = await authFetch<{ uuid?: string; wifiSsid?: string; wifiKey?: string }>('/image-maker/config', { method: 'POST', body: JSON.stringify(payload()) });
      saveJson(config, 'config.json');
      // balenaOS joins Wi-Fi from this file, not from config.json
      const wifi = wifiConnectionFile(config as Record<string, unknown>);
      if (wifi) window.setTimeout(() => saveText(wifi, 'resin-wifi-01'), 400);
      setConfigDone({ at: Date.now(), uuid: mode !== 'fleet' ? config.uuid : undefined, wifi: Boolean(wifi) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate the config.');
    } finally {
      setConfigBusy(false);
    }
  };

  /** Browsers that cannot write into a chosen folder: one download of the finished image, streamed by the server. */
  const downloadStreamed = async () => {
    setError(null);
    setStreamBusy(true);
    try {
      const current = await authFetch<Ticket>('/image-maker/images', { method: 'POST', body: JSON.stringify(payload()) });
      downloadWithBrowser(serverUrl(current.downloadPath), current.job.fileName);
      setStreamDone({ at: Date.now(), fileName: current.job.fileName });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to prepare the image.');
    } finally {
      setStreamBusy(false);
    }
  };

  const removeFromLibrary = async (name: string) => {
    if (!folder) return;
    try {
      await removeBaseImage(folder, name);
    } catch (e) {
      failWith(e, folder.name);
    }
    await refreshLibrary();
  };

  // the wizard: one section at a time, and a later section opens only when the earlier ones are complete
  const [step, setStep] = useState(draft.step ?? 1);
  const [maxStep, setMaxStep] = useState(draft.maxStep ?? 1);
  const step1Valid = Boolean(fleet && deviceType && version) && !loadingVersions;
  const step2Valid = !wifiMissing;
  const step3Valid = targetReady;
  const validUntil = (n: number): boolean => (n <= 1 ? true : step1Valid && (n <= 2 || (step2Valid && (n <= 3 || step3Valid))));
  const goTo = (n: number) => {
    if (n < 1 || n > 4 || n > maxStep + 1 || !validUntil(n)) return;
    setStep(n);
    setMaxStep((current) => Math.max(current, n));
  };
  // clearing the fleet (or changing it to one without a device type) takes the user back to the start
  useEffect(() => {
    if (!step1Valid && !loadingVersions && step > 1) {
      setStep(1);
      setMaxStep(1);
    }
  }, [step1Valid, loadingVersions, step]);
  useEffect(() => {
    if (!step3Valid && step > 3) setStep(3);
  }, [step3Valid, step]);

  useEffect(() => {
    draft = { fleetId, version, development, network, wifiSsid, wifiKey, dnsServers, mode, existingUuid, added, step, maxStep };
  }, [fleetId, version, development, network, wifiSsid, wifiKey, dnsServers, mode, existingUuid, added, step, maxStep]);

  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !searchParams.get('device') || !step1Valid || !step2Valid || !existingUuid) return;
    deepLinked.current = true;
    setStep(4);
    setMaxStep(4);
  }, [searchParams, step1Valid, step2Valid, existingUuid]);

  const baseState = base === 'checking' || base === undefined ? base : base.state;
  const baseReady = baseState === 'present';
  const diskBusy = Boolean(running);
  const imageDone = imageTransfer?.state === 'done' ? imageTransfer : undefined;

  const wizardSteps: WizardStep[] = [
    {
      n: 1,
      title: 'Fleet and operating system',
      summary: fleet ? `${fleetName} · balenaOS ${version || '…'}` : 'Choose a fleet and a version',
      state: step1Valid && maxStep > 1 ? 'done' : 'todo',
      locked: false,
    },
    {
      n: 2,
      title: 'Mode and network',
      summary: `${development === 'production' ? 'Production' : 'Development'} · ${network === 'wifi' ? `Wi-Fi ${wifiSsid.trim()}` : 'Ethernet'}`,
      state: step2Valid && maxStep > 2 ? 'done' : 'todo',
      locked: maxStep < 2 || !validUntil(2),
    },
    {
      n: 3,
      title: 'The device',
      summary:
        mode === 'fleet'
          ? 'Many devices (fleet-wide image)'
          : mode === 'new'
            ? added
              ? `${added.name ?? added.uuid.slice(0, 7)} added`
              : 'Add a new device'
            : existingUuid
              ? `Registered ${existingUuid.slice(0, 7)}`
              : 'Choose a registered device',
      state: step3Valid && maxStep > 3 ? 'done' : 'todo',
      locked: maxStep < 3 || !validUntil(3),
    },
    {
      n: 4,
      title: 'Install the OS',
      summary: running ? `${running.label}${running.progress?.percent !== undefined ? ` · ${Math.floor(running.progress.percent)}%` : ''}` : imageDone ? 'Image saved' : 'Base image, image, config.json',
      state: imageDone || configDone || streamDone ? 'done' : 'todo',
      locked: !running && (maxStep < 4 || !validUntil(4)),
      busy: Boolean(running),
    },
  ];

  return (
    <VxScope className='w-full pb-6'>
      <Title title='Add device' />
      {error && (
        <div role='alert' className='mb-4 flex items-start gap-2 border border-destructive/40 px-4 py-3 text-[13px] text-destructive'>
          <TriangleAlert className='mt-0.5 size-4 shrink-0' aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className='grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]'>
        <Stepper steps={wizardSteps} current={step} onGo={goTo} />
        <div className='grid max-w-3xl gap-4'>
          {step === 1 && (
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
                <Select id='vx-ad-version' value={version} onChange={(event) => setVersion(event.target.value)} disabled={!deviceType || loadingVersions || versions.length === 0}>
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
          <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3'>
            <span>
              {1 > 1 && (
                <Button variant='ghost' size='sm' onClick={() => goTo(0)}>
                  Back
                </Button>
              )}
            </span>
            <span className='flex items-center gap-3'>
              {!(step1Valid) && <span className='text-xs text-muted-foreground'>{loadingVersions ? 'Checking balena for versions…' : 'Choose a fleet and an OS version.'}</span>}
              <Button variant='accent' size='sm' disabled={!(step1Valid)} onClick={() => goTo(2)}>
                Continue
              </Button>
            </span>
          </div>
            </CardContent>
          </Card>

          )}
          {step === 2 && (
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
          <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3'>
            <span>
              {2 > 1 && (
                <Button variant='ghost' size='sm' onClick={() => goTo(1)}>
                  Back
                </Button>
              )}
            </span>
            <span className='flex items-center gap-3'>
              {!(step2Valid) && <span className='text-xs text-muted-foreground'>{'Enter the Wi-Fi network name.'}</span>}
              <Button variant='accent' size='sm' disabled={!(step2Valid)} onClick={() => goTo(3)}>
                Continue
              </Button>
            </span>
          </div>
            </CardContent>
          </Card>

          )}
          {step === 3 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>3. The device</CardTitle>
                <CardDescription>
                  {mode === 'new'
                    ? 'Add it to the fleet first. It shows as offline until it boots; then install the OS on it.'
                    : mode === 'existing'
                      ? 'Pick a device that is already in the fleet. It gets a new key, written into what you install.'
                      : 'No device is added now. Devices using the image register themselves when they first boot.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className='grid gap-3'>
              <Choice
                label='Which device'
                value={mode}
                onChange={(next) => {
                  setMode(next);
                  setConfigDone(null);
                }}
                options={[
                  { value: 'new', title: 'New device', hint: 'Add one to the fleet now.' },
                  { value: 'existing', title: 'Registered', hint: 'Use a device already in the fleet.' },
                  { value: 'fleet', title: 'Many devices', hint: 'One fleet-wide image, nothing added now.' },
                ]}
              />

              {mode === 'new' &&
                (added ? (
                  <div className='grid gap-2 border border-success/40 px-3.5 py-3'>
                    <p className='flex items-start gap-2 text-sm'>
                      <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-success' aria-hidden />
                      <span>
                        Added <strong>{added.name ?? added.uuid.slice(0, 7)}</strong> to {fleetName} <code className='text-xs text-muted-foreground'>{added.uuid.slice(0, 7)}</code>
                      </span>
                    </p>
                    <DeviceWatch fleetId={Number(fleetId)} fleetName={fleetName} expectedUuid={added.uuid} since={0} made='image' statusOnly />
                    <span className='flex flex-wrap gap-2'>
                      <Button variant='ghost' size='sm' onClick={() => setAdded(null)}>
                        Add another device
                      </Button>
                      <Button variant='ghost' size='sm' onClick={() => void removeAdded()}>
                        <Trash2 aria-hidden />
                        Remove this device
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div className='grid gap-2'>
                    <Label htmlFor='vx-ad-name'>Device name (optional)</Label>
                    <Input
                      id='vx-ad-name'
                      name='new-device-label'
                      autoComplete='off'
                      data-lpignore='true'
                      data-1p-ignore='true'
                      placeholder='for example Workshop Pi'
                      maxLength={64}
                      value={deviceName}
                      onChange={(event) => setDeviceName(event.target.value)}
                    />
                    <span>
                      <Button variant='accent' size='sm' disabled={!canAdd} onClick={() => void addDeviceToFleet()}>
                        {adding ? <Loader2 className='animate-spin' aria-hidden /> : <CheckCircle2 aria-hidden />}
                        Add device to {fleetName || 'the fleet'}
                      </Button>
                    </span>
                    {!fleet && <p className='text-xs text-muted-foreground'>Choose a fleet and an OS version first.</p>}
                  </div>
                ))}

              {mode === 'existing' && (
                <div className='grid gap-2'>
                  <Label htmlFor='vx-ad-device'>Device</Label>
                  <Select id='vx-ad-device' value={existingUuid} onChange={(event) => setExistingUuid(event.target.value)} disabled={!fleetId}>
                    <option value=''>{fleetId ? ((fleetDevices ?? []).length ? 'Choose a device…' : 'No devices in this fleet yet') : 'Choose a fleet first'}</option>
                    {(fleetDevices ?? []).map((device) => (
                      <option key={String(device.id)} value={String(device.uuid)}>
                        {String(device['device name'] ?? device.uuid)} · {String(device.uuid).slice(0, 7)}
                      </option>
                    ))}
                  </Select>
                  <p className='text-xs text-muted-foreground'>A new key is created for that device and written into what you install. Its old key keeps working until it is reflashed.</p>
                </div>
              )}

              {mode === 'fleet' && (
                <p className='text-xs text-muted-foreground'>
                  The image works for any number of devices. No device is added now: each one registers itself in the fleet the first time it boots, so it appears here only then. Anyone who has the image can add a
                  device to your fleet, so keep it private.
                </p>
              )}
          <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3'>
            <span>
              {3 > 1 && (
                <Button variant='ghost' size='sm' onClick={() => goTo(2)}>
                  Back
                </Button>
              )}
            </span>
            <span className='flex items-center gap-3'>
              {!(step3Valid) && <span className='text-xs text-muted-foreground'>{mode === 'new' ? 'Add the device first.' : 'Choose the device.'}</span>}
              <Button variant='accent' size='sm' disabled={!(step3Valid)} onClick={() => goTo(4)}>
                Continue
              </Button>
            </span>
          </div>
            </CardContent>
          </Card>

          )}
          {step === 4 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>4. Install the OS</CardTitle>
                <CardDescription>The config contains a fleet key. Keep it private and do not share it.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {!targetReady && (
                <p className='border border-input px-3 py-2 text-xs text-muted-foreground'>
                  {mode === 'new' ? 'Add the device first (step 3). The image is then made for that device.' : 'Choose the device first (step 3).'}
                </p>
              )}
              {elsewhere && (
                <p className='border border-input px-3 py-2 text-xs'>
                  A download is running: <strong>{elsewhere.title}</strong> ({elsewhere.label}
                  {elsewhere.progress?.percent !== undefined ? `, ${Math.floor(elsewhere.progress.percent)}%` : ''}). One at a time; you can still get <code>config.json</code> below.
                </p>
              )}

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
                    {folder && folderAccess === 'prompt' && <span className='text-xs text-muted-foreground'>The browser will ask you to allow access to this folder again when you continue.</span>}
                    {folder && folderAccess === 'denied' && <span className='text-xs text-destructive'>The browser has blocked this folder. Choose it again to allow access.</span>}
                    <span className='flex flex-wrap gap-2'>
                      <Button variant={folder ? 'outline' : 'accent'} size='sm' disabled={diskBusy} onClick={() => void pickFolder()}>
                        {folder ? 'Change folder' : 'Choose a folder'}
                      </Button>
                      {folder && (
                        <Button variant='ghost' size='sm' disabled={diskBusy} onClick={clearFolder}>
                          Forget folder
                        </Button>
                      )}
                    </span>
                  </Step>

                  <Step n={2} title={`Base image${version ? `: balenaOS ${version}` : ''}`} state={baseReady ? 'done' : folder && version ? 'todo' : 'blocked'}>
                    {baseTransfer?.state === 'running' ? (
                      <TransferProgress transfer={baseTransfer} onCancel={() => transfers.cancel(baseTransfer.id)} />
                    ) : baseTransfer?.state === 'error' ? (
                      <TransferFailure
                        transfer={baseTransfer}
                        disabled={diskBusy}
                        onChooseFolder={() => void pickFolder()}
                        onRetry={startBase}
                        onRedownload={startBase}
                      />
                    ) : !folder || !version ? (
                      <p className='text-xs text-muted-foreground'>{!folder ? 'Choose a folder first.' : 'Choose a fleet and a version first.'}</p>
                    ) : baseState === 'checking' ? (
                      <p className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <Loader2 className='size-3.5 animate-spin' aria-hidden />
                        Looking in your folder…
                      </p>
                    ) : base && typeof base === 'object' && base.state === 'present' ? (
                      <>
                        <p className='text-xs text-success'>
                          On this computer: <code>{base.name}</code> ({formatBytes(base.file.size)}). It is reused, so nothing is downloaded again.
                        </p>
                        <span>
                          <Button variant='ghost' size='sm' disabled={diskBusy} onClick={startBase}>
                            Download it again
                          </Button>
                        </span>
                      </>
                    ) : (
                      <>
                        <p className='text-xs text-muted-foreground'>
                          {baseState === 'incomplete'
                            ? 'A file with this name is in the folder but it is not complete. Download it again.'
                            : "Not on this computer yet. balenaOS images are large (roughly 1 to 8 GB depending on the device), so the first download can take several minutes. It is saved once, checked against balena's checksum and reused for every device."}
                        </p>
                        <span>
                          <Button variant='accent' size='sm' disabled={diskBusy || !deviceType || !version} onClick={startBase}>
                            <HardDriveDownload aria-hidden />
                            Download base image
                          </Button>
                        </span>
                      </>
                    )}
                  </Step>

                  <Step n={3} title='Create the flash-ready image' state={imageDone ? 'done' : baseReady && ready ? 'todo' : 'blocked'}>
                    {imageTransfer?.state === 'running' ? (
                      <TransferProgress transfer={imageTransfer} onCancel={() => transfers.cancel(imageTransfer.id)} />
                    ) : imageTransfer?.state === 'error' ? (
                      <TransferFailure
                        transfer={imageTransfer}
                        disabled={diskBusy}
                        onChooseFolder={() => void pickFolder()}
                        onRetry={startImage}
                        onRedownload={startBase}
                      />
                    ) : (
                      <>
                        <p className='text-xs text-muted-foreground'>Copies the base image and writes the configuration for {mode === 'fleet' ? 'this fleet' : 'this device'} into the copy, here on your computer.</p>
                        <span>
                          <Button variant='accent' size='sm' disabled={diskBusy || !baseReady || !ready} onClick={startImage}>
                            <Wand2 aria-hidden />
                            Create image
                          </Button>
                        </span>
                        {baseReady && !choicesReady && <span className='text-xs text-muted-foreground'>Finish steps 1 and 2 first.</span>}
                      </>
                    )}
                  </Step>
                </>
              ) : (
                <Step n={1} title='Download the flash-ready image' state={streamDone ? 'done' : ready ? 'todo' : 'blocked'}>
                  <p className='text-xs text-muted-foreground'>
                    This browser cannot keep a library of images in a folder, so the finished image is streamed to your downloads folder in one go. Use Chrome or Edge to keep a base image and reuse it.
                  </p>
                  <span>
                    <Button variant='accent' size='sm' disabled={streamBusy || !ready} onClick={() => void downloadStreamed()}>
                      {streamBusy ? <Loader2 className='animate-spin' aria-hidden /> : <HardDriveDownload aria-hidden />}
                      Download flash-ready image
                    </Button>
                  </span>
                </Step>
              )}

              <div className='grid gap-2 border-t border-border pt-3'>
                <span className={microLabel}>Already flashed a drive?</span>
                <Button variant='outline' disabled={configBusy || !ready} onClick={() => void downloadConfig()}>
                  {configBusy ? <Loader2 className='animate-spin' aria-hidden /> : <FileJson aria-hidden />}
                  Download config.json only
                </Button>
                <p className='text-xs text-muted-foreground'>
                  Replaces <code>config.json</code> on the boot partition of a drive that already runs balenaOS. Available while a download runs.
                </p>
              </div>

              {notice && <p className='border border-input px-3 py-2 text-xs'>{notice}</p>}

              {imageDone?.outcome && (
                <div className='grid gap-3'>
                  <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
                    <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
                    <span>
                      Saved <code>{imageDone.outcome.fileName}</code> ({formatBytes(imageDone.outcome.bytes)}) in {imageDone.outcome.where}.
                      {imageDone.outcome.verification?.ok && <span className='block text-muted-foreground'>Checked: the file was read back and is complete.</span>}
                      {imageDone.outcome.verification && !imageDone.outcome.verification.ok && (
                        <span className='block text-destructive'>{imageDone.outcome.verification.problem} Do not use this file; create it again.</span>
                      )}
                    </span>
                  </p>
                  <DeviceWatch fleetId={Number(fleetId)} fleetName={fleetName} expectedUuid={targetUuid || undefined} since={imageDone.finishedAt ?? imageDone.startedAt} made='image' />
                </div>
              )}
              {configDone && (
                <div className='grid gap-3'>
                  <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
                    <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
                    <span>
                      <code>config.json</code> downloaded.
                      {configDone.wifi && (
                        <span className='block text-muted-foreground'>
                          A second file, <code>resin-wifi-01</code>, was downloaded too. Copy it into the <code>system-connections</code> folder on the boot partition, next to <code>config.json</code>, or the device will not join the Wi-Fi network.
                        </span>
                      )}
                    </span>
                  </p>
                  <DeviceWatch fleetId={Number(fleetId)} fleetName={fleetName} expectedUuid={targetUuid || undefined} since={configDone.at} made='config' />
                </div>
              )}
              {streamDone && (
                <div className='grid gap-3'>
                  <p className='flex items-start gap-2 border border-success/40 px-3 py-2 text-xs'>
                    <CheckCircle2 className='mt-0.5 size-3.5 shrink-0 text-success' aria-hidden />
                    <span>
                      <code>{streamDone.fileName}</code> is downloading to your browser&apos;s downloads folder.
                    </span>
                  </p>
                  <DeviceWatch fleetId={Number(fleetId)} fleetName={fleetName} expectedUuid={targetUuid || undefined} since={streamDone.at} made='image' />
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
                        <Button variant='ghost' size='sm' disabled={diskBusy} aria-label={`Delete ${item.name}`} onClick={() => void removeFromLibrary(item.name)}>
                          <Trash2 aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
          <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3'>
            <span>
              {4 > 1 && (
                <Button variant='ghost' size='sm' onClick={() => goTo(3)}>
                  Back
                </Button>
              )}
            </span>
            <span className='flex items-center gap-3'>
              {!(true) && <span className='text-xs text-muted-foreground'>{''}</span>}
              
            </span>
          </div>
            </CardContent>
          </Card>

          )}
        </div>
      </div>
    </VxScope>
  );
};

export default AddDevice;
