/**
 * An in-memory stand-in for a folder and files chosen with the File System Access API, for tests: what is written
 * appears in the folder only when the writer is closed, and an aborted writer leaves nothing behind.
 */
import type { FileWriter, FolderEntry, SavableFile, SavableFolder } from './imageSave';

export const domError = (name: string, message = name): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

export interface MemoryFile extends SavableFile {
  content: () => Buffer | undefined;
  /** Makes the next write fail with this error (a full disk, say). */
  failNextWriteWith?: Error;
  state: { committed: boolean; aborted: boolean };
}

export const memoryFile = (initial?: Buffer): MemoryFile => {
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

export interface MemoryFolder extends SavableFolder {
  files: Map<string, MemoryFile>;
}

export const memoryFolder = (failWith?: Error): MemoryFolder => {
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

/** Bytes that look like a disk image: they end the first sector with the 0x55 0xAA signature. */
export const imageBytes = (size: number, signature = true): Buffer => {
  const bytes = Buffer.from(Array.from({ length: size }, (_, i) => (i * 13 + 5) & 0xff));
  if (signature) {
    bytes[510] = 0x55;
    bytes[511] = 0xaa;
  }
  return bytes;
};

/** A response body that delivers `parts` one pull at a time, then ends or fails like a dropped connection. */
export const streamOf = (parts: Buffer[], endWith?: Error): ReadableStream<Uint8Array> => {
  let next = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < parts.length) controller.enqueue(new Uint8Array(parts[next++]));
      else if (endWith) controller.error(endWith);
      else controller.close();
    },
  });
};
