'use client';
import React, { createContext, useContext, useEffect, useMemo } from 'react';

const dict = {
  nl: {
    fieldOps: 'FIELD OPERATIONS',
    loginLead: 'Log in met het e-mailadres waarop u bent uitgenodigd. Outlook, Hotmail, Gmail of Google — alles werkt.',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    passwordConfirm: 'Wachtwoord bevestigen',
    createAccount: 'Account aanmaken',
    createAccountLead: 'Eerste beheerder of uitgenodigd teamlid: kies een wachtwoord. Outlook, Hotmail, Gmail — Google is niet nodig.',
    backToSignIn: 'Terug naar inloggen',
    signIn: 'Inloggen',
    forgot: 'Wachtwoord vergeten?',
    or: 'of',
    google: 'Verder met Google',
    emailLink: 'Stuur inloglink (Outlook, Hotmail, …)',
    emailLinkSent: 'Als dit adres is uitgenodigd, is een inloglink verzonden. Open de mail op dit toestel.',
    accountsAdmin: 'Nieuwe accounts worden uitsluitend door een beheerder aangemaakt.',
    loading: 'Bezig met laden...',
    sessionRestore: 'Sessie herstellen...',
    skip: 'Ga naar inhoud',
    logout: 'Uitloggen',
    viewEmployee: 'Bekijk als werknemer',
    backAdmin: 'Terug naar beheer',
    showPassword: 'Toon wachtwoord',
    hidePassword: 'Verberg wachtwoord',
    fillEmailFirst: 'Vul eerst uw e-mailadres in.',
    resetSent: 'Als dit account bestaat, is een herstelmail verzonden.',
    genericError: 'Er is een fout opgetreden. Probeer het opnieuw.',
    inviteTitle: 'Account activeren',
    inviteLead: 'Kies een wachtwoord. Daarna kunt u altijd inloggen met dit e-mailadres — Google is niet nodig.',
    inviteActivate: 'Account activeren',
    inviteInvalid: 'Deze uitnodiging is ongeldig of al gebruikt.',
    passwordsMismatch: 'De wachtwoorden komen niet overeen.',
    confirmEmail: 'Bevestig uw e-mailadres voor de inloglink',
    confirmEmailBtn: 'Inloggen via e-mail',
    today: 'Vandaag',
    planning: 'Planning',
    report: 'Melden',
    messages: 'Berichten',
    profile: 'Mijn Profiel',
    clockTitle: 'Urenregistratie',
    notClocked: 'Je bent momenteel niet ingeklokt.',
    startDay: 'Start Werkdag (Inklokken)',
    clockOut: 'Uitklokken',
    locating: 'Locatie zoeken...',
    myPlanningToday: 'Mijn Planning Vandaag',
    noJobsToday: 'Je hebt nog geen opdrachten voor vandaag.',
    generalDay: 'Algemene werkdag',
    navControl: 'Controle',
    navWeek: 'Weekplanner',
    navJobs: 'Opdrachten',
    navHours: 'Uren',
    navCustomers: 'Klanten',
    navReports: 'Meldingen',
    navTeam: 'Team',
    teamTitle: 'Team Beheer',
    inviteBtn: 'Uitnodigen',
    inviteOk: 'Uitnodiging klaar. Deel de link. Komt de mail niet aan, stuur ze via WhatsApp.',
    inviteMailOk: 'Mail verstuurd. Komt die niet aan, stuur onderstaande link via WhatsApp.',
    inviteMailFail: 'De mail kon niet worden verstuurd. Stuur deze link via WhatsApp.',
    whatsappShare: 'Deel via WhatsApp',
    copyLink: 'Kopieer link',
    copied: 'Link gekopieerd',
    fullName: 'Volledige naam',
    phoneOptional: 'Telefoon (optioneel)',
    roleEmployee: 'Medewerker',
    roleAdmin: 'Beheerder',
    makeEmployee: 'Maak Medewerker',
    makeAdmin: 'Maak Beheerder',
    activate: 'Activeren',
    deactivate: 'Deactiveren',
    emptyTeam: 'Nog geen teamleden. Nodig de eerste medewerker uit.',
    emptyCustomers: 'Nog geen klanten. Voeg de eerste locatie toe.',
    emptyShifts: 'Vandaag zijn geen diensten gepubliceerd.',
    emptyHours: 'Alle afgesloten uren zijn behandeld.',
    installTheme: 'Installeer Barlicious Team',
  },
} as const;

export type MsgKey = keyof typeof dict.nl;

const LanguageContext = createContext<{ t: (key: MsgKey) => string }>({ t: key => dict.nl[key] });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { document.documentElement.lang = 'nl-BE'; }, []);
  const t = useMemo(() => (key: MsgKey) => dict.nl[key], []);
  return <LanguageContext.Provider value={{ t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }
