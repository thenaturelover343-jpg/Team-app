import React, { useState } from 'react';
import type { AccessEvent, PilotFeedback, PilotProgram, PrivacySettings } from '../types';
import { secureApi } from '../lib/secureApi';
import { useLanguage } from '../i18n';

export default function PrivacyPanel({ privacy, accessEvents, pilot, feedback, onChanged, subtle = false }: { privacy: PrivacySettings; accessEvents: AccessEvent[]; pilot: PilotProgram | null; feedback: PilotFeedback[]; onChanged: () => Promise<void>; subtle?: boolean }) {
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const [open, setOpen] = useState(!subtle);
  const [rating, setRating] = useState(5); const [category, setCategory] = useState('gebruiksgemak'); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!pilot) return; setBusy(true); setNotice(''); try { await secureApi.submitPilotFeedback(pilot.id, rating, category, message); setMessage(''); setNotice(fr ? 'Merci, votre retour a été enregistré.' : 'Bedankt, uw feedback is opgeslagen.'); await onChanged(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Fout'); } finally { setBusy(false); } };

  const declaration = (
    <div className={subtle ? 'space-y-3 pt-2' : 'space-y-4'}>
      {!subtle && <div><h2 id="privacy-title" className="text-xl font-bold">{fr ? 'Déclaration de confidentialité des travailleurs' : 'Privacyverklaring voor werknemers'}</h2><p className="text-sm text-zinc-500 mt-1">{fr ? `Responsable: ${privacy.controllerName}` : `Verwerkingsverantwoordelijke: ${privacy.controllerName}`}{privacy.contactEmail ? ` · ${privacy.contactEmail}` : ''}</p></div>}
      {subtle && <p className="text-xs text-zinc-500">{fr ? `Responsable: ${privacy.controllerName}` : `Verwerkingsverantwoordelijke: ${privacy.controllerName}`}{privacy.contactEmail ? ` · ${privacy.contactEmail}` : ''}</p>}
      <div><h3 className={subtle ? 'text-sm font-semibold text-zinc-700' : 'font-bold'}>{fr ? 'Pourquoi utilisons-nous la localisation ?' : 'Waarom verwerken we locatie?'}</h3><p className="text-sm text-zinc-600 mt-1">{fr ? "La position est demandée uniquement au pointage d'entrée/sortie et à l'arrivée/départ d'une mission. Elle sert à vérifier la présence au lieu prévu, la précision GPS et la géofence, et à éviter les erreurs ou abus. Il n'y a pas de suivi continu en arrière-plan." : 'De locatie wordt alleen opgevraagd bij in- en uitklokken en bij aankomst/vertrek van een opdracht. Dit dient om aanwezigheid op de geplande locatie, GPS-nauwkeurigheid en geofence te controleren en fouten of misbruik te voorkomen. Er is geen continue achtergrondtracking.'}</p></div>
      <div><h3 className={subtle ? 'text-sm font-semibold text-zinc-700' : 'font-bold'}>{fr ? 'Données et accès' : 'Gegevens en toegang'}</h3><p className="text-sm text-zinc-600 mt-1">{fr ? "Nous traitons les données de compte, planning, heures, pauses, localisation ponctuelle, incidents, documents et journaux techniques. Le travailleur voit ses propres données; les administrateurs autorisés voient les données nécessaires à la planification, au contrôle et au support." : 'We verwerken account-, plannings-, uren-, pauze-, eenmalige locatie-, incident-, document- en technische loggegevens. De werknemer ziet eigen gegevens; bevoegde beheerders zien wat nodig is voor planning, controle en ondersteuning.'}</p></div>
      <div><h3 className={subtle ? 'text-sm font-semibold text-zinc-700' : 'font-bold'}>{fr ? 'Durées de conservation' : 'Bewaartermijnen'}</h3><ul className="mt-2 text-sm text-zinc-600 list-disc pl-5 space-y-1"><li>{fr ? `Localisations anonymisées après ${privacy.locationDays} jours` : `Locaties geanonimiseerd na ${privacy.locationDays} dagen`}</li><li>{fr ? `Notifications supprimées après ${privacy.notificationDays} jours` : `Meldingen verwijderd na ${privacy.notificationDays} dagen`}</li><li>{fr ? `Journaux d'accès/modification supprimés après ${privacy.auditDays} jours` : `Toegangs- en wijzigingslogs verwijderd na ${privacy.auditDays} dagen`}</li><li>{fr ? `Erreurs supprimées après ${privacy.errorDays} jours; sauvegardes après ${privacy.backupDays} jours` : `Foutlogs verwijderd na ${privacy.errorDays} dagen; back-ups na ${privacy.backupDays} dagen`}</li></ul></div>
      <div><h3 className={subtle ? 'text-sm font-semibold text-zinc-700' : 'font-bold'}>{fr ? 'Vos droits' : 'Uw rechten'}</h3><p className="text-sm text-zinc-600 mt-1">{fr ? "Vous pouvez demander accès, rectification, limitation ou effacement lorsque la loi le permet, et introduire une réclamation auprès de l'autorité de contrôle. Contactez l'administrateur" : 'U kunt inzage, correctie, beperking of verwijdering vragen waar de wet dit toestaat en een klacht indienen bij de toezichthouder. Contacteer de beheerder'}{privacy.contactEmail ? `: ${privacy.contactEmail}.` : '.'} <a className="underline font-medium" target="_blank" rel="noreferrer" href="https://eur-lex.europa.eu/eli/reg/2016/679/oj">{fr ? 'RGPD officiel' : 'Officiële AVG-tekst'}</a>.</p></div>
    </div>
  );

  return <div className={subtle ? 'space-y-3' : 'space-y-5'}>
    {subtle ? (
      <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm text-zinc-500 hover:text-zinc-700 font-medium flex items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
          <span>{fr ? 'Confidentialité et droits' : 'Privacy en rechten'}</span>
          <span className="text-xs text-zinc-400">{open ? (fr ? 'Masquer' : 'Verbergen') : (fr ? 'Afficher' : 'Tonen')}</span>
        </summary>
        {declaration}
      </details>
    ) : (
      <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4" aria-labelledby="privacy-title">
        {declaration}
      </section>
    )}
    {!subtle && <section className="bg-white border border-zinc-200 rounded-2xl p-6"><h3 className="font-bold">{fr ? 'Mes accès récents' : 'Mijn recente toegangen'}</h3><p className="text-xs text-zinc-500 mb-3">{fr ? 'Un enregistrement par jour et par compte.' : 'Eén registratie per dag per account.'}</p>{accessEvents.length ? <ul className="space-y-2 text-sm">{accessEvents.slice(0, 10).map(item => <li key={item.id} className="flex justify-between gap-3 border-t border-zinc-100 pt-2"><span>{item.accessDate}</span><span className="text-zinc-500 truncate max-w-[60%]">{item.userAgent || '—'}</span></li>)}</ul> : <p className="text-sm text-zinc-500">{fr ? 'Pas encore de journal.' : 'Nog geen loggegevens.'}</p>}</section>}
    {subtle && accessEvents.length > 0 && (
      <details className="rounded-xl border border-zinc-200/70 bg-transparent px-4 py-2">
        <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 font-medium [&::-webkit-details-marker]:hidden">{fr ? 'Accès récents' : 'Recente toegangen'} ({Math.min(accessEvents.length, 10)})</summary>
        <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">{accessEvents.slice(0, 10).map(item => <li key={item.id} className="flex justify-between gap-3"><span>{item.accessDate}</span><span className="truncate max-w-[60%]">{item.userAgent || '—'}</span></li>)}</ul>
      </details>
    )}
    {pilot && <form onSubmit={submit} className={subtle ? 'bg-amber-50/70 border border-amber-100 rounded-xl p-4 space-y-3' : 'bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4'}><div><h3 className={subtle ? 'text-sm font-semibold' : 'font-bold'}>{fr ? 'Pilote de l\'application' : 'App-pilot'}</h3><p className="text-sm text-amber-900">{fr ? 'Partagez votre expérience réelle.' : 'Deel uw praktijkervaring.'} {feedback.length ? `(${feedback.length})` : ''}</p></div><label className="block text-sm font-bold">{fr ? 'Score' : 'Score'}<select value={rating} onChange={e => setRating(Number(e.target.value))} className="mt-1 w-full border rounded-xl p-3 bg-white">{[5,4,3,2,1].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label><label className="block text-sm font-bold">{fr ? 'Sujet' : 'Onderwerp'}<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full border rounded-xl p-3 bg-white"><option value="gebruiksgemak">{fr ? 'Facilité d\'utilisation' : 'Gebruiksgemak'}</option><option value="planning">Planning</option><option value="prikken">{fr ? 'Pointage' : 'Prikken'}</option><option value="fout">{fr ? 'Problème' : 'Fout'}</option></select></label><label className="block text-sm font-bold">Feedback<textarea required value={message} onChange={e => setMessage(e.target.value)} className="mt-1 w-full border rounded-xl p-3 bg-white" rows={4} /></label><button disabled={busy} className="w-full bg-zinc-900 text-white rounded-xl py-3 font-bold disabled:opacity-50">{fr ? 'Envoyer' : 'Versturen'}</button>{notice && <p role="status" className="text-sm font-semibold">{notice}</p>}</form>}
  </div>;
}
