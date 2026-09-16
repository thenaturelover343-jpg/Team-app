import { describe, expect, it } from 'vitest';
import { localDateKey, normalizeShift, timestampToMillis } from '../src/types';

describe('tijdnormalisatie', () => {
  it('behoudt numerieke legacy-timestamps', () => {
    expect(timestampToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('normaliseert Firestore-achtige timestamps', () => {
    expect(timestampToMillis({ toMillis: () => 42 })).toBe(42);
  });

  it('normaliseert een shift voor de bestaande UI', () => {
    expect(normalizeShift('shift-1', {
      userId: 'employee-1',
      clockIn: { toMillis: () => 100 },
      clockOut: { toMillis: () => 200 },
      clockInLoc: { lat: 50, lng: 4, accuracy: 10, capturedAt: 1 },
    })).toMatchObject({ id: 'shift-1', clockIn: 100, clockOut: 200 });
  });
});

describe('lokale kalenderdatum', () => {
  it('gebruikt de lokale datum en niet UTC', () => {
    expect(localDateKey(new Date(2026, 8, 16, 0, 30))).toBe('2026-09-16');
  });
});
