import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { personalizeDoc, serverDomainFromApiUrl } from './personalize';

describe('serverDomainFromApiUrl', () => {
  it('drops the api label', () => {
    assert.equal(serverDomainFromApiUrl('https://api.fleet.example.com'), 'fleet.example.com');
    assert.equal(serverDomainFromApiUrl('https://api.example.com/'), 'example.com');
  });

  it('keeps hosts that do not start with api', () => {
    assert.equal(serverDomainFromApiUrl('https://balena.example.com'), 'balena.example.com');
  });

  it('gives up on local, address and invalid values', () => {
    assert.equal(serverDomainFromApiUrl(undefined), undefined);
    assert.equal(serverDomainFromApiUrl(''), undefined);
    assert.equal(serverDomainFromApiUrl('not a url'), undefined);
    assert.equal(serverDomainFromApiUrl('http://localhost:3000'), undefined);
    assert.equal(serverDomainFromApiUrl('https://10.0.0.5'), undefined);
    assert.equal(serverDomainFromApiUrl('https://api'), undefined);
  });
});

describe('personalizeDoc', () => {
  const source = [
    'export BALENARC_BALENA_URL=mydomain.com',
    'curl https://api.mydomain.com/ping',
    'VECTOR_ALLOWED_ORIGINS=https://admin.mydomain.com',
  ].join('\n');

  it('fills in the server domain and the UI address', () => {
    const out = personalizeDoc(source, 'https://api.fleet.example.com', 'https://vector.example.com');
    assert.equal(
      out,
      [
        'export BALENARC_BALENA_URL=fleet.example.com',
        'curl https://api.fleet.example.com/ping',
        'VECTOR_ALLOWED_ORIGINS=https://vector.example.com',
      ].join('\n'),
    );
  });

  it('leaves the placeholder alone when the API URL is not usable', () => {
    assert.equal(personalizeDoc(source, 'http://localhost:8080', 'http://localhost:3000'), source);
  });

  it('still fills in the server domain when the UI runs on localhost', () => {
    const out = personalizeDoc(source, 'https://api.example.com', 'http://localhost:3000');
    assert.match(out, /BALENARC_BALENA_URL=example\.com/);
    assert.match(out, /https:\/\/admin\.example\.com/);
  });
});
