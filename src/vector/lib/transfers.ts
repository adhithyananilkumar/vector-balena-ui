/**
 * Large downloads and image builds, kept outside any page.
 *
 * A base image is about a gigabyte and takes minutes. If it lived in the Add device page, leaving that page would
 * lose the progress and the Cancel button while the download carried on invisibly, and coming back would offer to
 * start it a second time. Here the work belongs to the app: pages and the progress tray only subscribe to it.
 */
import { useSyncExternalStore } from 'react';
import { authFetch as realAuthFetch, formatBytes } from './api';
import { serverUrl } from '../../lib/serverUrl';
import {
  baseImageFileName,
  clearlyTooLittleSpace,
  createFlashReadyImage,
  describeSaveError,
  downloadResumable,
  ensureFolderAccess,
  findBaseImage,
  flashReadyFileName,
  forgetFolder,
  probeFolder,
  saveBaseImageMeta,
  trackProgress,
  uniqueFileName,
  verifyFlashReady,
  verifySavedFile,
  type BootPatch,
  type Progress,
  type SavableFolder,
  type SaveRecovery,
  type Verification,
} from './imageSave';

export type TransferKind = 'base' | 'image';

export interface TransferOutcome {
  fileName: string;
  bytes: number;
  where: string;
  verification?: Verification;
  /** The device registered for this image, when a new device was asked for. */
  deviceUuid?: string;
  fleetId?: number;
  fleetName?: string;
}

export interface TransferError {
  message: string;
  recovery: SaveRecovery;
  /** The remembered folder cannot be used any more. */
  forgetFolder?: boolean;
  /** A device was registered before this failed. */
  registeredDevice?: string;
}

export interface Transfer {
  id: string;
  kind: TransferKind;
  /** The same selection gives the same key: used to find "this OS version" among the transfers. */
  key: string;
  title: string;
  state: 'running' | 'done' | 'error' | 'cancelled';
  /** What it is doing right now. */
  label: string;
  progress?: Progress;
  /** An interruption that is being recovered from. */
  notice?: string;
  error?: TransferError;
  outcome?: TransferOutcome;
  startedAt: number;
  finishedAt?: number;
}

export interface TransferDeps {
  authFetch: typeof realAuthFetch;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Overridable for tests. */
  clearlyTooLittleSpace?: typeof clearlyTooLittleSpace;
}

export interface BaseDownloadRequest {
  folder: SavableFolder;
  deviceType: string;
  version: string;
}

export interface ImageRequest extends BaseDownloadRequest {
  fleetId: number;
  fleetName: string;
  /** The answers of the page, sent to the server to build the configuration. */
  payload: Record<string, unknown>;
}

export type StartResult = { ok: true; id: string } | { ok: false; reason: 'busy' | 'same'; running: Transfer };

interface TicketResponse {
  job: { id: string; fileName: string };
  downloadPath: string;
  sizeBytes?: number;
}

interface PatchResponse extends BootPatch {
  fileName: string;
  device?: { id: number; uuid: string };
  sizeBytes?: number;
}

const withFrom = (path: string, from: number): string => serverUrl(`${path}${path.includes('?') ? '&' : '?'}from=${from}`);

/** Browsers only allow the "leave this page?" question while there is something worth keeping. */
const guardUnload = (active: boolean): void => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (active) window.addEventListener('beforeunload', onBeforeUnload);
};
const onBeforeUnload = (event: BeforeUnloadEvent): void => {
  event.preventDefault();
  event.returnValue = '';
};

