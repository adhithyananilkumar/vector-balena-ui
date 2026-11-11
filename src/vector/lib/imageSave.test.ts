import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  baseImageFileName,
  BaseImageMismatchError,
  createFlashReadyImage,
  describeSaveError,
  DownloadFailedError,
  downloadResumable,
  ensureFolderAccess,
  findBaseImage,
  flashReadyFileName,
  formatDuration,
  listBaseImages,
  probeFolder,
  removeBaseImage,
  saveBaseImageMeta,
  SaveCancelledError,
  trackProgress,
  uniqueFileName,
  verifyFlashReady,
  verifySavedFile,
  type BootPatch,
  type FileWriter,
  type FolderEntry,
  type SavableFile,
  type SavableFolder,
} from './imageSave';

const domError = (name: string, message = name): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

/** A file like the browser's: what is written appears in the folder only when the writer is closed. */
interface MemoryFile extends SavableFile {
  content: () => Buffer | undefined;
  /** Makes the next write fail with this error (a full disk, say). */
  failNextWriteWith?: Error;
  state: { committed: boolean; aborted: boolean };
}
const memoryFile = (initial?: Buffer): MemoryFile => {
  let committed: Buffer | undefined = initial;
  const state = { committed: initial !== undefined, aborted: false };
  const file: MemoryFile = {
    state,
    content: () => committed,
    async createWritable() {
      let data = Buffer.alloc(0);
      let position = 0;
      const writer: FileWriter = {
        async write(chunk) {
          if (file.failNextWriteWith) {
            const error = file.failNextWriteWith;
            file.failNextWriteWith = undefined;
            throw error;
          }
          const end = position + chunk.byteLength;
          if (end > data.length) data = Buffer.concat([data, Buffer.alloc(end - data.length)]);
          Buffer.from(chunk).copy(data, position);
          position = end;
        },
        async seek(to) {
          position = to;
        },
        async truncate(size) {
          data = size < data.length ? data.subarray(0, size) : Buffer.concat([data, Buffer.alloc(size - data.length)]);
        },
        async close() {
          committed = Buffer.from(data);
          state.committed = true;
        },
        async abort() {
          state.aborted = true;
        },
      };
      return writer;
    },
    async getFile() {
      if (committed === undefined) throw domError('NotFoundError');
      return new File([committed as BlobPart], 'x.img');
    },
  };
  return file;
};

interface MemoryFolder extends SavableFolder {
  files: Map<string, MemoryFile>;
}
const memoryFolder = (failWith?: Error): MemoryFolder => {
  const files = new Map<string, MemoryFile>();
  return {
    name: 'D:/balenaOS',
    files,
    async getFileHandle(name, options) {
      if (failWith) throw failWith;
      const existing = files.get(name);
      if (existing) return existing;
      if (!options.create) throw domError('NotFoundError');
      const created = memoryFile();
      files.set(name, created);
      return created;
    },
    async removeEntry(name) {
      if (!files.delete(name)) throw domError('NotFoundError');
    },
    values() {
      const entries: FolderEntry[] = [...files.keys()].map((name) => ({ kind: 'file', name }));
      return (async function* () {
        yield* entries;
      })();
    },
  };
};

const sleepNone = async () => undefined;

/** A response whose body delivers `parts`, then either ends or fails like a dropped connection. */
const body = (parts: Buffer[], endWith?: Error): ReadableStream<Uint8Array> => {
  let next = 0;
  return new ReadableStream<Uint8Array>({
    // one chunk per pull, so everything before the failure has been delivered (an errored stream drops its queue)
    pull(controller) {
      if (next < parts.length) controller.enqueue(new Uint8Array(parts[next++]));
      else if (endWith) controller.error(endWith);
      else controller.close();
    },
  });
};

const data = Buffer.from(Array.from({ length: 10_000 }, (_, i) => (i * 7 + 3) & 0xff));

