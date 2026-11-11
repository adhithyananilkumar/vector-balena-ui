/**
 * Saving a large OS image on the user's own computer.
 *
 * The image is streamed from the Vector server into a file the user picked, without being held in memory. That needs
 * the File System Access API (Chrome, Edge and other Chromium browsers). Other browsers fall back to a plain download,
 * which goes to the browser's own downloads folder.
 */

type WritableLike = { getWriter?: unknown } & WritableStream<Uint8Array>;

export interface SavableFile {
  createWritable: () => Promise<WritableLike>;
}

export interface SavableFolder {
  name: string;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<SavableFile>;
  removeEntry?: (name: string) => Promise<void>;
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

/** Pipes a response body into a writable file, reporting the bytes written. Closes (or aborts) the file. */
export const copyResponseToFile = async (
  response: Response,
  file: SavableFile,
  onBytes: (written: number) => void,
  signal?: AbortSignal,
  onTotal?: (total: number | undefined) => void,
): Promise<number> => {
  if (!response.ok || !response.body) {
    let message = `The server answered HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const promised = Number(response.headers.get('content-length'));
  const expected = Number.isFinite(promised) && promised > 0 ? promised : undefined;
  onTotal?.(expected);
  let written = 0;
  const writable = await file.createWritable();
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength;
      onBytes(written);
      controller.enqueue(chunk);
    },
    flush(controller) {
      // before the file is closed: an image that is not the promised size must never be committed to disk
      if (expected !== undefined && written !== expected) {
        controller.error(new Error(`The image arrived incomplete (${written} of ${expected} bytes). Nothing was saved.`));
      }
    },
  });
  try {
    await response.body.pipeThrough(counter, { signal }).pipeTo(writable, { signal });
  } catch (error) {
    if (signal?.aborted) throw new SaveCancelledError();
    throw error;
  }
  return written;
};

/** What the page should offer after a failure. */
export type SaveRecovery = 'choose-folder' | 'allow-access' | 'retry' | 'none';

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
        message: `There is not enough free space for ${place}. The image needs roughly 2 to 8 GB. Free some space or choose another drive.`,
        recovery: 'choose-folder',
      };
    case 'NotReadableError':
    case 'UnknownError':
      return {
        message: `The drive reported an error while writing to ${place}. It may be full, disconnected or write-protected. Nothing was saved.`,
        recovery: 'choose-folder',
      };
    case 'TypeError':
      return {
        message:
          'The connection to the Vector server was lost. Nothing was saved. Check your connection and try again; the prepared image stays available for 30 minutes.',
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
  const writable = await handle.createWritable();
  const writer = writable.getWriter();
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

export interface Verification {
  ok: boolean;
  problem?: string;
}

/** Reads the saved file back: the size must match what was received and the start must look like a disk image. */
export const verifySavedFile = async (file: SavableFile, expectedBytes: number): Promise<Verification> => {
  const getFile = (file as { getFile?: () => Promise<File> }).getFile;
  if (!getFile) return { ok: true }; // handle without read access: nothing to check against
  try {
    const saved = await getFile.call(file);
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
  return (written: number): Progress => {
    const seconds = Math.max((now() - start) / 1000, 0.001);
    const bytesPerSecond = written / seconds;
    return {
      written,
      total,
      percent: total ? Math.min(100, (written / total) * 100) : undefined,
      bytesPerSecond,
      etaSeconds: total && bytesPerSecond > 0 && written > 0 ? Math.max(0, (total - written) / bytesPerSecond) : undefined,
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

/* The chosen folder is kept in IndexedDB (folder handles can be stored there, but not in localStorage). */

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
