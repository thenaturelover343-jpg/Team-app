'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'nl' | 'fr';
const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'nl', setLocale: () => undefined });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => typeof window !== 'undefined' && window.localStorage.getItem('barlicious-locale') === 'fr' ? 'fr' : 'nl');
  const setLocale = (next: Locale) => { setLocaleState(next); window.localStorage.setItem('barlicious-locale', next); };
  useEffect(() => { document.documentElement.lang = locale === 'fr' ? 'fr-BE' : 'nl-BE'; }, [locale]);
  return <LanguageContext.Provider value={{ locale, setLocale }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();
  return <div className="flex rounded-xl border border-zinc-200 bg-white p-1" role="group" aria-label="Taal / Langue">
    {(['nl', 'fr'] as const).map(item => <button key={item} type="button" onClick={() => setLocale(item)} aria-pressed={locale === item} className={`min-h-9 px-3 rounded-lg text-xs font-bold ${locale === item ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}>{item.toUpperCase()}</button>)}
  </div>;
}
