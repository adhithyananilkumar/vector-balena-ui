import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { wifiConnectionFile } from './wifi';

describe('wifiConnectionFile', () => {
  it('names the network and key in the NetworkManager format', () => {
    const file = wifiConnectionFile({ wifiSsid: 'Home Net', wifiKey: 'pw' }) ?? '';
    assert.match(file, /^\[connection\]\nid=resin-wifi-01\ntype=wifi\n/);
    assert.match(file, /\nssid=Home Net\n/);
    assert.match(file, /\[wifi-security\]\nauth-alg=open\nkey-mgmt=wpa-psk\npsk=pw\n/);
  });

  it('has no security section for an open network, and nothing without a network', () => {
    assert.doesNotMatch(wifiConnectionFile({ wifiSsid: 'open' }) ?? '', /wifi-security/);
    assert.equal(wifiConnectionFile({}), undefined);
  });
});
