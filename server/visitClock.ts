import { distanceMeters } from './policy.ts';
import { localClockParts } from './phase4.ts';

export const VISIT_RADIUS_M = 200;
export const VISIT_DWELL_MS = 2 * 60 * 1000;
export const VISIT_MAX_ACCURACY_M = 200;

export type VisitSite = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: 'pending' | 'arrived' | 'completed';
  arrivalTime?: number | null;
  departureTime?: number | null;
  insideSince?: number | null;
  outsideSince?: number | null;
};

export type VisitPatch = {
  id: string;
  insideSince: number | null;
  outsideSince: number | null;
  arriveAt?: number;
  departAt?: number;
};

export type VisitChoice = { id: string; name: string };

export type VisitPingResult = {
  type: 'paused' | 'weak' | 'ambiguous' | 'tracking';
  patches: VisitPatch[];
  choices: VisitChoice[];
  arrived: { id: string; name: string; at: number }[];
  departed: { id: string; name: string; at: number }[];
};

export type VisitReminder = {
  type: 'visit_reminder' | 'visit_missing';
  userId: string;
  assignmentId: string;
  title: string;
  body: string;
  dedupeKey: string;
  admin: boolean;
};

const empty = (): VisitPingResult => ({ type: 'tracking', patches: [], choices: [], arrived: [], departed: [] });

export function visitInside(site: Pick<VisitSite, 'lat' | 'lng'>, point: { lat: number; lng: number; accuracy: number }, radius = VISIT_RADIUS_M) {
  if (site.lat == null || site.lng == null || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) return false;
  const distance = distanceMeters(point, { lat: site.lat, lng: site.lng });
  return distance <= radius + Math.min(Math.max(point.accuracy, 0), VISIT_MAX_ACCURACY_M);
}

export function evaluateVisitPing(input: {
  now: number;
  clockedIn: boolean;
  onBreak: boolean;
  lat: number;
  lng: number;
  accuracy: number;
  sites: VisitSite[];
  chosenId?: string | null;
  confirmedDwell?: boolean;
  confirmedExit?: boolean;
}): VisitPingResult {
  if (!input.clockedIn || input.onBreak) return { ...empty(), type: 'paused' };
  const confirmed = input.confirmedDwell === true || input.confirmedExit === true;
  let accuracy = input.accuracy;
  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > VISIT_MAX_ACCURACY_M) {
    if (!confirmed) return { ...empty(), type: 'weak' };
    accuracy = VISIT_MAX_ACCURACY_M;
  }

  const point = { lat: input.lat, lng: input.lng, accuracy };
  const sites = input.sites.filter(site => site.status !== 'completed' && site.lat != null && site.lng != null);
  const isIn = (site: VisitSite) => visitInside(site, point);
  const open = sites.find(site => site.status === 'arrived' && !site.departureTime);
  const pendingInside = sites.filter(site => site.status === 'pending' && isIn(site));
  const result = empty();

  const remember = (site: VisitSite, insideSince: number | null, outsideSince: number | null, extra?: Pick<VisitPatch, 'arriveAt' | 'departAt'>) => {
    result.patches.push({ id: site.id, insideSince, outsideSince, ...extra });
  };
  const dwellStart = (site: VisitSite) => input.confirmedDwell
    ? Math.min(site.insideSince || input.now, input.now - VISIT_DWELL_MS)
    : (site.insideSince || input.now);

  if (open && isIn(open) && !input.confirmedExit) {
    remember(open, null, null);
    for (const site of sites) {
      if (site.id !== open.id && site.status === 'pending' && site.insideSince) remember(site, null, site.outsideSince ?? null);
    }
    return result;
  }

  let candidate: VisitSite | undefined;
  if (!open || !isIn(open) || input.confirmedExit) {
    if (pendingInside.length >= 2 && !input.chosenId) {
      result.type = 'ambiguous';
      result.choices = pendingInside.map(site => ({ id: site.id, name: site.name }));
      for (const site of pendingInside) remember(site, null, site.outsideSince ?? null);
    } else {
      candidate = input.chosenId
        ? pendingInside.find(site => site.id === input.chosenId)
        : pendingInside.length === 1 ? pendingInside[0] : undefined;
    }
  }

  if (open && (!isIn(open) || input.confirmedExit)) {
    const outsideSince = open.outsideSince || input.now;
    const leftLongEnough = Boolean(input.confirmedExit) || input.now - outsideSince >= VISIT_DWELL_MS;
    const candidateSince = candidate ? dwellStart(candidate) : null;
    const candidateReady = Boolean(candidate && candidateSince != null && input.now - candidateSince >= VISIT_DWELL_MS);
    if (candidateReady && candidate && candidateSince != null) {
      remember(open, null, null, { departAt: input.confirmedExit ? input.now : candidateSince });
      result.departed.push({ id: open.id, name: open.name, at: input.confirmedExit ? input.now : candidateSince });
      remember(candidate, null, null, { arriveAt: candidateSince });
      result.arrived.push({ id: candidate.id, name: candidate.name, at: candidateSince });
    } else if (leftLongEnough) {
      const departAt = input.confirmedExit ? input.now : outsideSince;
      remember(open, null, null, { departAt });
      result.departed.push({ id: open.id, name: open.name, at: departAt });
      if (candidate && candidateSince != null) remember(candidate, candidateSince, null);
    } else {
      remember(open, null, outsideSince);
      if (candidate && candidateSince != null) remember(candidate, candidateSince, null);
    }
  } else if (candidate) {
    const insideSince = dwellStart(candidate);
    if (input.now - insideSince >= VISIT_DWELL_MS) {
      remember(candidate, null, null, { arriveAt: insideSince });
      result.arrived.push({ id: candidate.id, name: candidate.name, at: insideSince });
    } else {
      remember(candidate, insideSince, null);
    }
  }

  for (const site of sites) {
    if (result.patches.some(patch => patch.id === site.id)) continue;
    if (site.status === 'pending' && site.insideSince && !isIn(site)) remember(site, null, site.outsideSince ?? null);
  }
  return result;
}

export function visitReminderEvents(rows: {
  assignmentId: string;
  userId: string;
  customerName: string;
  date: string;
  startTime: string;
  status: string;
  hasArrival: boolean;
}[], now: Date, timeZone = 'Europe/Brussels'): VisitReminder[] {
  const clock = localClockParts(now, timeZone);
  const events: VisitReminder[] = [];
  for (const row of rows) {
    if (row.date !== clock.date || row.hasArrival || row.status !== 'pending') continue;
    const [hours, minutes] = String(row.startTime || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;
    const delta = hours * 60 + minutes - clock.minutes;
    if (delta <= 0 && delta > -20) {
      events.push({
        type: 'visit_reminder', userId: row.userId, assignmentId: row.assignmentId, admin: false,
        title: 'Klantbezoek', body: `Bij ${row.customerName}. De klanttijd loopt vanzelf, ook als de app dicht is.`,
        dedupeKey: `visit-reminder:${row.assignmentId}:${row.date}`,
      });
    }
    if (delta <= -30) {
      events.push({
        type: 'visit_missing', userId: row.userId, assignmentId: row.assignmentId, admin: true,
        title: 'Geen aankomst', body: `Nog geen aankomst bij ${row.customerName} (gepland ${row.startTime}).`,
        dedupeKey: `visit-missing:${row.assignmentId}:${row.date}`,
      });
    }
  }
  return events;
}
