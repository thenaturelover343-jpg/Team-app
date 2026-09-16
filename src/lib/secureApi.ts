import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { GeoLocation } from '../types';

type InviteInput = { email: string; name: string; phone?: string };
type InviteResult = { uid: string; resetLink: string };
type AccessInput = { uid: string; role: 'admin' | 'employee'; active: boolean };
type ClockOutInput = { location: GeoLocation; notes: string; statusTag: string };
type AssignmentTransitionInput = { assignmentId: string; status: 'arrived' | 'completed'; location: GeoLocation; notes?: string };
type CustomerInput = { id?: string; name: string; address: string; phone?: string; email?: string };
type AssignmentInput = { id?: string; userId: string; customerId: string; date: string; startTime: string; description: string };

export const secureApi = {
  inviteEmployee: (input: InviteInput) => httpsCallable<InviteInput, InviteResult>(functions, 'inviteEmployee')(input),
  setEmployeeAccess: (input: AccessInput) => httpsCallable<AccessInput, { ok: boolean }>(functions, 'setEmployeeAccess')(input),
  saveCustomer: (input: CustomerInput) => httpsCallable<CustomerInput, { id: string }>(functions, 'saveCustomer')(input),
  saveAssignment: (input: AssignmentInput) => httpsCallable<AssignmentInput, { id: string }>(functions, 'saveAssignment')(input),
  deleteAssignment: (id: string) => httpsCallable<{ id: string }, { ok: boolean }>(functions, 'deleteAssignment')({ id }),
  clockIn: (location: GeoLocation) => httpsCallable<{ location: GeoLocation }, { shiftId: string }>(functions, 'clockIn')({ location }),
  clockOut: (input: ClockOutInput) => httpsCallable<ClockOutInput, { ok: boolean }>(functions, 'clockOut')(input),
  acknowledgeAssignment: (assignmentId: string) => httpsCallable<{ assignmentId: string }, { ok: boolean }>(functions, 'acknowledgeAssignment')({ assignmentId }),
  transitionAssignment: (input: AssignmentTransitionInput) => httpsCallable<AssignmentTransitionInput, { ok: boolean }>(functions, 'transitionAssignment')(input),
};
