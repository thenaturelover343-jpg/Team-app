export const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionSettings = {
  locationDays: number;
  notificationDays: number;
  auditDays: number;
  errorDays: number;
  backupDays: number;
};

const limits: Record<keyof RetentionSettings, [number, number]> = {
  locationDays: [30, 730],
  notificationDays: [30, 730],
  auditDays: [365, 3650],
  errorDays: [30, 730],
  backupDays: [30, 3650],
};

export function normalizeRetention(input: Partial<Record<keyof RetentionSettings, unknown>>): RetentionSettings {
  const defaults: RetentionSettings = { locationDays: 90, notificationDays: 180, auditDays: 730, errorDays: 180, backupDays: 365 };
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const [minimum, maximum] = limits[key as keyof RetentionSettings];
    const value = Math.trunc(Number(input[key as keyof RetentionSettings]));
    return [key, Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback];
  })) as RetentionSettings;
}

export function cutoff(now: number, days: number) {
  return now - days * DAY_MS;
}

export function shouldRunDaily(lastRun: unknown, now: number) {
  return !Number.isFinite(Number(lastRun)) || now - Number(lastRun) >= DAY_MS;
}

export function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "De bewerking is mislukt.";
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [verwijderd]").slice(0, 500);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
