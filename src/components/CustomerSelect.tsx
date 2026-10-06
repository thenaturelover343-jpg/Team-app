import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { Customer } from '../types';
import { suggestCustomers } from '../lib/customerSearch';

type Props = {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  placeholderOption: string;
  required?: boolean;
  /** Kept for call-site compatibility; applied to the text field. */
  selectClassName?: string;
  separator?: string;
};

function labelFor(customer: Customer, separator: string) {
  return `${customer.name}${separator}${customer.address}`;
}

/**
 * One professional search field: type to filter, dropdown below with name+address,
 * click/tap selects and closes. Empty query shows top suggestions.
 */
export function CustomerSelect({
  customers,
  value,
  onChange,
  placeholderOption,
  required,
  selectClassName = 'ops-input w-full p-3 font-medium',
  separator = ' - ',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = customers.find(customer => customer.id === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const suggestions = useMemo(() => suggestCustomers(customers, query, 12), [customers, query]);
  const displayValue = open ? query : (selected ? labelFor(selected, separator) : '');

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const pick = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const openWithQuery = () => {
    setOpen(true);
    if (!query && selected) setQuery('');
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) { openWithQuery(); return; }
      setHighlight(index => Math.min(index + 1, Math.max(0, suggestions.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openWithQuery(); return; }
      setHighlight(index => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && suggestions[highlight]) pick(suggestions[highlight].id);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  // Hidden required input so HTML form validation still works without a native <select>.
  return (
    <div ref={rootRef} className="relative space-y-1.5" data-customer-select="combobox">
      {required && <input type="text" value={value} required readOnly tabIndex={-1} aria-hidden className="sr-only" onChange={() => undefined} />}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && suggestions[highlight] ? `${listId}-${suggestions[highlight].id}` : undefined}
          value={displayValue}
          placeholder={placeholderOption}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onFocus={openWithQuery}
          onClick={openWithQuery}
          onChange={event => { setQuery(event.target.value); setOpen(true); if (value) onChange(''); }}
          onKeyDown={onKeyDown}
          className={`${selectClassName} py-3 pl-9 pr-16 text-base md:text-sm`}
          style={{ fontSize: '16px' }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(value || query) && (
            <button type="button" onClick={clear} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" aria-label="Klant wissen">
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => { if (open) setOpen(false); else { openWithQuery(); inputRef.current?.focus(); } }} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" aria-label={open ? 'Lijst sluiten' : 'Lijst openen'}>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] py-1"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-3 text-sm font-medium text-zinc-500" role="presentation">
              {query.trim() ? 'Geen klant gevonden.' : 'Geen klanten beschikbaar.'}
            </li>
          ) : (
            suggestions.map((customer, index) => {
              const active = index === highlight;
              const isSelected = customer.id === value;
              return (
                <li
                  key={customer.id}
                  id={`${listId}-${customer.id}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`px-3 py-2.5 cursor-pointer ${active ? 'bg-cyan-50' : 'hover:bg-zinc-50'} ${isSelected ? 'font-bold text-zinc-900' : 'text-zinc-800'}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={event => { event.preventDefault(); pick(customer.id); }}
                >
                  <div className="text-sm font-semibold leading-snug">{customer.name}</div>
                  <div className="text-xs text-zinc-500 font-medium leading-snug mt-0.5">{customer.address}</div>
                </li>
              );
            })
          )}
          {!query.trim() && customers.length > suggestions.length && (
            <li className="px-3 py-2 text-xs font-semibold text-zinc-400 border-t border-zinc-100" role="presentation">
              Typ om alle {customers.length} klanten te doorzoeken
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
