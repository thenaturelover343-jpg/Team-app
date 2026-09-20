export function readInviteTokenFromLocation(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('invite')?.trim() || '';
}

export function invitePath(token: string): string {
  return `/?invite=${encodeURIComponent(token)}`;
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${invitePath(token)}`;
}
