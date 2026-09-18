import type { AccessEvent, Assignment, AssignmentTask, Attachment, AuditEvent, BackupRun, CorrectionRequest, Customer, ErrorEvent, GeoLocation, Incident, PilotFeedback, PilotProgram, PlannedShift, PrivacySettings, PushState, Shift, ShiftBreak, TeamNotification, User } from '../types';
import { auth } from './firebase';
import { enqueueOfflineAction, flushOfflineQueue } from './offlineQueue';

type InviteInput = { email: string; name: string; phone?: string; role?: 'admin' | 'employee' };
type InviteResult = { uid: string; resetLink: string };
type AccessInput = { uid: string; role: 'admin' | 'employee'; active: boolean };
type ClockOutInput = { location: GeoLocation; notes: string; statusTag: string };
type AssignmentTransitionInput = { assignmentId: string; status: 'arrived' | 'completed'; location: GeoLocation; notes?: string; workNotes?: string; materials?: string; completionNotes?: string };
type CustomerInput = { id?: string; name: string; address: string; phone?: string; email?: string; btwNumber?: string; latitude?: number | ''; longitude?: number | '' };
type AssignmentInput = { id?: string; userId: string; customerId: string; date: string; startTime: string; description: string; siteAddress?: string; siteLatitude?: number | ''; siteLongitude?: number | '' };
type PlannedShiftInput = { title: string; customerId?: string; siteAddress?: string; siteLatitude?: number | ''; siteLongitude?: number | ''; date: string; startTime: string; endTime: string; breakMinutes: number; notes?: string; memberIds: string[]; repeatWeeks: number; checklist: string[] };
export type TeamSnapshot = { user: User; users: User[]; shifts: Shift[]; assignments: Assignment[]; customers: Customer[]; plannedShifts: PlannedShift[]; breaks: ShiftBreak[]; incidents: Incident[]; correctionRequests: CorrectionRequest[]; attachments: Attachment[]; notifications: TeamNotification[]; push: PushState; privacy: PrivacySettings; auditEvents: AuditEvent[]; accessEvents: AccessEvent[]; backups: BackupRun[]; errors: ErrorEvent[]; pilot: PilotProgram | null; pilotFeedback: PilotFeedback[] };

async function call<T>(action: string, input: Record<string, unknown> = {}): Promise<{ data: T }> {
  const current = auth.currentUser;
  if (!current) throw new Error('U bent niet aangemeld.');
  const token = await current.getIdToken();
  const response = await fetch('/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, input }),
  });
  const payload = await response.json() as { data?: T; error?: string };
  if (!response.ok || payload.data === undefined) throw new Error(payload.error || 'De bewerking is mislukt.');
  return { data: payload.data };
}

async function queueable(action: string, input: Record<string, unknown>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction(action, input);
    return { queued: true };
  }
  try {
    await call(action, input);
    return { queued: false };
  } catch (error) {
    if (error instanceof TypeError) {
      enqueueOfflineAction(action, input);
      return { queued: true };
    }
    throw error;
  }
}

async function uploadAttachment(entityType: 'planned_shift' | 'incident' | 'assignment', entityId: string, file: File) {
  const current = auth.currentUser;
  if (!current) throw new Error('U bent niet aangemeld.');
  const form = new FormData();
  form.set('entityType', entityType);
  form.set('entityId', entityId);
  form.set('file', file);
  const response = await fetch('/api/team', { method: 'POST', headers: { Authorization: `Bearer ${await current.getIdToken()}` }, body: form });
  const payload = await response.json() as { data?: Attachment; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error || 'Uploaden is mislukt.');
  return payload.data;
}

