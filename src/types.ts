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
}

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
  clockInLoc: GeoLocation;
  clockOut?: number;
  clockOutLoc?: GeoLocation;
  statusTag?: 'Normaal' | 'Vertraagd' | 'Gedeeltelijk afgerond' | 'Probleem gemeld';
  notes?: string;
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
