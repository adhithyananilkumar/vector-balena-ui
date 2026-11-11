import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  copyResponseToFile,
  describeSaveError,
  ensureFolderAccess,
  formatDuration,
  probeFolder,
  SaveCancelledError,
  trackProgress,
  uniqueFileName,
  verifySavedFile,
  type SavableFile,
  type SavableFolder,
} from './imageSave';

const memoryFile = (): { file: SavableFile; written: () => Buffer; closed: () => boolean } => {
  const parts: Uint8Array[] = [];
  let closed = false;
  return {
    file: {
      createWritable: async () =>
        new WritableStream<Uint8Array>({
          write(chunk) {
            parts.push(chunk);
          },
          close() {
            closed = true;
          },
        }) as never,
    },
    written: () => Buffer.concat(parts),
    closed: () => closed,
  };
};

const bodyOf = (chunks: string[], delay = 0): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

describe('copyResponseToFile', () => {
  it('streams the body into the file and reports progress', async () => {
    const target = memoryFile();
    const seen: number[] = [];
    const total = await copyResponseToFile(new Response(bodyOf(['abc', 'defg', 'h'])), target.file, (n) => seen.push(n));
    assert.equal(total, 8);
    assert.deepEqual(seen, [3, 7, 8]);
    assert.equal(target.written().toString(), 'abcdefgh');
    assert.ok(target.closed());
  });

  it('turns an error answer into a readable message and writes nothing', async () => {
    const target = memoryFile();
    await assert.rejects(
      copyResponseToFile(new Response(JSON.stringify({ message: 'This download link is invalid or has expired.' }), { status: 404 }), target.file, () => undefined),
      /invalid or has expired/,
    );
    assert.equal(target.written().length, 0);
    await assert.rejects(copyResponseToFile(new Response('oops', { status: 500 }), target.file, () => undefined), /HTTP 500/);
  });

  it('stops when cancelled', async () => {
    const target = memoryFile();
    const controller = new AbortController();
    const copy = copyResponseToFile(new Response(bodyOf(['a', 'b', 'c', 'd'], 20)), target.file, () => undefined, controller.signal);
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(copy, SaveCancelledError);
    assert.ok(!target.closed());
  });
});

describe('ensureFolderAccess', () => {
  const folder = (query: PermissionState, request: PermissionState) => ({
    name: 'x',
    getFileHandle: async () => memoryFile().file,
    queryPermission: async () => query,
    requestPermission: async () => request,
  });

  it('uses a folder that is already allowed and asks for the others', async () => {
    assert.equal(await ensureFolderAccess(folder('granted', 'denied')), true);
    assert.equal(await ensureFolderAccess(folder('prompt', 'granted')), true);
    assert.equal(await ensureFolderAccess(folder('prompt', 'denied')), false);
  });
});

const domError = (name: string): Error => {
  const error = new Error(name);
  error.name = name;
  return error;
};

/** An in-memory folder: files by name, optional failures. */
const memoryFolder = (files: Record<string, number | 'folder'> = {}, failWith?: Error): SavableFolder & { files: Record<string, number | 'folder'> } => ({
  name: 'D:/balenaOS',
  files,
  async getFileHandle(name, options) {
    if (failWith) throw failWith;
    if (files[name] === 'folder') throw domError('TypeMismatchError');
    if (files[name] === undefined) {
      if (!options.create) throw domError('NotFoundError');
      files[name] = 0;
    }
    return memoryFile().file;
  },
  async removeEntry(name) {
    delete files[name];
  },
});

