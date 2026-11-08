import assert from 'node:assert/strict';
import test from 'node:test';
import { withServerBase } from '../dataProvider/httpClient';
import { serverBase, serverUrl, serverWebSocketUrl } from './serverUrl';

const withServerEnv = <T>(value: string | undefined, run: () => T): T => {
  const globals = globalThis as { __OBUI_ENV__?: Record<string, string | undefined> };
  const previous = globals.__OBUI_ENV__;
  globals.__OBUI_ENV__ = { REACT_APP_VECTOR_SERVER_URL: value };
  try {
    return run();
  } finally {
    globals.__OBUI_ENV__ = previous;
  }
};

test('without a server URL the UI talks to its own origin', () => {
  withServerEnv(undefined, () => {
    assert.equal(serverBase(), '');
    assert.equal(serverUrl('/admin-db/user'), '/admin-db/user');
    assert.equal(serverWebSocketUrl('/remote/ws', { protocol: 'https:', host: 'ui.example.com' }), 'wss://ui.example.com/remote/ws');
    assert.equal(serverWebSocketUrl('/remote/ws', { protocol: 'http:', host: 'localhost:3000' }), 'ws://localhost:3000/remote/ws');
  });
});

test('with a server URL requests and sockets go to that server', () => {
  withServerEnv(' https://vector.example.com/ ', () => {
    assert.equal(serverBase(), 'https://vector.example.com');
    assert.equal(serverUrl('/image-maker/versions?deviceType=x'), 'https://vector.example.com/image-maker/versions?deviceType=x');
    assert.equal(serverWebSocketUrl('/remote/ws'), 'wss://vector.example.com/remote/ws');
  });
  withServerEnv('http://10.0.0.5:3001', () => {
    assert.equal(serverWebSocketUrl('/remote/ws'), 'ws://10.0.0.5:3001/remote/ws');
  });
});

test('only root-relative requests are redirected to the server', async () => {
  const seen: string[] = [];
  const client = withServerBase(async (url) => {
    seen.push(url);
    return { status: 200, headers: new Headers(), body: '', json: {} };
  });
  await withServerEnv('https://vector.example.com', async () => {
    await client('/admin-db/user');
    await client('https://api.example.com/v7/device');
    await client('//cdn.example.com/x');
  });
  assert.deepEqual(seen, ['https://vector.example.com/admin-db/user', 'https://api.example.com/v7/device', '//cdn.example.com/x']);
});
