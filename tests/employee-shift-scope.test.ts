import assert from 'node:assert/strict';
import test from 'node:test';

/** Mirrors EmployeeView / DashboardTab scoping: only own open shifts count as "ingeklokt". */
function activeShiftFor(userId: string, shifts: { id: string; userId: string; clockOut?: number }[]) {
  return shifts.filter(s => s.userId === userId).find(s => !s.clockOut);
}

test('dual-role admin does not inherit another employee open shift', () => {
  const admin = 'admin-uid';
  const bruno = 'bruno-uid';
  const shifts = [
    { id: 's1', userId: bruno, clockOut: undefined as number | undefined },
    { id: 's2', userId: admin, clockOut: 100 },
  ];
  assert.equal(activeShiftFor(admin, shifts), undefined);
  assert.equal(activeShiftFor(bruno, shifts)?.id, 's1');
});

test('own open shift is still found', () => {
  const uid = 'me';
  const shifts = [
    { id: 'other', userId: 'x', clockOut: undefined as number | undefined },
    { id: 'mine', userId: uid, clockOut: undefined as number | undefined },
  ];
  assert.equal(activeShiftFor(uid, shifts)?.id, 'mine');
});