async function downloadAttachment(id: string) {
  const current = auth.currentUser;
  if (!current) throw new Error('U bent niet aangemeld.');
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await current.getIdToken()}` }, body: JSON.stringify({ action: 'downloadAttachment', input: { id } }) });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || 'Downloaden is mislukt.');
  }
  return response.blob();
}

export const secureApi = {
  snapshot: () => call<TeamSnapshot>('snapshot'),
  inviteEmployee: (input: InviteInput) => call<InviteResult>('inviteEmployee', input),
  setEmployeeAccess: (input: AccessInput) => call<{ ok: boolean }>('setEmployeeAccess', input),
  saveCustomer: (input: CustomerInput) => call<{ id: string }>('saveCustomer', input),
  savePlannedShift: (input: PlannedShiftInput) => call<{ ids: string[] }>('savePlannedShift', input),
  publishPlannedShifts: (shiftIds: string[]) => call<{ count: number }>('publishPlannedShifts', { shiftIds }),
  deletePlannedShift: (id: string) => call<{ ok: boolean }>('deletePlannedShift', { id }),
  confirmPlannedShift: (shiftId: string, status: 'confirmed' | 'declined') => call<{ ok: boolean }>('confirmPlannedShift', { shiftId, status }),
  saveAssignment: (input: AssignmentInput) => call<{ id: string }>('saveAssignment', input),
  deleteAssignment: (id: string) => call<{ ok: boolean }>('deleteAssignment', { id }),
  clockIn: (location: GeoLocation, plannedShiftId?: string) => queueable('clockIn', { location, plannedShiftId }),
  clockOut: (input: ClockOutInput) => call<{ ok: boolean }>('clockOut', input),
  queueClockOut: (input: ClockOutInput) => queueable('clockOut', input),
  startBreak: () => queueable('startBreak', {}),
  endBreak: () => queueable('endBreak', {}),
  updatePlannedShiftChecklist: (plannedShiftId: string, completed: string[]) => queueable('updatePlannedShiftChecklist', { plannedShiftId, completed }),
  createIncident: (input: { plannedShiftId?: string; category: string; severity: 'low' | 'medium' | 'high'; description: string; location?: GeoLocation; occurredAt: number }) => call<{ id: string }>('createIncident', input),
  createCorrectionRequest: (input: { shiftId: string; requestedClockIn?: number; requestedClockOut?: number; reason: string }) => queueable('createCorrectionRequest', input),
  reviewCorrectionRequest: (id: string, status: 'approved' | 'rejected') => call<{ ok: boolean }>('reviewCorrectionRequest', { id, status }),
  reviewTimesheet: (shiftId: string, status: 'approved' | 'rejected', note = '') => call<{ ok: boolean }>('reviewTimesheet', { shiftId, status, note }),
  savePushSubscription: (subscription: PushSubscriptionJSON) => call<{ ok: boolean }>('savePushSubscription', { subscription, userAgent: navigator.userAgent }),
  deletePushSubscription: (endpoint: string) => call<{ ok: boolean }>('deletePushSubscription', { endpoint }),
  testPush: () => call<{ ok: boolean }>('testPush'),
  markNotificationRead: (id: string) => call<{ ok: boolean }>('markNotificationRead', { id }),
  markAllNotificationsRead: () => call<{ ok: boolean }>('markAllNotificationsRead'),
  runNotificationSweep: () => call<{ ok: boolean }>('runNotificationSweep'),
  updatePrivacySettings: (input: PrivacySettings) => call<{ ok: boolean }>('updatePrivacySettings', input),
  runPrivacyCleanup: () => call<{ skipped: boolean; counts: Record<string, number> }>('runPrivacyCleanup'),
  createBackup: () => call<{ id: string }>('createBackup'),
  testLatestBackup: () => call<{ ok: boolean; id: string }>('testLatestBackup'),
  startPilot: (memberIds: string[], durationDays: number) => call<{ id: string }>('startPilot', { memberIds, durationDays }),
  closePilot: (id: string) => call<{ ok: boolean }>('closePilot', { id }),
  submitPilotFeedback: (pilotId: string, rating: number, category: string, message: string) => call<{ id: string }>('submitPilotFeedback', { pilotId, rating, category, message }),
  exportHours: (kind: 'payroll' | 'invoice', startDate: string, endDate: string) => call<{ filename: string; csv: string; rows: number }>('exportHours', { kind, startDate, endDate }),
  uploadAttachment,
  downloadAttachment,
  flushOfflineQueue: () => flushOfflineQueue((action, input) => call(action, input)),
  acknowledgeAssignment: (assignmentId: string) => call<{ ok: boolean }>('acknowledgeAssignment', { assignmentId }),
  transitionAssignment: (input: AssignmentTransitionInput) => call<{ ok: boolean }>('transitionAssignment', input),
  updateProfile: (input: { firstName: string; lastName: string; phone: string; address: string; name?: string }) => call<{ ok: boolean }>('updateProfile', input),
  updateAssignmentDetails: (assignmentId: string, tasks: AssignmentTask[], workNotes: string, materials = '', completionNotes = '') =>
    call<{ ok: boolean }>('updateAssignmentDetails', { assignmentId, tasks, workNotes, materials, completionNotes }),
};

