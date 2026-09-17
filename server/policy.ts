export type AssignmentStatus = 'pending' | 'arrived' | 'completed';

export function cleanText(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeEmail(value: unknown) {
  return cleanText(value, 320).toLowerCase();
}

export function validateLocation(value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Ongeldige locatie.');
  }
  const accuracy = Number(input.accuracy);
  const capturedAt = Number(input.capturedAt);
  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 5000) throw new Error('De GPS-nauwkeurigheid is ongeldig.');
  if (!Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > 24 * 60 * 60 * 1000) throw new Error('De GPS-meting is verlopen.');
  return { lat, lng, accuracy, capturedAt };
}

export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const radius = 6371000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateGeofence(location: { lat: number; lng: number; accuracy: number }, target?: { lat: number; lng: number }, radius = 250) {
  if (location.accuracy > 100) throw new Error('GPS-signaal onvoldoende nauwkeurig. Probeer buiten opnieuw.');
  if (!target) return { status: 'unverified' as const, distance: null };
  const distance = distanceMeters(location, target);
  if (distance > radius + location.accuracy) throw new Error(`U bevindt zich buiten de toegestane zone (${Math.round(distance)} meter van de locatie).`);
  return { status: 'inside' as const, distance };
}

export function isAllowedTransition(current: unknown, next: unknown) {
  return current === 'pending' && next === 'arrived' || current === 'arrived' && next === 'completed';
}
