import assert from 'node:assert/strict';
import {
  bangkokDayUtcRange,
  formatBangkokDateISO,
  formatBangkokTime,
  minutesSinceMidnightBangkok,
} from '../src/lib/bangkokTime.js';

const beforeBangkokMidnightUtc = new Date('2026-06-26T16:59:00.000Z');
const afterBangkokMidnightUtc = new Date('2026-06-26T17:00:00.000Z');

assert.equal(formatBangkokDateISO(beforeBangkokMidnightUtc), '2026-06-26');
assert.equal(formatBangkokDateISO(afterBangkokMidnightUtc), '2026-06-27');

assert.deepEqual(bangkokDayUtcRange(afterBangkokMidnightUtc), {
  startIso: '2026-06-26T17:00:00.000Z',
  endIso: '2026-06-27T16:59:59.999Z',
});

assert.equal(minutesSinceMidnightBangkok(new Date('2026-06-26T17:30:00.000Z')), 30);
assert.equal(minutesSinceMidnightBangkok(new Date('2026-06-27T05:34:00.000Z')), 754);
assert.equal(minutesSinceMidnightBangkok('not-a-date'), null);
assert.match(formatBangkokTime(new Date('2026-06-26T17:05:00.000Z')), /00:05/);
assert.equal(formatBangkokTime('not-a-date'), '');

console.log('Bangkok time helper checks passed');