describe('downloadResumable', () => {
  it('streams the whole image into the file and reports progress and the total', async () => {
    const file = memoryFile();
    const seen: Array<[number, number | undefined]> = [];
    const written = await downloadResumable({
      urlFor: () => 'https://server.test/x',
      file,
      onProgress: (n, total) => seen.push([n, total]),
      fetchImpl: (async () => new Response(body([data.subarray(0, 4000), data.subarray(4000)]), { headers: { 'content-length': String(data.length) } })) as typeof fetch,
    });
    assert.equal(written, data.length);
    assert.ok(file.content()!.equals(data));
    assert.equal(seen[seen.length - 1][0], data.length);
    assert.equal(seen[seen.length - 1][1], data.length, 'the total is the promised length');
  });

  it('carries on from where it stopped when the connection drops, writing into the same file', async () => {
    const file = memoryFile();
    const asked: number[] = [];
    const retries: string[] = [];
    const fetchImpl = (async (url: string) => {
      const from = Number(new URL(url).searchParams.get('from'));
      asked.push(from);
      if (asked.length === 1) return new Response(body([data.subarray(0, 3000)], new TypeError('network error')));
      if (asked.length === 2) return new Response(body([data.subarray(from, from + 2000)], new TypeError('terminated')));
      return new Response(body([data.subarray(from)]), { headers: { 'content-length': String(data.length - from) } });
    }) as unknown as typeof fetch;
    const written = await downloadResumable({
      urlFor: (from) => `https://server.test/x?from=${from}`,
      file,
      fetchImpl,
      sleep: sleepNone,
      onRetry: (info) => retries.push(`${info.attempt}:${info.written}`),
    });
    assert.deepEqual(asked, [0, 3000, 5000], 'each attempt asks for the byte after the last one received');
    assert.deepEqual(retries, ['1:3000', '2:5000']);
    assert.equal(written, data.length);
    assert.ok(file.content()!.equals(data), 'no gap and no duplicate');
  });

  it('restarts the file when the server cannot continue from there (409)', async () => {
    const file = memoryFile();
    const asked: number[] = [];
    const fetchImpl = (async (url: string) => {
      const from = Number(new URL(url).searchParams.get('from'));
      asked.push(from);
      if (asked.length === 1) return new Response(body([data.subarray(0, 1500)], new TypeError('terminated')));
      if (from > 0) return new Response(JSON.stringify({ message: 'start again' }), { status: 409 });
      return new Response(body([data]), { headers: { 'content-length': String(data.length) } });
    }) as unknown as typeof fetch;
    await downloadResumable({ urlFor: (from) => `https://server.test/x?from=${from}`, file, fetchImpl, sleep: sleepNone });
    assert.deepEqual(asked, [0, 1500, 0]);
    assert.ok(file.content()!.equals(data), 'the partial data was discarded, not mixed in');
  });

  it('retries a busy or failing server but not a refusal', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      return calls < 3 ? new Response(JSON.stringify({ message: 'busy' }), { status: calls === 1 ? 429 : 503 }) : new Response(body([data]));
    }) as unknown as typeof fetch;
    const file = memoryFile();
    await downloadResumable({ urlFor: () => 'https://server.test/x', file, fetchImpl: flaky, sleep: sleepNone });
    assert.equal(calls, 3);
    assert.ok(file.content()!.equals(data));

    calls = 0;
    const refused = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ message: 'This download link is invalid or has expired.' }), { status: 404 });
    }) as unknown as typeof fetch;
    const target = memoryFile();
    await assert.rejects(downloadResumable({ urlFor: () => 'x', file: target, fetchImpl: refused, sleep: sleepNone }), DownloadFailedError);
    assert.equal(calls, 1, 'a 404 is not retried');
    assert.ok(target.state.aborted && !target.state.committed, 'nothing is left in the folder');
  });

  it('gives up after the allowed attempts and says why, leaving nothing behind', async () => {
    const file = memoryFile();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(body([], new TypeError('terminated')));
    }) as unknown as typeof fetch;
    await assert.rejects(
      downloadResumable({ urlFor: () => 'x', file, fetchImpl, sleep: sleepNone, maxAttempts: 4 }),
      /kept being interrupted \(terminated\).*4 attempts/,
    );
    assert.equal(calls, 4);
    assert.ok(file.state.aborted && !file.state.committed);
  });

  it('treats a body shorter than the promised length as an interruption', async () => {
    const file = memoryFile();
    let calls = 0;
    const fetchImpl = (async (url: string) => {
      calls += 1;
      const from = Number(new URL(url).searchParams.get('from'));
      if (calls === 1) return new Response(body([data.subarray(0, 100)]), { headers: { 'content-length': String(data.length) } });
      return new Response(body([data.subarray(from)]), { headers: { 'content-length': String(data.length - from) } });
    }) as unknown as typeof fetch;
    await downloadResumable({ urlFor: (from) => `https://server.test/x?from=${from}`, file, fetchImpl, sleep: sleepNone });
    assert.equal(calls, 2);
    assert.ok(file.content()!.equals(data));
  });

  it('does not retry a disk error and leaves nothing behind', async () => {
    const file = memoryFile();
    file.failNextWriteWith = domError('QuotaExceededError');
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(body([data]));
    }) as unknown as typeof fetch;
    await assert.rejects(downloadResumable({ urlFor: () => 'x', file, fetchImpl, sleep: sleepNone }), { name: 'QuotaExceededError' });
    assert.equal(calls, 1);
    assert.ok(file.state.aborted && !file.state.committed);
  });

  it('stops when cancelled, also while waiting to retry', async () => {
    const controller = new AbortController();
    const file = memoryFile();
    const fetchImpl = (async () => new Response(body([], new TypeError('terminated')))) as unknown as typeof fetch;
    const waiting = downloadResumable({
      urlFor: () => 'x',
      file,
      fetchImpl,
      signal: controller.signal,
      sleep: (_ms, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new SaveCancelledError()))),
    });
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(waiting, SaveCancelledError);
    assert.ok(file.state.aborted && !file.state.committed);
  });
});

