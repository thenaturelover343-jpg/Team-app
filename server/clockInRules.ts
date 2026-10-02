import { measureGeofence, validateLocation } from './policy.ts';

export function requireSnapshotAuthHeader(authorization: string | null | undefined) {
  const header = authorization || '';
  if (!header.startsWith('Bearer ')) throw new Error('U bent niet aangemeld.');
  const token = header.slice(7).trim();
  if (!token) throw new Error('U bent niet aangemeld.');
  if (token.split('.').length !== 3) throw new Error('Ongeldige aanmelding.');
  return token;
}

export function evaluateClockIn(input: {
  location: unknown;
  alreadyActive: boolean;
  plannedShiftId?: string | null;
  plannedShift?: { siteLat?: number | null; siteLng?: number | null } | null;
}) {
  if (input.alreadyActive) throw new Error('U bent al ingeklokt.');
  const loc = validateLocation(input.location);
  const plannedShiftId = input.plannedShiftId ? String(input.plannedShiftId) : '';
  let target: { lat: number; lng: number } | undefined;
  if (plannedShiftId) {
    if (!input.plannedShift) throw new Error('Deze geplande dienst is niet beschikbaar voor uw account.');
    const lat = input.plannedShift.siteLat;
    const lng = input.plannedShift.siteLng;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      target = { lat: Number(lat), lng: Number(lng) };
    }
  }
  const geofence = measureGeofence(loc, target);
  return { loc, geofence, plannedShiftId: plannedShiftId || null };
}
