export type OfflineAction = {
  id: string;
  action: string;
  input: Record<string, unknown>;
  createdAt: number;
};

const STORAGE_KEY = 'barlicious-offline-actions-v1';

export function readOfflineQueue(): OfflineAction[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeOfflineQueue(items: OfflineAction[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100)));
  window.dispatchEvent(new CustomEvent('barlicious-queue-change'));
}

export function enqueueOfflineAction(action: string, input: Record<string, unknown>) {
  const item: OfflineAction = { id: crypto.randomUUID(), action, input, createdAt: Date.now() };
  writeOfflineQueue([...readOfflineQueue(), item]);
  return item;
}

export async function flushOfflineQueue(execute: (action: string, input: Record<string, unknown>) => Promise<unknown>) {
  const pending = readOfflineQueue();
  const remaining: OfflineAction[] = [];
  for (const item of pending) {
    try {
      await execute(item.action, item.input);
    } catch {
      remaining.push(item);
    }
  }
  writeOfflineQueue(remaining);
  return { sent: pending.length - remaining.length, remaining: remaining.length };
}