describe('describeSaveError', () => {
  const cases: Array<[string, RegExp, string, boolean]> = [
    ['NotAllowedError', /not allowed to write/, 'allow-access', false],
    ['NotFoundError', /moved, renamed or removed/, 'choose-folder', true],
    ['InvalidStateError', /moved, renamed or removed/, 'choose-folder', true],
    ['NoModificationAllowedError', /open in another program/, 'choose-folder', false],
    ['QuotaExceededError', /not enough free space/, 'choose-folder', false],
    ['NotReadableError', /drive reported an error/, 'choose-folder', false],
    ['TypeError', /connection to the Vector server was lost/, 'retry', false],
    ['AbortError', /dialog was closed/, 'none', false],
  ];
  for (const [name, message, recovery, forget] of cases) {
    it(`explains ${name} and says what to offer`, () => {
      const problem = describeSaveError(domError(name), 'D:/balenaOS');
      assert.match(problem.message, message);
      assert.equal(problem.recovery, recovery);
      assert.equal(Boolean(problem.forgetFolder), forget);
    });
  }

  it('handles cancellation, refusals, a mismatched base image, full-disk text and unknown errors', () => {
    assert.equal(describeSaveError(new SaveCancelledError()).recovery, 'retry');
    assert.equal(describeSaveError(new DownloadFailedError('This download link is invalid or has expired.')).message, 'This download link is invalid or has expired.');
    const mismatch = describeSaveError(new BaseImageMismatchError('The base image does not match.'));
    assert.equal(mismatch.recovery, 'redownload');
    assert.match(mismatch.message, /Download the base image again/);
    assert.match(describeSaveError(new Error('write failed: No space left on device')).message, /not enough free space/);
    assert.equal(describeSaveError(new Error('')).message, 'The image could not be saved.');
    assert.equal(describeSaveError('weird').recovery, 'retry');
  });
});

describe('ensureFolderAccess', () => {
  const folder = (query: PermissionState, request: PermissionState): SavableFolder => ({
    name: 'x',
    getFileHandle: async () => memoryFile(),
    queryPermission: async () => query,
    requestPermission: async () => request,
  });

  it('uses a folder that is already allowed and asks for the others', async () => {
    assert.equal(await ensureFolderAccess(folder('granted', 'denied')), true);
    assert.equal(await ensureFolderAccess(folder('prompt', 'granted')), true);
    assert.equal(await ensureFolderAccess(folder('prompt', 'denied')), false);
  });
});

