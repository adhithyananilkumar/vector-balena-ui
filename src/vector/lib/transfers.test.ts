import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { createTransferStore, type Transfer, type TransferDeps } from './transfers';
import { findBaseImage, saveBaseImageMeta, baseImageFileName } from './imageSave';
import { domError, imageBytes, memoryFile, memoryFolder, streamOf, type MemoryFolder } from './memoryFs';

const image = imageBytes(20_000);

const sleepNone = async () => undefined;

interface Fake {
  deps: TransferDeps;
  calls: string[];
}

/** A fake Vector server: hands out a download link, serves the image from `from`, and builds boot patches. */
const fakeServer = (
  options: {
    body?: (from: number, call: number) => Response;
    patch?: () => unknown;
    ticketError?: Error;
  } = {},
): Fake => {
  const calls: string[] = [];
  let downloads = 0;
  const authFetch = (async (path: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/image-maker/os-downloads') {
      if (options.ticketError) throw options.ticketError;
      return { job: { id: 'a'.repeat(32), fileName: 'x.img' }, downloadPath: '/image-maker/images/abc/download?expires=1&signature=2', sizeBytes: image.length };
    }
    if (path === '/image-maker/boot-patch') return options.patch ? options.patch() : bootPatchFor(image);
    throw new Error(`unexpected ${path}`);
  }) as unknown as TransferDeps['authFetch'];
  const fetchImpl = (async (url: string) => {
    downloads += 1;
    const from = Number(new URL(url, 'http://x.test').searchParams.get('from'));
    calls.push(`GET download from=${from}`);
    if (options.body) return options.body(from, downloads);
    return new Response(streamOf([image.subarray(from)]), { headers: { 'content-length': String(image.length - from) } });
  }) as unknown as typeof fetch;
  return { deps: { authFetch, fetchImpl, sleep: sleepNone, clearlyTooLittleSpace: async () => false }, calls };
};

const bootPatchFor = (base: Buffer) => {
  const bootEnd = 8192;
  const data = Buffer.from('{"applicationId":7}');
  return {
    bootEnd,
    headSha256: createHash('sha256').update(base.subarray(0, bootEnd)).digest('hex'),
    patches: [{ offset: 2048, data: data.toString('base64') }],
    fileName: 'x.img',
    device: { id: 5, uuid: 'd'.repeat(32) },
  };
};

