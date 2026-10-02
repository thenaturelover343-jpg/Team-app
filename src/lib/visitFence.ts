import { registerPlugin } from '@capacitor/core';
import rawFirebaseConfig from '../../firebase-applet-config.json';
import { auth } from './firebase';
import type { Assignment } from '../types';

type FenceSite = { id: string; lat: number; lng: number; radius: number };
type ArmOptions = {
  apiUrl: string;
  origin: string;
  apiKey: string;
  refreshToken: string;
  armedUntil: number;
  sites: FenceSite[];
};

type VisitFencePlugin = {
  arm(options: ArmOptions): Promise<void>;
  disarm(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
};

const VisitFence = registerPlugin<VisitFencePlugin>('VisitFence');

export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

function refreshTokenOfUser() {
  const user = auth.currentUser as { stsTokenManager?: { refreshToken?: string } } | null;
  return user?.stsTokenManager?.refreshToken || '';
}

export function fenceSites(assignments: Assignment[]): FenceSite[] {
  return assignments
    .filter(item => item.status !== 'completed' && Number.isFinite(item.siteLatitude) && Number.isFinite(item.siteLongitude))
    .slice(0, 20)
    .map(item => ({ id: item.id, lat: Number(item.siteLatitude), lng: Number(item.siteLongitude), radius: 200 }));
}

export async function armVisitFence(assignments: Assignment[]) {
  if (!isNativeApp()) return false;
  const refreshToken = refreshTokenOfUser();
  const sites = fenceSites(assignments);
  if (!refreshToken) {
    if (sites.length === 0) return false;
    throw new Error('Meld opnieuw aan in de geïnstalleerde app zodat de klanttijd ook dicht mag lopen.');
  }
  await VisitFence.arm({
    apiUrl: `${window.location.origin}/api/team`,
    origin: window.location.origin,
    apiKey: rawFirebaseConfig.apiKey,
    refreshToken,
    armedUntil: Date.now() + 16 * 60 * 60 * 1000,
    sites,
  });
  return sites.length > 0;
}

export async function pauseVisitFence() {
  if (!isNativeApp()) return;
  await VisitFence.pause();
}

export async function resumeVisitFence() {
  if (!isNativeApp()) return;
  await VisitFence.resume();
}

export async function disarmVisitFence() {
  if (!isNativeApp()) return;
  await VisitFence.disarm();
}
