import type { Assignment, AssignmentTask, Customer, GeoLocation, PlannedShift, Shift, User, WeeklyAvailability } from '../types';
import { auth } from './firebase';

type InviteInput = { email: string; name: string; phone?: string };
type InviteResult = { uid: string; resetLink: string };
type AccessInput = { uid: string; role: 'admin' | 'employee'; active: boolean };
type ClockOutInput = { location: GeoLocation; notes: string; statusTag: string };
type AssignmentTransitionInput = { assignmentId: string; status: 'arrived' | 'completed'; location: GeoLocation; notes?: string };
type CustomerInput = { id?: string; name: string; address: string; phone?: string; email?: string; latitude?: number | ''; longitude?: number | '' };
type AssignmentInput = { id?: string; userId: string; customerId: string; date: string; startTime: string; description: string };
type PlannedShiftInput = { title: string; customerId?: string; date: string; startTime: string; endTime: string; breakMinutes: number; notes?: string; memberIds: string[]; repeatWeeks: number };
export type TeamSnapshot = { user: User; users: User[]; shifts: Shift[]; assignments: Assignment[]; customers: Customer[]; plannedShifts: PlannedShift[] };

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
  clockIn: (location: GeoLocation) => call<{ shiftId: string }>('clockIn', { location }),
  clockOut: (input: ClockOutInput) => call<{ ok: boolean }>('clockOut', input),
  acknowledgeAssignment: (assignmentId: string) => call<{ ok: boolean }>('acknowledgeAssignment', { assignmentId }),
  transitionAssignment: (input: AssignmentTransitionInput) => call<{ ok: boolean }>('transitionAssignment', input),
  updateProfile: (input: { name: string; phone: string; availability: string; availabilitySchedule: WeeklyAvailability }) => call<{ ok: boolean }>('updateProfile', input),
  updateAssignmentDetails: (assignmentId: string, tasks: AssignmentTask[], workNotes: string) =>
    call<{ ok: boolean }>('updateAssignmentDetails', { assignmentId, tasks, workNotes }),
};
