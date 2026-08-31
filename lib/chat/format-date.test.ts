import { dayKey, formatDaySeparator, formatMessageTime } from './format-date';

describe('formatMessageTime', () => {
  it('formats morning times with AM', () => {
    const morning = new Date();
    morning.setHours(6, 42, 0, 0);
    expect(formatMessageTime(morning.toISOString())).toMatch(/AM$/);
  });

  it('formats midnight as 12:00 AM, not 0:00', () => {
    const midnightLocal = new Date();
    midnightLocal.setHours(0, 0, 0, 0);
    expect(formatMessageTime(midnightLocal.toISOString())).toMatch(/^12:00 AM$/);
  });

  it('formats noon as 12:00 PM, not 0:00', () => {
    const noonLocal = new Date();
    noonLocal.setHours(12, 0, 0, 0);
    expect(formatMessageTime(noonLocal.toISOString())).toMatch(/^12:00 PM$/);
  });

  it('pads single-digit minutes', () => {
    const fiveAfter = new Date();
    fiveAfter.setHours(9, 5, 0, 0);
    expect(formatMessageTime(fiveAfter.toISOString())).toMatch(/^9:05 AM$/);
  });

  it('returns an empty string instead of "NaN:NaN" for an unparseable timestamp', () => {
    expect(formatMessageTime('not-a-date')).toBe('');
  });
});

describe('dayKey', () => {
  it('gives the same key for two timestamps on the same calendar day', () => {
    const morning = new Date();
    morning.setHours(1, 0, 0, 0);
    const night = new Date();
    night.setHours(23, 0, 0, 0);
    expect(dayKey(morning.toISOString())).toBe(dayKey(night.toISOString()));
  });

  it('gives a different key across a day boundary', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(dayKey(today.toISOString())).not.toBe(dayKey(tomorrow.toISOString()));
  });
});

describe('formatDaySeparator', () => {
  it('labels a timestamp from today as "Today"', () => {
    expect(formatDaySeparator(new Date().toISOString())).toBe('Today');
  });

  it('labels a timestamp from yesterday as "Yesterday"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDaySeparator(yesterday.toISOString())).toBe('Yesterday');
  });

  it('labels an older timestamp with a full date', () => {
    expect(formatDaySeparator('2026-08-29T06:53:20.000Z')).toMatch(/^August 29, 2026$/);
  });

  // Regression test: a hand-edited or migrated row could carry a non-ISO timestamp app code
  // never produces -- this used to render the literal string "undefined NaN, NaN".
  it('returns an empty label instead of "undefined NaN, NaN" for an unparseable timestamp', () => {
    expect(formatDaySeparator('not-a-date')).toBe('');
  });
});
