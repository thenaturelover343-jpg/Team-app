export type Role = 'admin' | 'employee';

export interface User {
  id: string; // Document ID is uid
  name: string;
  email: string;
  role: Role;
  active?: boolean;
  createdAt: number;
  phone?: string;
  availability?: string;
  availabilitySchedule?: WeeklyAvailability;
}

export interface AvailabilityDay {
  enabled: boolean;
  start: string;
  end: string;
}

export type WeeklyAvailability = Record<string, AvailabilityDay>;

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: number;
}

export interface Shift {
  id: string;
  userId: string;
  clockIn: number;
  clockInLoc?: GeoLocation;
  clockOut?: number;
  clockOutLoc?: GeoLocation;
  statusTag?: 'Normaal' | 'Vertraagd' | 'Gedeeltelijk afgerond' | 'Probleem gemeld';
  notes?: string;
  plannedShiftId?: string;
  clockInDistance?: number;
  clockOutDistance?: number;
  geofenceStatus?: 'inside' | 'unverified' | 'anonymized';
  locationAnonymizedAt?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: number;
  approvalNote?: string;
}

export interface TeamNotification {
  id: string;
  userId: string;
  type: 'planning_published' | 'planning_confirmation' | 'reminder' | 'late' | 'no_show' | 'incident' | 'correction' | 'correction_reviewed' | 'timesheet_reviewed' | 'test' | 'pilot';
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  readAt?: number;
  pushStatus: 'pending' | 'sent' | 'failed' | 'no_subscription' | 'unavailable';
  createdAt: number;
}

export interface PrivacySettings { controllerName: string; contactEmail: string; locationDays: number; notificationDays: number; auditDays: number; errorDays: number; backupDays: number; lastCleanupAt?: number }
export interface AuditEvent { id: string; actorId: string; action: string; targetType: string; targetId: string; createdAt: number }
export interface AccessEvent { id: string; userId: string; accessDate: string; userAgent: string; createdAt: number }
export interface BackupRun { id: string; status: string; checksum: string; rowCounts: Record<string, number>; createdAt: number; testedAt?: number; testStatus?: 'passed' | 'failed'; testDetails?: string }
export interface ErrorEvent { id: string; actorId?: string; action?: string; message: string; severity: string; createdAt: number }
export interface PilotProgram { id: string; status: string; startedAt: number; endsAt: number; members: { userId: string; name: string }[] }
export interface PilotFeedback { id: string; pilotId: string; userId: string; rating: number; category: string; message: string; createdAt: number }

export interface PushState {
  supported: boolean;
  enabled: boolean;
  publicKey: string;
}

export interface ShiftBreak {
  id: string;
  shiftId: string;
  userId: string;
  startedAt: number;
  endedAt?: number;
}

export const timestampToMillis = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return 0;
};

export const normalizeShift = (id: string, data: Record<string, unknown>): Shift => ({
  ...data,
  id,
  clockIn: timestampToMillis(data.clockIn),
  clockOut: data.clockOut ? timestampToMillis(data.clockOut) : undefined,
} as Shift);

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  btwNumber?: string;
  createdAt: number;
  latitude?: number;
  longitude?: number;
}

export type ShiftConfirmation = 'pending' | 'confirmed' | 'declined';

export interface PlannedShift {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  customerAddress?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string;
  status: 'draft' | 'published';
  recurrenceGroupId?: string;
  publishedAt?: number;
  createdAt: number;
  memberIds: string[];
  confirmations: Record<string, ShiftConfirmation>;
  checklist: string[];
  checklistStates: Record<string, string[]>;
}

export interface Incident {
  id: string;
  userId: string;
  plannedShiftId?: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  status: 'open' | 'closed';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAt: number;
  createdAt: number;
}

export interface CorrectionRequest {
  id: string;
  userId: string;
  shiftId: string;
  requestedClockIn?: number;
  requestedClockOut?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: number;
  createdAt: number;
}

export interface Attachment {
  id: string;
  userId: string;
  entityType: 'planned_shift' | 'incident';
  entityId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface AssignmentTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Assignment {
  id: string;
  userId: string;
  customerId: string;
  customerName: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  status: 'pending' | 'arrived' | 'completed';
  arrivalTime?: number;
  departureTime?: number;
  workNotes?: string;
  tasks?: AssignmentTask[];
  acknowledged?: boolean;
  arrivalLoc?: GeoLocation;
  departureLoc?: GeoLocation;
  createdAt: number;
}

export const normalizeAssignment = (id: string, data: Record<string, unknown>): Assignment => ({
  ...data,
  id,
  arrivalTime: data.arrivalTime ? timestampToMillis(data.arrivalTime) : undefined,
  departureTime: data.departureTime ? timestampToMillis(data.departureTime) : undefined,
  createdAt: timestampToMillis(data.createdAt),
} as Assignment);

export const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface AppState {
  users: User[];
  shifts: Shift[];
  assignments: Assignment[];
}

export const getCurrentLocation = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: pos.timestamp,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

export const formatDate = (dateValue: string | number) => {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateValue));
};

export const formatTime = (dateValue: string | number) => {
  return new Intl.DateTimeFormat('nl-BE', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateValue));
};
