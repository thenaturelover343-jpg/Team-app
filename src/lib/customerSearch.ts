/** Accent- and case-insensitive normalisation for customer search. */
export function normalizeSearch(value: string | undefined | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type Searchable = { name: string; address?: string | null };

/**
 * Sorts customers so matches for `query` move to the top, without removing anything.
 * Rank: name prefix (or word prefix) < name contains < address prefix/word prefix < address contains < no match.
 * Within the same rank (and for non-matches) the original order is kept. Empty query = original order.
 */
export function rankCustomers<T extends Searchable>(customers: T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return customers;
  const score = (customer: T): number => {
    const name = normalizeSearch(customer.name);
    const address = normalizeSearch(customer.address);
    const wordPrefix = (text: string) => text.split(/[^a-z0-9]+/).some(word => word.startsWith(q));
    if (name.startsWith(q)) return 0;
    if (wordPrefix(name)) return 1;
    if (name.includes(q)) return 2;
    if (address.startsWith(q) || wordPrefix(address)) return 3;
    if (address.includes(q)) return 4;
    return 5;
  };
  return customers
    .map((customer, index) => ({ customer, index, rank: score(customer) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.customer);
}

export function isCustomerMatch(customer: Searchable, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return false;
  return normalizeSearch(customer.name).includes(q) || normalizeSearch(customer.address).includes(q);
}

/**
 * Customers for the combobox dropdown: empty query → top suggestions (original order);
 * with query → only matches, ranked. Never includes non-matches when typing.
 */
export function suggestCustomers<T extends Searchable>(customers: T[], query: string, limit = 12): T[] {
  const q = normalizeSearch(query);
  if (!q) return customers.slice(0, Math.max(0, limit));
  return rankCustomers(customers, query).filter(customer => isCustomerMatch(customer, query));
}