describe('probeFolder and uniqueFileName', () => {
  it('writes and removes a scratch file in a working folder', async () => {
    const folder = memoryFolder();
    await probeFolder(folder);
    assert.equal(folder.files.size, 0);
  });

  it('throws the browser error for a folder that is gone or not allowed', async () => {
    await assert.rejects(probeFolder(memoryFolder(domError('NotFoundError'))), { name: 'NotFoundError' });
    await assert.rejects(probeFolder(memoryFolder(domError('NotAllowedError'))), { name: 'NotAllowedError' });
  });

  it('keeps a free name and numbers the taken ones instead of replacing them', async () => {
    const folder = memoryFolder();
    assert.equal(await uniqueFileName(folder, 'vector-pi.img'), 'vector-pi.img');
    await folder.getFileHandle('vector-pi.img', { create: true });
    assert.equal(await uniqueFileName(folder, 'vector-pi.img'), 'vector-pi (2).img');
    await folder.getFileHandle('vector-pi (2).img', { create: true });
    assert.equal(await uniqueFileName(folder, 'vector-pi.img'), 'vector-pi (3).img');
    await assert.rejects(uniqueFileName(memoryFolder(domError('NotAllowedError')), 'x.img'), { name: 'NotAllowedError' });
  });
});

const imageBytes = (size: number, signature = true): Buffer => {
  const bytes = Buffer.from(Array.from({ length: size }, (_, i) => (i * 13 + 5) & 0xff));
  if (signature) {
    bytes[510] = 0x55;
    bytes[511] = 0xaa;
  }
  return bytes;
};

describe('verifySavedFile', () => {
  it('accepts a file of the received size that starts like a disk', async () => {
    assert.deepEqual(await verifySavedFile(memoryFile(imageBytes(2048)), 2048), { ok: true });
  });

  it('flags a wrong size, a wrong start and an unreadable file', async () => {
    assert.match((await verifySavedFile(memoryFile(imageBytes(2048)), 4096)).problem ?? '', /2048 bytes but 4096/);
    assert.match((await verifySavedFile(memoryFile(imageBytes(2048, false)), 2048)).problem ?? '', /does not start like a disk image/);
    assert.match((await verifySavedFile(memoryFile(), 1)).problem ?? '', /could not be read back/);
    assert.deepEqual(await verifySavedFile({ createWritable: async () => memoryFile().createWritable() }, 1), { ok: true });
  });
});

