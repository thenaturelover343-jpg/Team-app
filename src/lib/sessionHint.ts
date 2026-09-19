import type { Role } from '../types';

const STORAGE_KEY = 'barlicious:lastSession';

export interface SessionHint {
  role: Role;
  name: string;
  /** Unix ms — informational only */
  savedAt: number;
}

export function readSessionHint(): SessionHint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionHint>;
    if (parsed.role !== 'admin' && parsed.role !== 'employee') return null;
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) return null;
    return {
      role: parsed.role,
      name: parsed.name.trim(),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeSessionHint(user: { role: Role; name: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const hint: SessionHint = {
      role: user.role,
      name: user.name,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hint));
  } catch {
    /* private mode / quota */
  }
}

export function clearSessionHint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
