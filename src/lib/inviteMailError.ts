/** Turns a Firebase Auth error from sendSignInLinkToEmail into a visible code + short Dutch explanation. */
export type MailErrorInfo = { code: string; explanation: string; raw: string };

const EXPLANATIONS: Record<string, string> = {
  'auth/operation-not-allowed': 'Inloggen via e-maillink staat uit in Firebase (Authentication → Sign-in method → E-maillink).',
  'auth/quota-exceeded': 'Het dagelijkse maximum aan e-mails van Firebase is bereikt. Probeer later opnieuw of stuur de link via WhatsApp.',
  'auth/too-many-requests': 'Te veel pogingen kort na elkaar. Wacht even en probeer opnieuw.',
  'auth/invalid-email': 'Het e-mailadres is ongeldig. Controleer de schrijfwijze.',
  'auth/missing-email': 'Er is geen e-mailadres ingevuld.',
  'auth/network-request-failed': 'Geen netwerkverbinding. Controleer het internet en probeer opnieuw.',
  'auth/unauthorized-continue-uri': 'Het adres van de app staat niet in de toegelaten domeinen van Firebase.',
  'auth/invalid-continue-uri': 'De link in de mail is ongeldig (verkeerd app-adres).',
  'auth/missing-continue-uri': 'De link in de mail mist het app-adres.',
  'auth/unauthorized-domain': 'Dit domein is niet gemachtigd in Firebase.',
  'auth/user-disabled': 'Dit account is uitgeschakeld in Firebase.',
  'auth/admin-restricted-operation': 'Deze actie is door de Firebase-instellingen geblokkeerd.',
  'auth/internal-error': 'Interne fout bij Firebase. Probeer opnieuw.',
};

export function mailErrorInfo(error: unknown): MailErrorInfo {
  const obj = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : {};
  const raw = String(obj.message ?? (typeof error === 'string' ? error : '') ?? '').slice(0, 300);
  let code = typeof obj.code === 'string' && obj.code ? obj.code : '';
  if (!code) {
    const match = /\(?(auth\/[a-z0-9-]+)\)?/i.exec(raw);
    code = match ? match[1].toLowerCase() : '';
  }
  if (!code && /network|failed to fetch|offline/i.test(raw)) code = 'auth/network-request-failed';
  if (!code) code = 'onbekend';
  const explanation = EXPLANATIONS[code] || 'Onbekende fout bij het versturen van de mail. Stuur de link via WhatsApp of kopieer ze.';
  return { code, explanation, raw };
}

export function mailErrorText(info: MailErrorInfo): string {
  return `De mail kon niet worden verstuurd (${info.code}). ${info.explanation}`;
}
