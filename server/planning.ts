export type AvailabilityDay = { enabled: boolean; start: string; end: string };
export type WeeklyAvailability = Record<string, AvailabilityDay>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateShiftWindow(startTime: unknown, endTime: unknown, breakMinutes: unknown) {
  if (!isValidTime(startTime) || !isValidTime(endTime)) throw new Error('Vul een geldige start- en eindtijd in.');
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const pause = Number(breakMinutes);
  if (end <= start) throw new Error('De eindtijd moet na de starttijd liggen.');
  if (!Number.isInteger(pause) || pause < 0 || pause > 240 || pause >= end - start) {
    throw new Error('De pauze moet tussen 0 en 240 minuten liggen en korter zijn dan de dienst.');
  }
  return { startTime, endTime, breakMinutes: pause, start, end };
}

export function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

export function addWeeks(date: string, weeks: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next.toISOString().slice(0, 10);
}

export function parseAvailability(value: unknown): WeeklyAvailability {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as WeeklyAvailability : {};
  } catch {
    return {};
  }
}

export function availabilityConflict(availability: WeeklyAvailability, date: string, startTime: string, endTime: string) {
  if (!Object.keys(availability).length) return false;
  const weekday = String(new Date(`${date}T12:00:00Z`).getUTCDay());
  const day = availability[weekday];
  if (!day?.enabled || !isValidTime(day.start) || !isValidTime(day.end)) return true;
  return timeToMinutes(startTime) < timeToMinutes(day.start) || timeToMinutes(endTime) > timeToMinutes(day.end);
}
