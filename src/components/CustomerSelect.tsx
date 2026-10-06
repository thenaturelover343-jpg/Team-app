import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Customer } from '../types';
import { isCustomerMatch, rankCustomers } from '../lib/customerSearch';

type Props = {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  placeholderOption: string;
  required?: boolean;
  selectClassName?: string;
  separator?: string;
};

/** Full customer list (native select) with a small type field on top: matches move to the top, nothing is hidden. */
export function CustomerSelect({ customers, value, onChange, placeholderOption, required, selectClassName = 'ops-input w-full p-3 font-medium', separator = ' - ' }: Props) {
  const [query, setQuery] = useState('');
  const ordered = useMemo(() => rankCustomers(customers, query), [customers, query]);
  const matchCount = useMemo(() => (query.trim() ? customers.filter(c => isCustomerMatch(c, query)).length : 0), [customers, query]);
  return (
    <div className="space-y-1.5" data-customer-select="ranked">
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Typ naam of adres om bovenaan te zetten"
          aria-label="Klant zoeken"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
          className="ops-input w-full py-2 pl-9 pr-3 text-base md:text-sm font-medium"
        />
      </div>
      {query.trim() && <div className="text-xs font-semibold text-zinc-500">{matchCount === 0 ? 'Geen klant gevonden, volledige lijst staat eronder.' : `${matchCount} ${matchCount === 1 ? 'klant staat' : 'klanten staan'} bovenaan de lijst.`}</div>}
      <select value={value} onChange={event => onChange(event.target.value)} required={required} className={selectClassName}>
        <option value="">{placeholderOption}</option>
        {ordered.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{separator}{customer.address}</option>)}
      </select>
    </div>
  );
}