export const createTransferStore = (deps: TransferDeps = { authFetch: realAuthFetch }) => {
  const now = deps.now ?? Date.now;
  let list: Transfer[] = [];
  let counter = 0;
  const listeners = new Set<() => void>();
  const controllers = new Map<string, AbortController>();

  const emit = (): void => {
    list = [...list];
    guardUnload(list.some((item) => item.state === 'running'));
    listeners.forEach((listener) => listener());
  };
  const patch = (id: string, changes: Partial<Transfer>): void => {
    list = list.map((item) => (item.id === id ? { ...item, ...changes } : item));
    emit();
  };

  const running = (): Transfer | undefined => list.find((item) => item.state === 'running');

  /** One large transfer at a time: two would fight over the disk and the connection. */
  const begin = (kind: TransferKind, key: string, title: string, label: string): StartResult & { controller?: AbortController } => {
    const current = running();
    if (current) return { ok: false, reason: current.key === key ? 'same' : 'busy', running: current };
    counter += 1;
    const id = `t${counter}`;
    const controller = new AbortController();
    controllers.set(id, controller);
    list = [...list.filter((item) => item.key !== key), { id, kind, key, title, label, state: 'running', startedAt: now() }];
    emit();
    return { ok: true, id, controller };
  };

  const finish = (id: string, changes: Partial<Transfer>): void => {
    controllers.delete(id);
    patch(id, { ...changes, progress: undefined, notice: undefined, finishedAt: now() });
  };

  const fail = (id: string, cause: unknown, where?: string, registeredDevice?: string): void => {
    const problem = describeSaveError(cause, where);
    if (problem.forgetFolder) void forgetFolder();
    if (problem.recovery === 'none' || controllers.get(id)?.signal.aborted) {
      finish(id, { state: 'cancelled', label: 'Cancelled' });
      return;
    }
    finish(id, {
      state: 'error',
      label: 'Failed',
      error: { message: problem.message, recovery: problem.recovery, forgetFolder: problem.forgetFolder, registeredDevice },
    });
  };

  /** The folder must be usable now: allowed, present and writable. Checked before anything is prepared. */
  const useFolder = async (folder: SavableFolder): Promise<SavableFolder> => {
    if (!(await ensureFolderAccess(folder))) {
      const denied = new Error('denied');
      denied.name = 'NotAllowedError';
      throw denied;
    }
    await probeFolder(folder);
    return folder;
  };

  const tracker = (id: string, label: string) => {
    let track = trackProgress(undefined, now);
    return {
      reset: (total?: number) => {
        track = trackProgress(total, now);
      },
      set: (written: number, total?: number) => patch(id, { label, progress: track(written, total), notice: undefined }),
    };
  };

  const startBase = (request: BaseDownloadRequest): StartResult => {
    const key = `base:${request.deviceType}:${request.version}`;
    const started = begin('base', key, `balenaOS ${request.version} · ${request.deviceType}`, 'Starting the download');
    if (!started.ok) return started;
    const { id, controller } = started as { ok: true; id: string; controller: AbortController };
    void (async () => {
      let where = request.folder.name;
      try {
        const folder = await useFolder(request.folder);
        where = folder.name;
        if (await (deps.clearlyTooLittleSpace ?? clearlyTooLittleSpace)(2.5 * 1024 ** 3)) {
          patch(id, { notice: 'Your browser reports very little free space. An image needs roughly 2 to 8 GB; the save fails cleanly if it runs out.' });
        }
        const link = await deps.authFetch<TicketResponse>('/image-maker/os-downloads', {
          method: 'POST',
          body: JSON.stringify({ deviceType: request.deviceType, version: request.version }),
        });
        const name = baseImageFileName(request.deviceType, request.version);
        const file = await folder.getFileHandle(name, { create: true }); // appears in the folder only when complete
        const progress = tracker(id, 'Downloading balenaOS');
        progress.reset(link.sizeBytes);
        const bytes = await downloadResumable({
          urlFor: (from) => withFrom(link.downloadPath, from),
          file,
          knownTotal: link.sizeBytes,
          signal: controller.signal,
          fetchImpl: deps.fetchImpl,
          sleep: deps.sleep,
          onProgress: progress.set,
          onRetry: (info) =>
            patch(id, {
              notice:
                info.reason === 'restarting from the beginning'
                  ? 'Restarting the download from the beginning…'
                  : `The connection was interrupted. Resuming from ${formatBytes(info.written)} (attempt ${info.attempt + 1})…`,
            }),
        });
        patch(id, { label: 'Checking the saved file', notice: undefined });
        const verification = await verifySavedFile(file, bytes);
        if (!verification.ok) throw new Error(`${verification.problem} Download the base image again.`);
        await saveBaseImageMeta(folder, name, { deviceType: request.deviceType, version: request.version, size: bytes, savedAt: new Date(now()).toISOString() });
        finish(id, { state: 'done', label: 'Saved', outcome: { fileName: name, bytes, where: folder.name, verification } });
      } catch (error) {
        fail(id, error, where);
      }
    })();
    return { ok: true, id };
  };

  const startImage = (request: ImageRequest): StartResult => {
    const key = `image:${request.deviceType}:${request.version}:${request.fleetId}`;
    const started = begin('image', key, `Flash-ready image · ${request.fleetName}`, 'Starting');
    if (!started.ok) return started;
    const { id, controller } = started as { ok: true; id: string; controller: AbortController };
    void (async () => {
      let registered: string | undefined;
      let where = request.folder.name;
      try {
        const folder = await useFolder(request.folder);
        where = folder.name;
        const status = await findBaseImage(folder, request.deviceType, request.version);
        if (status.state !== 'present') throw new Error('The base image is not on this computer yet. Download it first.');
        patch(id, { label: 'Preparing the configuration' });
        const boot = await deps.authFetch<PatchResponse>('/image-maker/boot-patch', { method: 'POST', body: JSON.stringify(request.payload) });
        registered = boot.device?.uuid;
        const name = await uniqueFileName(folder, flashReadyFileName(request.fleetName, request.deviceType, request.version)); // never replaces an image
        const file = await folder.getFileHandle(name, { create: true });
        const progress = tracker(id, 'Creating the flash-ready image');
        progress.reset(status.file.size);
        const bytes = await createFlashReadyImage({
          base: status.file,
          target: file,
          patch: boot,
          signal: controller.signal,
          onProgress: (copied, total) => progress.set(copied, total),
        });
        patch(id, { label: 'Checking the saved image' });
        const verification = await verifyFlashReady(file, bytes, boot);
        finish(id, {
          state: 'done',
          label: 'Saved',
          outcome: { fileName: name, bytes, where: folder.name, verification, deviceUuid: registered, fleetId: request.fleetId, fleetName: request.fleetName },
        });
      } catch (error) {
        fail(id, error, where, registered);
      }
    })();
    return { ok: true, id };
  };

  return {
    getSnapshot: (): readonly Transfer[] => list,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    running,
    startBase,
    startImage,
    cancel: (id: string): void => controllers.get(id)?.abort(),
    /** Removes a finished transfer from the lists. */
    dismiss: (id: string): void => {
      if (list.find((item) => item.id === id)?.state === 'running') return;
      list = list.filter((item) => item.id !== id);
      emit();
    },
  };
};

/** The app's one store. */
export const transfers = createTransferStore();

export const useTransfers = (): readonly Transfer[] => useSyncExternalStore(transfers.subscribe, transfers.getSnapshot, transfers.getSnapshot);
