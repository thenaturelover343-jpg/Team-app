import assert from 'node:assert/strict';
import test from 'node:test';
import { rankCustomers, normalizeSearch } from '../src/lib/customerSearch.ts';

const customers = [
  { id: '1', name: 'Anders JD BV', address: 'Kerkstraat 1, Lier' },
  { id: '2', name: 'Bakkerij Léon', address: 'Dorp 65, Geel' },
  { id: '3', name: 'De Valk Lier BV', address: 'Antwerpsesteenweg 3' },
  { id: '4', name: 'Café Zuid', address: 'Lierseweg 12' },
  { id: '5', name: 'Lillse Hoeve Ray 12 BV', address: 'Hoeve 2' },
];

test('empty query keeps the list exactly as is', () => {
  assert.deepEqual(rankCustomers(customers, '').map(c => c.id), ['1', '2', '3', '4', '5']);
  assert.deepEqual(rankCustomers(customers, '   ').map(c => c.id), ['1', '2', '3', '4', '5']);
});

test('nothing is removed, only reordered', () => {
  const ranked = rankCustomers(customers, 'zzz');
  assert.equal(ranked.length, customers.length);
  assert.deepEqual(ranked.map(c => c.id), ['1', '2', '3', '4', '5']);
});

test('name prefix first, then name word, then address matches, rest in normal order', () => {
  // "li": name prefix (Lillse) > name word prefix (De Valk Lier) > address word prefix (Lier / Lierseweg)
  assert.deepEqual(rankCustomers(customers, 'li').map(c => c.id), ['5', '3', '1', '4', '2']);
});

test('case and accent insensitive', () => {
  assert.equal(normalizeSearch('Café LÉON'), 'cafe leon');
  assert.equal(rankCustomers(customers, 'LEON')[0].id, '2');
  assert.equal(rankCustomers(customers, 'cafe')[0].id, '4');
});

test('address match moves up below name matches', () => {
  assert.deepEqual(rankCustomers(customers, 'dorp').map(c => c.id), ['2', '1', '3', '4', '5']);
});