describe('the local base image library', () => {
  const save = async (folder: MemoryFolder, deviceType: string, version: string, content: Buffer, withRecord = true) => {
    const name = baseImageFileName(deviceType, version);
    const handle = await folder.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    await writer.write(content);
    await writer.close();
    if (withRecord) await saveBaseImageMeta(folder, name, { deviceType, version, size: content.length, savedAt: new Date().toISOString() });
    return name;
  };

  it('names files the way the server does', () => {
    assert.equal(baseImageFileName('raspberrypi4-64', '9.0.3+rev2'), 'balenaOS-raspberrypi4-64-9.0.3_rev2.img');
    assert.equal(flashReadyFileName('My Fleet!', 'raspberrypi4-64', '9.0.3+rev2'), 'vector-My_Fleet-raspberrypi4-64-9.0.3_rev2.img');
    assert.equal(flashReadyFileName('???', 'x', '1'), 'vector-fleet-x-1.img');
  });

  it('finds a complete base image and reads it, so it does not have to be downloaded again', async () => {
    const folder = memoryFolder();
    await save(folder, 'raspberrypi4-64', '9.0.3+rev2', imageBytes(4096));
    const status = await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2');
    assert.equal(status.state, 'present');
    if (status.state === 'present') assert.equal(status.file.size, 4096);
  });

  it('reports missing, and incomplete for a file without its record or of a different size', async () => {
    const folder = memoryFolder();
    assert.deepEqual(await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2'), { state: 'missing' });

    await save(folder, 'raspberrypi4-64', '9.0.3+rev2', imageBytes(4096), false);
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2')).state, 'incomplete', 'no record: it may be a partial copy');

    await save(folder, 'raspberrypi4-64', '9.0.2', imageBytes(4096));
    const writer = await folder.files.get(baseImageFileName('raspberrypi4-64', '9.0.2'))!.createWritable();
    await writer.write(imageBytes(1000)); // replaced by something shorter
    await writer.truncate(1000);
    await writer.close();
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.2')).state, 'incomplete', 'size differs from the record');
  });

  it('lists the complete ones and removes an image together with its record', async () => {
    const folder = memoryFolder();
    await save(folder, 'raspberrypi4-64', '9.0.3+rev2', imageBytes(4096));
    await save(folder, 'generic-amd64', '9.0.2', imageBytes(2048));
    await save(folder, 'raspberrypi3', '8.0.0', imageBytes(1024), false);
    const listed = await listBaseImages(folder);
    assert.deepEqual(listed.map((item) => item.meta.deviceType).sort(), ['generic-amd64', 'raspberrypi4-64']);

    await removeBaseImage(folder, baseImageFileName('raspberrypi4-64', '9.0.3+rev2'));
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2')).state, 'missing');
    assert.equal((await listBaseImages(folder)).length, 1);
  });
});

describe('createFlashReadyImage', () => {
  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const base = imageBytes(300_000);
  const bootEnd = 100_000;
  const patchData = Buffer.from('{"applicationId":7,"note":"written into the boot partition"}');
  const patch: BootPatch = {
    bootEnd,
    headSha256: sha256(base.subarray(0, bootEnd)),
    patches: [
      { offset: 4096, data: patchData.toString('base64') },
      { offset: 70_000, data: Buffer.from('second block').toString('base64') },
    ],
  };
  const expected = Buffer.from(base);
  patchData.copy(expected, 4096);
  Buffer.from('second block').copy(expected, 70_000);

  it('copies the base image and writes the patched blocks over the copy, leaving the base untouched', async () => {
    const baseFile = memoryFile(base);
    const target = memoryFile();
    const progress: number[] = [];
    const size = await createFlashReadyImage({ base: await baseFile.getFile!(), target, patch, onProgress: (n) => progress.push(n) });
    assert.equal(size, base.length);
    assert.ok(target.content()!.equals(expected));
    assert.ok(baseFile.content()!.equals(base), 'the base image is only read');
    assert.equal(progress[progress.length - 1], base.length);
    assert.deepEqual(await verifyFlashReady(target, base.length, patch), { ok: true });
  });

  it('refuses a base image that is not the one the patch was made for, and writes nothing', async () => {
    const other = Buffer.from(base);
    other[50_000] ^= 0xff;
    const target = memoryFile();
    await assert.rejects(createFlashReadyImage({ base: new File([other as BlobPart], 'b.img'), target, patch }), BaseImageMismatchError);
    assert.equal(target.state.committed || target.state.aborted, false, 'the target file is never even opened');
    await assert.rejects(createFlashReadyImage({ base: new File([base.subarray(0, 1000) as BlobPart], 'b.img'), target, patch }), /smaller than/);
  });

  it('stops when cancelled and leaves no file', async () => {
    const controller = new AbortController();
    controller.abort();
    const target = memoryFile();
    await assert.rejects(createFlashReadyImage({ base: new File([base as BlobPart], 'b.img'), target, patch, signal: controller.signal }), SaveCancelledError);
    assert.ok(target.state.aborted && !target.state.committed);
  });

  it('a disk error while copying leaves no file', async () => {
    const target = memoryFile();
    target.failNextWriteWith = domError('QuotaExceededError');
    await assert.rejects(createFlashReadyImage({ base: new File([base as BlobPart], 'b.img'), target, patch }), { name: 'QuotaExceededError' });
    assert.ok(target.state.aborted && !target.state.committed);
  });

  it('verifyFlashReady notices a patch that did not make it into the file', async () => {
    const tampered = Buffer.from(expected);
    tampered[4100] ^= 0xff;
    assert.match((await verifyFlashReady(memoryFile(tampered), tampered.length, patch)).problem ?? '', /not written into the saved image correctly/);
    assert.match((await verifyFlashReady(memoryFile(expected.subarray(0, 1000)), tampered.length, patch)).problem ?? '', /bytes but/);
  });
});

describe('progress', () => {
  it('computes percent, speed and time left', () => {
    let clock = 0;
    const track = trackProgress(1000, () => clock);
    clock = 2000;
    const p = track(500);
    assert.equal(p.percent, 50);
    assert.equal(p.bytesPerSecond, 250);
    assert.equal(p.etaSeconds, 2);
  });

  it('has no percent or estimate when the total is unknown, and learns it when it becomes known', () => {
    let clock = 0;
    const track = trackProgress(undefined, () => clock);
    clock = 1000;
    assert.deepEqual([track(100).percent, track(100).etaSeconds], [undefined, undefined]);
    assert.equal(track(100, 400).percent, 25);
  });

  it('formats durations', () => {
    assert.deepEqual([formatDuration(4), formatDuration(200), formatDuration(7500)], ['4 s', '3 min 20 s', '2 h 5 min']);
  });
});
