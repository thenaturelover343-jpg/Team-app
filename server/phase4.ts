export type PlannedAttendance = {
  shiftId: string;
  userId: string;
  date: string;
  startTime: string;
  title: string;
  userName?: string;
  hasClockIn: boolean;
};

export type AttendanceEvent = {
  type: 'reminder' | 'late' | 'no_show';
  shiftId: string;
  userId: string;
  title: string;
  body: string;
  dedupeKey: string;
};

export function localClockParts(now: Date, timeZone = 'Europe/Brussels') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}

export function attendanceEvents(rows: PlannedAttendance[], now: Date, timeZone = 'Europe/Brussels'): AttendanceEvent[] {
  const clock = localClockParts(now, timeZone);
  const events: AttendanceEvent[] = [];
  for (const row of rows) {
    if (row.date !== clock.date || row.hasClockIn) continue;
    const [hours, minutes] = row.startTime.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;
    const delta = hours * 60 + minutes - clock.minutes;
    if (delta > 0 && delta <= 60) events.push({
      type: 'reminder', shiftId: row.shiftId, userId: row.userId, title: 'Dienst begint binnenkort',
      body: `${row.title} begint om ${row.startTime}.`, dedupeKey: `reminder:${row.shiftId}:${row.userId}:60`,
    });
    if (delta <= -10 && delta > -30) events.push({
      type: 'late', shiftId: row.shiftId, userId: row.userId, title: 'Nog niet ingeklokt',
      body: `${row.userName ? `${row.userName}: ` : ''}${row.title} is om ${row.startTime} gestart. Klok zo snel mogelijk in.`, dedupeKey: `late:${row.shiftId}:${row.userId}:10`,
    });
    if (delta <= -30) events.push({
      type: 'no_show', shiftId: row.shiftId, userId: row.userId, title: 'No-showwaarschuwing',
      body: `${row.userName ? `${row.userName}: ` : ''}geen inklok geregistreerd voor ${row.title} van ${row.startTime}.`, dedupeKey: `no_show:${row.shiftId}:${row.userId}:30`,
    });
  }
  return events;
}

export function workedMinutes(clockIn: number, clockOut: number | undefined, breakMinutes: number) {
  if (!clockOut || clockOut <= clockIn) return 0;
  return Math.max(0, Math.round((clockOut - clockIn) / 60000) - Math.max(0, Math.round(breakMinutes)));
}

export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csv(rows: unknown[][]) {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
