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
  return { lat, lng };
}

export function isAllowedTransition(current: unknown, next: unknown) {
  return current === 'pending' && next === 'arrived' || current === 'arrived' && next === 'completed';
}
