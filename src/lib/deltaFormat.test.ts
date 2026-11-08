import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDuration, savedPercent } from './deltaFormat';

test('durations read naturally', () => {
  assert.equal(formatDuration(undefined), '—');
  assert.equal(formatDuration(450), '450 ms');
  assert.equal(formatDuration(5352), '5.4 s');
  assert.equal(formatDuration(42000), '42 s');
  assert.equal(formatDuration(125000), '2 m 5 s');
});

test('saving is the share of the full download avoided', () => {
  assert.equal(savedPercent({ destBytes: 100, deltaBytes: 25 }), 75);
  assert.equal(savedPercent({ destBytes: 100, deltaBytes: 250 }), 0);
  assert.equal(savedPercent({ destBytes: 0, deltaBytes: 1 }), undefined);
  assert.equal(savedPercent({ destBytes: 100 }), undefined);
});