describe('copyResponseToFile promised length', () => {
  it('reports the promised size up front', async () => {
    const target = memoryFile();
    let total: number | undefined;
    await copyResponseToFile(new Response(bodyOf(['abcd']), { headers: { 'content-length': '4' } }), target.file, () => undefined, undefined, (n) => (total = n));
    assert.equal(total, 4);
  });

  it('never commits a file that is not the promised size', async () => {
    const target = memoryFile();
    await assert.rejects(
      copyResponseToFile(new Response(bodyOf(['abc']), { headers: { 'content-length': '10' } }), target.file, () => undefined),
      /incomplete \(3 of 10 bytes\)\. Nothing was saved/,
    );
    assert.ok(!target.closed(), 'the file was aborted, not closed');
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

  it('handles cancellation, full-disk text and unknown errors', () => {
    assert.equal(describeSaveError(new SaveCancelledError()).recovery, 'retry');
    assert.match(describeSaveError(new Error('write failed: No space left on device')).message, /not enough free space/);
    assert.equal(describeSaveError(new Error('')).message, 'The image could not be saved.');
    assert.equal(describeSaveError('weird').recovery, 'retry');
  });
});

describe('probeFolder', () => {
  it('writes and removes a scratch file in a working folder', async () => {
    const folder = memoryFolder();
    await probeFolder(folder);
    assert.deepEqual(Object.keys(folder.files), []);
  });

  it('throws the browser error for a folder that is gone or not allowed', async () => {
    await assert.rejects(probeFolder(memoryFolder({}, domError('NotFoundError'))), { name: 'NotFoundError' });
    await assert.rejects(probeFolder(memoryFolder({}, domError('NotAllowedError'))), { name: 'NotAllowedError' });
  });
});

describe('uniqueFileName', () => {
  it('keeps a free name and numbers the taken ones instead of replacing them', async () => {
    assert.equal(await uniqueFileName(memoryFolder(), 'vector-pi.img'), 'vector-pi.img');
    assert.equal(await uniqueFileName(memoryFolder({ 'vector-pi.img': 5 }), 'vector-pi.img'), 'vector-pi (2).img');
    assert.equal(await uniqueFileName(memoryFolder({ 'vector-pi.img': 5, 'vector-pi (2).img': 5 }), 'vector-pi.img'), 'vector-pi (3).img');
    assert.equal(await uniqueFileName(memoryFolder({ 'vector-pi.img': 'folder' }), 'vector-pi.img'), 'vector-pi (2).img', 'a folder with that name is not overwritten');
  });

  it('passes on unexpected errors', async () => {
    await assert.rejects(uniqueFileName(memoryFolder({}, domError('NotAllowedError')), 'x.img'), { name: 'NotAllowedError' });
  });
});

describe('verifySavedFile', () => {
  const fileOf = (bytes: Uint8Array): SavableFile => ({
    createWritable: async () => new WritableStream() as never,
    getFile: async () => new File([bytes as BlobPart], 'x.img'),
  } as SavableFile);
  const image = (size: number, signature = true): Uint8Array => {
    const bytes = new Uint8Array(size);
    if (signature) {
      bytes[510] = 0x55;
      bytes[511] = 0xaa;
    }
    return bytes;
  };

  it('accepts a file of the received size that starts like a disk', async () => {
    assert.deepEqual(await verifySavedFile(fileOf(image(2048)), 2048), { ok: true });
  });

  it('flags a wrong size, a wrong start and an unreadable file', async () => {
    assert.match((await verifySavedFile(fileOf(image(2048)), 4096)).problem ?? '', /2048 bytes but 4096/);
    assert.match((await verifySavedFile(fileOf(image(2048, false)), 2048)).problem ?? '', /does not start like a disk image/);
    const unreadable = { createWritable: async () => new WritableStream() as never, getFile: async () => { throw new Error('gone'); } } as unknown as SavableFile;
    assert.match((await verifySavedFile(unreadable, 1)).problem ?? '', /could not be read back/);
  });

  it('has nothing to check when the handle cannot be read', async () => {
    assert.deepEqual(await verifySavedFile({ createWritable: async () => new WritableStream() as never }, 1), { ok: true });
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

  it('has no percent or estimate when the total is unknown', () => {
    let clock = 0;
    const track = trackProgress(undefined, () => clock);
    clock = 1000;
    assert.deepEqual([track(100).percent, track(100).etaSeconds], [undefined, undefined]);
  });

  it('formats durations', () => {
    assert.deepEqual([formatDuration(4), formatDuration(200), formatDuration(7500)], ['4 s', '3 min 20 s', '2 h 5 min']);
  });
});
