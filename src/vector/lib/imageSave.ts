/**
 * Working with OS images on the user's own computer.
 *
 * Images are saved into a folder the user chooses (the File System Access API: Chrome, Edge and other Chromium
 * browsers). The folder doubles as a library: a base image (balenaOS exactly as published) is downloaded once and
 * reused, and a flash-ready image is made from it on this computer by writing the fleet's config.json over a copy.
 * Other browsers fall back to a plain download into their downloads folder.
 */

/** The write side of a file: what FileSystemWritableFileStream offers, and what tests stand in for. */
export interface FileWriter {
  write: (data: Uint8Array) => Promise<void>;
  seek: (position: number) => Promise<void>;
  truncate: (size: number) => Promise<void>;
  close: () => Promise<void>;
  abort: (reason?: unknown) => Promise<void>;
}

export interface SavableFile {
  name?: string;
  createWritable: () => Promise<FileWriter>;
  getFile?: () => Promise<File>;
}

export interface FolderEntry {
  kind: 'file' | 'directory';
  name: string;
}

export interface SavableFolder {
  name: string;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<SavableFile>;
  removeEntry?: (name: string) => Promise<void>;
  values?: () => AsyncIterable<FolderEntry>;
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
}

type PickerWindow = {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<SavableFolder>;
  showSaveFilePicker?: (options?: {
    id?: string;
    suggestedName?: string;
    startIn?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SavableFile & { name: string }>;
};

const pickers = (): PickerWindow => (typeof window === 'undefined' ? {} : (window as unknown as PickerWindow));

export const canPickFolder = (): boolean => typeof pickers().showDirectoryPicker === 'function';
export const canPickFile = (): boolean => typeof pickers().showSaveFilePicker === 'function';

/** The browser remembers the last folder for each id, so the next picker opens there. */
const PICKER_ID = 'vector-os-images';

export const chooseFolder = async (): Promise<SavableFolder> => {
  const pick = pickers().showDirectoryPicker;
  if (!pick) throw new Error('This browser cannot save into a folder you choose.');
  return pick({ id: PICKER_ID, mode: 'readwrite', startIn: 'downloads' });
};

/** Asks where to save one file; opens in the downloads folder the first time and in the last folder afterwards. */
export const chooseFile = async (suggestedName: string): Promise<SavableFile & { name: string }> => {
  const pick = pickers().showSaveFilePicker;
  if (!pick) throw new Error('This browser cannot choose a save location.');
  return pick({
    id: PICKER_ID,
    suggestedName,
    startIn: 'downloads',
    types: [{ description: 'Disk image', accept: { 'application/octet-stream': ['.img'] } }],
  });
};

/** The remembered folder is checked (and, from a click, re-authorised) before it is used. */
export const ensureFolderAccess = async (folder: SavableFolder): Promise<boolean> => {
  if (folder.queryPermission && (await folder.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  if (folder.requestPermission) return (await folder.requestPermission({ mode: 'readwrite' })) === 'granted';
  return true;
};

export class SaveCancelledError extends Error {
  constructor() {
    super('The download was cancelled.');
  }
}

/** A failure that retrying cannot fix (the server refused, the link expired, ...). */
export class DownloadFailedError extends Error {}

/** The local copy of a base image is not the one the server's patch was made for. */
export class BaseImageMismatchError extends Error {}

/* ---------------------------------------------------------------------------------------------------------------- */

/** What the page should offer after a failure. */
export type SaveRecovery = 'choose-folder' | 'allow-access' | 'retry' | 'redownload' | 'none';

export interface SaveProblem {
  message: string;
  recovery: SaveRecovery;
  /** The remembered folder cannot be used any more and should be forgotten. */
  forgetFolder?: boolean;
}

const errorName = (error: unknown): string => (error instanceof Error ? error.name : '');

/** Turns the browser's file errors into something a person can act on, and says what to offer next. */
export const describeSaveError = (error: unknown, where?: string): SaveProblem => {
  const place = where ? `"${where}"` : 'that location';
  if (error instanceof SaveCancelledError) return { message: 'The download was cancelled. Nothing was saved.', recovery: 'retry' };
  if (error instanceof BaseImageMismatchError) {
    return { message: `${error.message} Download the base image again.`, recovery: 'redownload' };
  }
  if (error instanceof DownloadFailedError) return { message: error.message, recovery: 'retry' };
  const text = error instanceof Error ? error.message : '';
  switch (errorName(error)) {
    case 'AbortError':
      return { message: 'The location dialog was closed. Nothing was saved.', recovery: 'none' };
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        message: `The browser is not allowed to write to ${place}. Allow access when it asks, or choose another folder.`,
        recovery: 'allow-access',
      };
    case 'NotFoundError':
    case 'TypeMismatchError':
    case 'InvalidStateError':
      return { message: `${place} was moved, renamed or removed. Choose a folder again.`, recovery: 'choose-folder', forgetFolder: true };
    case 'NoModificationAllowedError':
    case 'InvalidModificationError':
      return {
        message: `A file with this name in ${place} is open in another program or is read-only. Close it, or choose another folder.`,
        recovery: 'choose-folder',
      };
    case 'QuotaExceededError':
      return {
        message: `There is not enough free space for ${place}. An image needs roughly 2 to 8 GB. Free some space or choose another drive.`,
        recovery: 'choose-folder',
      };
    case 'NotReadableError':
    case 'UnknownError':
      return {
        message: `The drive reported an error while using ${place}. It may be full, disconnected or write-protected. Nothing was saved.`,
        recovery: 'choose-folder',
      };
    case 'TypeError':
      return {
        message: 'The connection to the Vector server was lost and could not be restored. Nothing was saved. Check your connection and try again.',
        recovery: 'retry',
      };
    default:
      if (/no space|disk is full|ENOSPC/i.test(text)) {
        return { message: `There is not enough free space for ${place}. Free some space or choose another drive.`, recovery: 'choose-folder' };
      }
      return { message: text || 'The image could not be saved.', recovery: 'retry' };
  }
};

/**
 * Proves a remembered folder still works before a large download starts (and before a device is registered for it):
 * writes one byte to a scratch file and removes it. Throws the browser's own error, for describeSaveError.
 */
export const probeFolder = async (folder: SavableFolder): Promise<void> => {
  const name = '.vector-write-test';
  const handle = await folder.getFileHandle(name, { create: true });
  const writer = await handle.createWritable();
  await writer.write(new Uint8Array([1]));
  await writer.close();
  await folder.removeEntry?.(name).catch(() => undefined);
};

/** A file name that does not replace an existing file: "name.img", then "name (2).img", "name (3).img", ... */
export const uniqueFileName = async (folder: SavableFolder, name: string): Promise<string> => {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; n <= 99; n += 1) {
    const candidate = n === 1 ? name : `${stem} (${n})${extension}`;
    try {
      await folder.getFileHandle(candidate, { create: false });
    } catch (error) {
      if (errorName(error) === 'NotFoundError') return candidate;
      if (errorName(error) !== 'TypeMismatchError') throw error; // a folder with that name: try the next one
    }
  }
  return `${stem}-${Date.now()}${extension}`;
};

/* ---------------------------------------------------------------------------------------------------------------- */

export interface Progress {
  written: number;
  total?: number;
  percent?: number;
  bytesPerSecond: number;
  etaSeconds?: number;
}

/** Progress, speed and time left from the bytes written so far. */
export const trackProgress = (total: number | undefined, now: () => number = Date.now) => {
  const start = now();
  let from = 0;
  return (written: number, newTotal?: number): Progress => {
    if (written < from) from = 0; // a restart from the beginning
    const seconds = Math.max((now() - start) / 1000, 0.001);
    const bytesPerSecond = Math.max(written - from, 0) / seconds;
    const known = newTotal ?? total;
    return {
      written,
      total: known,
      percent: known ? Math.min(100, (written / known) * 100) : undefined,
      bytesPerSecond,
      etaSeconds: known && bytesPerSecond > 0 && written > 0 ? Math.max(0, (known - written) / bytesPerSecond) : undefined,
    };
  };
};

/** "3 min 20 s", "45 s". */
export const formatDuration = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole} s`;
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return `${minutes} min ${whole % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/* ---------------------------------------------------------------------------------------------------------------- */

const waitFor = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new SaveCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new SaveCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const readError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    /* not JSON */
  }
  return `The server answered HTTP ${response.status}.`;
};