const settle = async (store: ReturnType<typeof createTransferStore>, id: string): Promise<Transfer> => {
  for (let i = 0; i < 400; i += 1) {
    const found = store.getSnapshot().find((item) => item.id === id);
    if (found && found.state !== 'running') return found;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the transfer never finished');
};

const folderWithBase = async (): Promise<MemoryFolder> => {
  const folder = memoryFolder();
  const name = baseImageFileName('raspberrypi4-64', '9.0.3+rev2');
  const handle = await folder.getFileHandle(name, { create: true });
  const writer = await handle.createWritable();
  await writer.write(image);
  await writer.close();
  await saveBaseImageMeta(folder, name, { deviceType: 'raspberrypi4-64', version: '9.0.3+rev2', size: image.length, savedAt: 'now' });
  return folder;
};

const request = (folder: MemoryFolder) => ({ folder, deviceType: 'raspberrypi4-64', version: '9.0.3+rev2' });

describe('base image download', () => {
  it('runs in the store, not in a page: it can be followed, finishes, and is kept until dismissed', async () => {
    const folder = memoryFolder();
    const store = createTransferStore(fakeServer().deps);
    const changes: string[] = [];
    store.subscribe(() => changes.push(store.getSnapshot().map((item) => item.state).join()));

    const started = store.startBase(request(folder));
    assert.ok(started.ok);
    assert.equal(store.running()?.state, 'running');
    const done = await settle(store, started.ok ? started.id : '');

    assert.equal(done.state, 'done');
    assert.equal(done.outcome?.fileName, baseImageFileName('raspberrypi4-64', '9.0.3+rev2'));
    assert.equal(done.outcome?.bytes, image.length);
    assert.deepEqual(done.outcome?.verification, { ok: true });
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2')).state, 'present', 'recorded as complete');
    assert.ok(changes.length >= 3 && changes.includes('running') && changes[changes.length - 1] === 'done', 'subscribers saw it progress');

    // the result is still there for whoever looks next (another page, the tray)
    assert.equal(store.getSnapshot().length, 1);
    store.dismiss(done.id);
    assert.equal(store.getSnapshot().length, 0);
  });

  it('reports progress with the size the server announced', async () => {
    const store = createTransferStore(fakeServer().deps);
    const seen: Array<number | undefined> = [];
    store.subscribe(() => seen.push(store.getSnapshot()[0]?.progress?.percent));
    const started = store.startBase(request(memoryFolder()));
    await settle(store, started.ok ? started.id : '');
    assert.ok(seen.some((percent) => percent === 100), 'reached 100 %');
  });

  it('allows one large transfer at a time and says which one is running', async () => {
    const server = fakeServer({ body: () => new Response(new ReadableStream({ start() {} })) }); // never finishes
    const store = createTransferStore(server.deps);
    const first = store.startBase(request(memoryFolder()));
    assert.ok(first.ok);

    const same = store.startBase(request(memoryFolder()));
    assert.ok(!same.ok && same.reason === 'same');
    const other = store.startBase({ ...request(memoryFolder()), version: '9.0.2' });
    assert.ok(!other.ok && other.reason === 'busy' && other.running.title.includes('9.0.3+rev2'));
    const image2 = store.startImage({ ...request(memoryFolder()), fleetId: 1, fleetName: 'F', payload: {} });
    assert.ok(!image2.ok && image2.reason === 'busy');

    store.cancel(first.ok ? first.id : '');
    await settle(store, first.ok ? first.id : '');
  });

  it('can be cancelled, leaves no file or record, and a new one can then start', async () => {
    const folder = memoryFolder();
    const server = fakeServer({ body: () => new Response(streamOf([image.subarray(0, 100)], undefined)) });
    // a body that stalls after the first chunk
    server.deps.fetchImpl = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(new Uint8Array(100));
            return new Promise((resolve) => setTimeout(resolve, 20));
          },
        }),
      )) as unknown as typeof fetch;
    const store = createTransferStore(server.deps);
    const started = store.startBase(request(folder));
    assert.ok(started.ok);
    await new Promise((resolve) => setTimeout(resolve, 60));
    store.cancel(started.ok ? started.id : '');
    const result = await settle(store, started.ok ? started.id : '');
    assert.equal(result.state, 'cancelled');
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2')).state, 'missing', 'nothing was committed');
    assert.ok(store.startBase(request(folder)).ok, 'the next download can start');
    store.cancel(store.running()!.id);
  });

  it('carries on after the connection drops, and says so while it does', async () => {
    const notices: string[] = [];
    const server = fakeServer({
      body: (from, call) =>
        call === 1
          ? new Response(streamOf([image.subarray(0, 5000)], new TypeError('terminated')))
          : new Response(streamOf([image.subarray(from)]), { headers: { 'content-length': String(image.length - from) } }),
    });
    const store = createTransferStore(server.deps);
    store.subscribe(() => {
      const notice = store.getSnapshot()[0]?.notice;
      if (notice) notices.push(notice);
    });
    const folder = memoryFolder();
    const started = store.startBase(request(folder));
    const done = await settle(store, started.ok ? started.id : '');
    assert.equal(done.state, 'done');
    assert.ok(notices.some((text) => /Resuming from 4\.9 KB/.test(text)), notices.join(' | '));
    assert.deepEqual(server.calls.filter((call) => call.startsWith('GET download')), ['GET download from=0', 'GET download from=5000']);
    assert.equal((await findBaseImage(folder, 'raspberrypi4-64', '9.0.3+rev2')).state, 'present');
  });

  it('turns failures into messages with the right next step', async () => {
    const refused = createTransferStore(fakeServer({ body: () => new Response(JSON.stringify({ message: 'This download link is invalid or has expired.' }), { status: 404 }) }).deps);
    const a = refused.startBase(request(memoryFolder()));
    const failed = await settle(refused, a.ok ? a.id : '');
    assert.equal(failed.state, 'error');
    assert.equal(failed.error?.message, 'This download link is invalid or has expired.');
    assert.equal(failed.error?.recovery, 'retry');

    const gone = createTransferStore(fakeServer().deps);
    const b = gone.startBase(request(memoryFolder(domError('NotFoundError'))));
    const missing = await settle(gone, b.ok ? b.id : '');
    assert.equal(missing.error?.recovery, 'choose-folder');
    assert.equal(missing.error?.forgetFolder, true, 'the page is told the remembered folder is unusable');

    const denied = createTransferStore(fakeServer().deps);
    const folder = { ...memoryFolder(), queryPermission: async () => 'prompt' as const, requestPermission: async () => 'denied' as const };
    const c = denied.startBase(request(folder));
    assert.equal((await settle(denied, c.ok ? c.id : '')).error?.recovery, 'allow-access');

    const full = memoryFolder();
    const file = memoryFile();
    file.failNextWriteWith = domError('QuotaExceededError');
    full.files.set(baseImageFileName('raspberrypi4-64', '9.0.3+rev2'), file);
    const d = createTransferStore(fakeServer().deps);
    const noSpace = await settle(d, (d.startBase(request(full)) as { id: string }).id);
    assert.match(noSpace.error?.message ?? '', /not enough free space/);
  });

  it('warns while a transfer is running that leaving the tab would lose it, and stops warning afterwards', async () => {
    const listeners = new Set<unknown>();
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      addEventListener: (type: string, listener: unknown) => type === 'beforeunload' && listeners.add(listener),
      removeEventListener: (type: string, listener: unknown) => type === 'beforeunload' && listeners.delete(listener),
    };
    try {
      const store = createTransferStore(fakeServer().deps);
      const started = store.startBase(request(memoryFolder()));
      assert.equal(listeners.size, 1);
      await settle(store, started.ok ? started.id : '');
      assert.equal(listeners.size, 0);
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });
});

