import React, { useMemo, useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, ExternalLink } from 'lucide-react';
import { detectIsIOS, detectIsIOSSafari, usePWAInstall } from '../hooks/usePWAInstall';

function detectInAppBrowser() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|Grok|ChatGPT|wv\)/i.test(ua);
}

export function InstallScreen({
  inviteName,
  inviteEmail,
  onContinue,
}: {
  inviteName?: string;
  inviteEmail?: string;
  onContinue: () => void;
}) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const ios = useMemo(() => detectIsIOS(), []);
  const iosSafari = useMemo(() => detectIsIOSSafari(), []);
  const inApp = useMemo(() => detectInAppBrowser(), []);

  const handleInstall = async () => {
    setHint('');
    if (isInstalled) {
      onContinue();
      return;
    }
    if (isInstallable) {
      setBusy(true);
      const ok = await install();
      setBusy(false);
      if (ok) {
        onContinue();
        return;
      }
    }
    if (ios) {
      setHint(iosSafari
        ? 'Op iPhone: tik op Delen (vierkant met pijl) en kies “Zet op beginscherm”. Daarna open je het icoon.'
        : 'Open deze link in Safari. Daarna: Delen → Zet op beginscherm.');
      return;
    }
    setHint('Gebruik Chrome of Samsung Internet en tik opnieuw op Installeren.');
  };

  return (
    <div className="login-shell min-h-screen flex items-center justify-center p-4">
      <div className="auth-card ops-card max-w-md w-full p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="brand-mark brand-mark-hero flex items-center justify-center mx-auto">
            <img src="/brand-logo.svg" alt="" className="w-[88%] h-[88%] object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900">Installeer Team-app</h1>
          <p className="text-sm text-zinc-500">
            {inviteName ? `${inviteName} is uitgenodigd${inviteEmail ? ` (${inviteEmail})` : ''}. Installeer de app op deze telefoon en activeer daarna het account.` : 'Zet de app op je beginscherm. Zo werk je niet in de browser.'}
          </p>
        </div>

        {inApp && (
          <div className="ops-chip-warning w-full justify-start p-3 text-sm">
            <ExternalLink className="w-4 h-4 shrink-0" />
            Open deze uitnodiging in Safari (iPhone) of Chrome (Android). In WhatsApp zelf kan de telefoon de app niet zetten.
          </div>
        )}

        <button type="button" disabled={busy} onClick={() => void handleInstall()} className="ops-btn-primary w-full py-4">
          <Download className="w-5 h-5" />
          <span>{isInstalled ? 'App staat klaar' : 'Installeren'}</span>
        </button>

        {ios && (
          <ol className="space-y-3 text-sm text-zinc-700">
            <li className="flex gap-3"><Share className="w-5 h-5 shrink-0 mt-0.5" /><span>1. Tik op <strong>Delen</strong> onderaan Safari.</span></li>
            <li className="flex gap-3"><PlusSquare className="w-5 h-5 shrink-0 mt-0.5" /><span>2. Kies <strong>Zet op beginscherm</strong> → Voeg toe.</span></li>
            <li className="flex gap-3"><Smartphone className="w-5 h-5 shrink-0 mt-0.5" /><span>3. Open het nieuwe icoon en activeer je account.</span></li>
          </ol>
        )}

        {hint && <p className="text-sm font-semibold text-zinc-700 bg-zinc-100 rounded-xl p-3">{hint}</p>}

        <button type="button" onClick={onContinue} className="w-full text-sm font-bold text-zinc-600">
          Account alvast activeren
        </button>
      </div>
    </div>
  );
}