export interface ResumableDownload {
  /** The address to fetch, starting at byte \`from\` of the image (0 for the first attempt). */
  urlFor: (from: number) => string;
  file: SavableFile;
  onProgress?: (written: number, total?: number) => void;
  /** Called before each wait-and-retry so the page can say what is happening. */
  onRetry?: (info: { attempt: number; written: number; reason: string; waitMs: number }) => void;
  signal?: AbortSignal;
  /** Size of the image when it is already known (shown as a percentage). */
  knownTotal?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Streams an image into a file and keeps going when the connection drops: the file is kept open, and each new
 * attempt asks the server to continue at the byte where the last one stopped. A server that cannot continue from
 * there (inside the boot partition, whose timestamps differ from run to run) answers 409 and the file is restarted.
 * The file only appears in the folder when it is complete; a failure or cancel discards what was written.
 */
export const downloadResumable = async (options: ResumableDownload): Promise<number> => {
  const { urlFor, file, signal } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? waitFor;
  const maxAttempts = options.maxAttempts ?? 10;
  const writer = await file.createWritable();
  let written = 0;
  let total = options.knownTotal;
  let attempt = 0;
  try {
    for (;;) {
      attempt += 1;
      if (signal?.aborted) throw new SaveCancelledError();
      let reason: string | undefined;

      let response: Response | undefined;
      try {
        response = await fetchImpl(urlFor(written), { signal });
      } catch (error) {
        if (signal?.aborted) throw new SaveCancelledError();
        reason = error instanceof Error && error.message ? error.message : 'the connection failed';
      }

      if (response) {
        if (response.status === 409 && written > 0) {
          await writer.truncate(0); // the server cannot continue from here: start the file again
          await writer.seek(0);
          written = 0;
          options.onProgress?.(0, total);
          reason = 'restarting from the beginning';
        } else if (!response.ok || !response.body) {
          const message = await readError(response);
          if (response.status >= 500 || response.status === 429 || response.status === 408) reason = message;
          else throw new DownloadFailedError(message);
        } else {
          const promised = Number(response.headers.get('content-length'));
          const expected = Number.isFinite(promised) && promised > 0 ? promised : undefined;
          if (expected !== undefined) total = written + expected;
          options.onProgress?.(written, total);
          const reader = response.body.getReader();
          let received = 0;
          for (;;) {
            let chunk: ReadableStreamReadResult<Uint8Array>;
            try {
              chunk = await reader.read();
            } catch (error) {
              if (signal?.aborted) throw new SaveCancelledError();
              reason = error instanceof Error && error.message ? error.message : 'the connection was lost';
              break;
            }
            if (chunk.done) break;
            await writer.write(chunk.value); // a disk error here is not retried: it is thrown as it is
            written += chunk.value.byteLength;
            received += chunk.value.byteLength;
            options.onProgress?.(written, total);
          }
          if (reason === undefined && expected !== undefined && received !== expected) reason = 'the download was cut short';
          if (reason === undefined) {
            await writer.close();
            return written;
          }
        }
      }

      if (attempt >= maxAttempts) {
        throw new DownloadFailedError(
          `The download kept being interrupted (${reason}) and could not be completed after ${attempt} attempts. Check your connection and try again.`,
        );
      }
      const waitMs = reason === 'restarting from the beginning' ? 0 : Math.min(15_000, 1000 * 2 ** Math.min(attempt - 1, 4));
      options.onRetry?.({ attempt, written, reason: reason ?? 'unknown', waitMs });
      if (waitMs) await sleep(waitMs, signal);
    }
  } catch (error) {
    await writer.abort(error).catch(() => undefined); // nothing half-written stays in the folder
    throw error;
  }
};

/** Plain browser download (no folder choice): the browser's own downloads folder and settings apply. */
export const downloadWithBrowser = (url: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/* ---------------------------------------------------------------------------------------------------------------- */

export interface Verification {
  ok: boolean;
  problem?: string;
}

/** Reads a saved image back: the size must match what was received and the start must look like a disk image. */
export const verifySavedFile = async (file: SavableFile, expectedBytes: number): Promise<Verification> => {
  if (!file.getFile) return { ok: true }; // handle without read access: nothing to check against
  try {
    const saved = await file.getFile();
    if (saved.size !== expectedBytes) {
      return { ok: false, problem: `The saved file is ${saved.size} bytes but ${expectedBytes} were received.` };
    }
    const start = new Uint8Array(await saved.slice(0, 512).arrayBuffer());
    if (start.length < 512 || start[510] !== 0x55 || start[511] !== 0xaa) {
      return { ok: false, problem: 'The saved file does not start like a disk image.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, problem: 'The saved file could not be read back to check it.' };
  }
};

/**
 * Browsers cannot report free disk space. The storage estimate is the closest figure and can be generous, so it is
 * used only to warn when it says there is clearly not enough, never to claim there is.
 */
export const clearlyTooLittleSpace = async (neededBytes: number): Promise<boolean> => {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate || estimate.quota === undefined) return false;
    return estimate.quota - (estimate.usage ?? 0) < neededBytes;
  } catch {
    return false;
  }
};

/* ---------------------------------------------------------------------------------------------------------------- */
/* The local library of base images                                                                                  */

export interface BaseImageMeta {
  deviceType: string;
  version: string;
  /** Size of the image file; a file whose size differs from this was not saved completely. */
  size: number;
  savedAt: string;
}

export interface LocalBaseImage {
  name: string;
  meta: BaseImageMeta;
}

const META_SUFFIX = '.vector.json';

/** The file name of a base image in the library; the same pattern the server uses for its download. */
export const baseImageFileName = (deviceType: string, version: string): string =>
  `balenaOS-${deviceType}-${version.replace(/[^0-9A-Za-z.-]/g, '_')}.img`;

export const flashReadyFileName = (fleetName: string, deviceType: string, version: string): string =>
  `vector-${fleetName.replace(/[^0-9A-Za-z.-]+/g, '_').replace(/^_+|_+$/g, '') || 'fleet'}-${deviceType}-${version.replace(/[^0-9A-Za-z.-]/g, '_')}.img`;

const isNotFound = (error: unknown): boolean => errorName(error) === 'NotFoundError';

const readMeta = async (folder: SavableFolder, imageName: string): Promise<BaseImageMeta | undefined> => {
  try {
    const handle = await folder.getFileHandle(imageName + META_SUFFIX, { create: false });
    const text = await (await handle.getFile?.())?.text();
    if (text === undefined) return undefined;
    const parsed = JSON.parse(text) as Partial<BaseImageMeta>;
    if (typeof parsed.deviceType === 'string' && typeof parsed.version === 'string' && typeof parsed.size === 'number') {
      return { deviceType: parsed.deviceType, version: parsed.version, size: parsed.size, savedAt: String(parsed.savedAt ?? '') };
    }
  } catch {
    /* no record: not a complete base image */
  }
  return undefined;
};

export type BaseImageStatus =
  | { state: 'present'; name: string; file: File; meta: BaseImageMeta }
  | { state: 'incomplete'; name: string }
  | { state: 'missing' };

/**
 * Looks for a base image in the library. It counts only when the record written after a verified save is there and
 * the file is exactly the size the record says; anything else is reported as incomplete so it is downloaded again.
 */
export const findBaseImage = async (folder: SavableFolder, deviceType: string, version: string): Promise<BaseImageStatus> => {
  const name = baseImageFileName(deviceType, version);
  let file: File | undefined;
  try {
    const handle = await folder.getFileHandle(name, { create: false });
    file = await handle.getFile?.();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return { state: 'missing' };
  }
  if (!file) return { state: 'missing' };
  const meta = await readMeta(folder, name);
  if (!meta || meta.size !== file.size || meta.deviceType !== deviceType || meta.version !== version) return { state: 'incomplete', name };
  return { state: 'present', name, file, meta };
};

/** Writes the record that marks a saved base image as complete. Done last, after the image has been verified. */
export const saveBaseImageMeta = async (folder: SavableFolder, name: string, meta: BaseImageMeta): Promise<void> => {
  const handle = await folder.getFileHandle(name + META_SUFFIX, { create: true });
  const writer = await handle.createWritable();
  await writer.write(new TextEncoder().encode(JSON.stringify(meta, null, 2)));
  await writer.close();
};

/** The complete base images in the library, newest first. */
export const listBaseImages = async (folder: SavableFolder): Promise<LocalBaseImage[]> => {
  const found: LocalBaseImage[] = [];
  if (!folder.values) return found;
  const names: string[] = [];
  for await (const entry of folder.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.img' + META_SUFFIX)) names.push(entry.name.slice(0, -META_SUFFIX.length));
  }
  for (const name of names) {
    const meta = await readMeta(folder, name);
    if (!meta) continue;
    const status = await findBaseImage(folder, meta.deviceType, meta.version);
    if (status.state === 'present' && status.name === name) found.push({ name, meta: status.meta });
  }
  return found.sort((a, b) => b.meta.savedAt.localeCompare(a.meta.savedAt));
};

export const removeBaseImage = async (folder: SavableFolder, name: string): Promise<void> => {
  await folder.removeEntry?.(name + META_SUFFIX).catch(() => undefined); // the record first: the image is then "incomplete", never "present"
  await folder.removeEntry?.(name);
};

/* ---------------------------------------------------------------------------------------------------------------- */
/* Turning a local base image into a flash-ready one                                                                */

export interface BootPatch {
  bootEnd: number;
  headSha256: string;
  patches: Array<{ offset: number; data: string }>;
}

const toHex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (data: ArrayBuffer): Promise<string> => toHex(await crypto.subtle.digest('SHA-256', data));

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Makes a flash-ready image on this computer: checks that the local base image is the one the patch was made for
 * (same first partition, by SHA-256), copies it, and writes the patched boot-partition blocks over the copy. The base
 * image is only read. Returns the size written.
 */
export const createFlashReadyImage = async (options: {
  base: File;
  target: SavableFile;
  patch: BootPatch;
  onProgress?: (copied: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<number> => {
  const { base, target, patch, signal } = options;
  if (base.size < patch.bootEnd) {
    throw new BaseImageMismatchError('The base image on this computer is smaller than this OS version should be.');
  }
  const head = await base.slice(0, patch.bootEnd).arrayBuffer();
  if ((await sha256Hex(head)) !== patch.headSha256) {
    throw new BaseImageMismatchError('The base image on this computer does not match this OS version, so it cannot be used.');
  }

  const writer = await target.createWritable();
  try {
    const reader = base.stream().getReader();
    let copied = 0;
    for (;;) {
      if (signal?.aborted) throw new SaveCancelledError();
      const chunk = await reader.read();
      if (chunk.done) break;
      await writer.write(chunk.value);
      copied += chunk.value.byteLength;
      options.onProgress?.(copied, base.size);
    }
    for (const part of patch.patches) {
      await writer.seek(part.offset);
      await writer.write(fromBase64(part.data));
    }
    await writer.close();
    return base.size;
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    throw error;
  }
};

/** Reads a flash-ready image back: the right size, the patched blocks in place, and a disk signature. */
export const verifyFlashReady = async (file: SavableFile, expectedBytes: number, patch: BootPatch): Promise<Verification> => {
  const basic = await verifySavedFile(file, expectedBytes);
  if (!basic.ok || !file.getFile) return basic;
  try {
    const saved = await file.getFile();
    for (const part of patch.patches) {
      const wanted = fromBase64(part.data);
      const actual = new Uint8Array(await saved.slice(part.offset, part.offset + wanted.length).arrayBuffer());
      if (actual.length !== wanted.length || actual.some((byte, i) => byte !== wanted[i])) {
        return { ok: false, problem: 'The configuration was not written into the saved image correctly.' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, problem: 'The saved image could not be read back to check it.' };
  }
};

/* ---------------------------------------------------------------------------------------------------------------- */
/* The chosen folder is kept in IndexedDB (folder handles can be stored there, but not in localStorage).            */

const DB_NAME = 'vector-ui';
const STORE = 'handles';
const KEY = 'os-image-folder';

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
};

export const loadSavedFolder = async (): Promise<SavableFolder | undefined> => {
  try {
    return ((await withStore('readonly', (store) => store.get(KEY))) as SavableFolder | undefined) ?? undefined;
  } catch {
    return undefined; // private mode or storage blocked: the folder is simply not remembered
  }
};

export const saveFolder = async (folder: SavableFolder): Promise<void> => {
  try {
    await withStore('readwrite', (store) => store.put(folder, KEY));
  } catch {
    /* not remembered */
  }
};

export const forgetFolder = async (): Promise<void> => {
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch {
    /* nothing to forget */
  }
};