describe('flash-ready image', () => {
  const fleet = { fleetId: 3, fleetName: 'JLMj', payload: { appId: 3 } };

  it('is made from the local base image, with the device that was registered reported', async () => {
    const folder = await folderWithBase();
    const server = fakeServer();
    const store = createTransferStore(server.deps);
    const started = store.startImage({ ...request(folder), ...fleet });
    const done = await settle(store, started.ok ? started.id : '');
    assert.equal(done.state, 'done', done.error?.message);
    assert.equal(done.outcome?.fileName, 'vector-JLMj-raspberrypi4-64-9.0.3_rev2.img');
    assert.equal(done.outcome?.deviceUuid, 'd'.repeat(32));
    assert.equal(done.outcome?.fleetName, 'JLMj');
    assert.deepEqual(done.outcome?.verification, { ok: true });
    const made = folder.files.get(done.outcome!.fileName)!.content()!;
    assert.equal(made.length, image.length);
    assert.equal(made.subarray(2048, 2048 + 19).toString(), '{"applicationId":7}');
    assert.ok(made.subarray(9000).equals(image.subarray(9000)), 'the rest is the base image');
    assert.ok(!server.calls.some((call) => call.startsWith('GET download')), 'nothing is downloaded: the base image is local');
  });

  it('does not replace an image made earlier', async () => {
    const folder = await folderWithBase();
    const store = createTransferStore(fakeServer().deps);
    const first = await settle(store, (store.startImage({ ...request(folder), ...fleet }) as { id: string }).id);
    const second = await settle(store, (store.startImage({ ...request(folder), ...fleet }) as { id: string }).id);
    assert.equal(first.outcome?.fileName, 'vector-JLMj-raspberrypi4-64-9.0.3_rev2.img');
    assert.equal(second.outcome?.fileName, 'vector-JLMj-raspberrypi4-64-9.0.3_rev2 (2).img');
  });

  it('needs the base image and says so, before asking the server for anything', async () => {
    const server = fakeServer();
    const store = createTransferStore(server.deps);
    const failed = await settle(store, (store.startImage({ ...request(memoryFolder()), ...fleet }) as { id: string }).id);
    assert.equal(failed.state, 'error');
    assert.match(failed.error?.message ?? '', /not on this computer yet/);
    assert.deepEqual(server.calls, []);
  });

  it('refuses a base image that is not the one the server prepared the patch for, and offers a fresh download', async () => {
    const folder = await folderWithBase();
    const wrong = bootPatchFor(imageBytes(20_000, false)); // hash of different bytes
    const store = createTransferStore(fakeServer({ patch: () => wrong }).deps);
    const failed = await settle(store, (store.startImage({ ...request(folder), ...fleet }) as { id: string }).id);
    assert.equal(failed.error?.recovery, 'redownload');
    assert.match(failed.error?.message ?? '', /Download the base image again/);
    assert.equal(failed.error?.registeredDevice, 'd'.repeat(32), 'it says a device had already been registered');
  });
});
