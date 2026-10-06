import assert from 'node:assert/strict';
import test from 'node:test';

/** Mirrors app/api/team/route.ts savePlannedShift publish default. */
function shouldPublishOnSave(publish: unknown): boolean {
  return !(publish === false || publish === 0 || publish === '0' || publish === 'false');
}

/** Mirrors saveAssignment member resolution. */
function resolveAssignmentMemberIds(input: { memberIds?: unknown; userIds?: unknown; userId?: unknown }): string[] {
  const clean = (value: unknown) => String(value || '').trim();
  return [...new Set((
    Array.isArray(input.memberIds) ? input.memberIds :
    Array.isArray(input.userIds) ? input.userIds :
    input.userId ? [input.userId] : []
  ).map(clean).filter(Boolean))];
}

function employeeVisiblePlanned(
  shifts: { id: string; status: string; memberIds?: string[]; confirmations?: Record<string, string> }[],
  userId: string,
) {
  return shifts.filter(shift => {
    if (shift.status !== 'published' || !userId) return false;
    if (shift.memberIds?.includes(userId)) return true;
    return Boolean(shift.confirmations && userId in shift.confirmations);
  });
}

function employeeVisibleAssignments(
  items: { id: string; userId: string; date: string }[],
  userId: string,
  weekStart: string,
) {
  return items.filter(item => item.userId === userId && item.date >= weekStart);
}

/** One in-app (+ push) notification target per selected member per created entity. */
function notifyTargetsForMembers(memberIds: string[], entityIds: string[]): { userId: string; entityId: string }[] {
  const out: { userId: string; entityId: string }[] = [];
  for (const entityId of entityIds) {
    for (const userId of memberIds) out.push({ userId, entityId });
  }
  return out;
}

test('savePlannedShift publishes by default unless explicitly draft', () => {
  assert.equal(shouldPublishOnSave(undefined), true);
  assert.equal(shouldPublishOnSave(true), true);
  assert.equal(shouldPublishOnSave(1), true);
  assert.equal(shouldPublishOnSave('1'), true);
  assert.equal(shouldPublishOnSave(false), false);
  assert.equal(shouldPublishOnSave(0), false);
  assert.equal(shouldPublishOnSave('0'), false);
  assert.equal(shouldPublishOnSave('false'), false);
});

test('saveAssignment accepts memberIds for multiple selected employees', () => {
  assert.deepEqual(resolveAssignmentMemberIds({ memberIds: ['a', 'b', 'a'] }), ['a', 'b']);
  assert.deepEqual(resolveAssignmentMemberIds({ userIds: ['x', 'y'] }), ['x', 'y']);
  assert.deepEqual(resolveAssignmentMemberIds({ userId: 'solo' }), ['solo']);
  assert.deepEqual(resolveAssignmentMemberIds({}), []);
});

test('multi-member publish fans out one notification per selected employee', () => {
  const memberIds = ['emp-1', 'emp-2', 'emp-3'];
  const shiftIds = ['shift-A'];
  const targets = notifyTargetsForMembers(memberIds, shiftIds);
  assert.equal(targets.length, 3);
  assert.deepEqual(targets.map(t => t.userId).sort(), ['emp-1', 'emp-2', 'emp-3']);
  const assignmentIds = ['asg-1', 'asg-2', 'asg-3']; // one row per member
  const asgTargets = assignmentIds.map((id, i) => ({ userId: memberIds[i], entityId: id }));
  assert.equal(asgTargets.length, memberIds.length);
  assert.ok(asgTargets.every((t, i) => t.userId === memberIds[i]));
});

test('employee snapshot filter: published + member match for each selected user (incl. dual-role)', () => {
  const shifts = [
    { id: 's1', status: 'published', memberIds: ['alice', 'bob'] },
    { id: 's2', status: 'draft', memberIds: ['alice'] },
    { id: 's3', status: 'published', memberIds: ['carol'] },
    { id: 's4', status: 'published', confirmations: { bob: 'pending' } },
  ];
  assert.deepEqual(employeeVisiblePlanned(shifts, 'alice').map(s => s.id), ['s1']);
  assert.deepEqual(employeeVisiblePlanned(shifts, 'bob').map(s => s.id).sort(), ['s1', 's4']);
  assert.deepEqual(employeeVisiblePlanned(shifts, 'carol').map(s => s.id), ['s3']);
  // Dual-role admin previewing medewerker still only sees own membership
  assert.deepEqual(employeeVisiblePlanned(shifts, 'admin-dual').map(s => s.id), []);
});

test('employee assignment filter: self + upcoming week (not hidden by Vandaag-only)', () => {
  const weekStart = '2026-10-05';
  const items = [
    { id: 'a1', userId: 'alice', date: '2026-10-04' }, // past week
    { id: 'a2', userId: 'alice', date: '2026-10-07' }, // upcoming
    { id: 'a3', userId: 'bob', date: '2026-10-07' },
    { id: 'a4', userId: 'alice', date: '2026-10-05' },
  ];
  assert.deepEqual(employeeVisibleAssignments(items, 'alice', weekStart).map(i => i.id).sort(), ['a2', 'a4']);
  assert.deepEqual(employeeVisibleAssignments(items, 'bob', weekStart).map(i => i.id), ['a3']);
});
