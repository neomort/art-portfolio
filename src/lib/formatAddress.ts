export type AddressLike = {
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
};

export function getAddressFields(p: AddressLike) {
  const addr = p.address ?? null;
  const street = addr?.street ?? p.address_street ?? null;
  const city = addr?.city ?? p.address_city ?? null;
  const state = addr?.state ?? p.address_state ?? null;
  const postalCode = addr?.postalCode ?? p.address_postal_code ?? null;
  const country = addr?.country ?? p.address_country ?? null;
  return { street, city, state, postalCode, country };
}

export function formatCityState(p: AddressLike, opts?: { unknownCity?: string; separator?: string }) {
  const { city, state } = getAddressFields(p);
  const unknownCity = opts?.unknownCity ?? 'Unknown City';
  const sep = opts?.separator ?? ', ';
  const c = city ?? unknownCity;
  const s = state ?? '';
  return s ? `${c}${sep}${s}` : c;
}

export function formatFullAddress(p: AddressLike) {
  const { street, city, state, postalCode, country } = getAddressFields(p);
  const parts: string[] = [];
  if (street) parts.push(street);
  const csp: string[] = [];
  if (city) csp.push(city);
  if (state) csp.push(state);
  if (postalCode) csp.push(postalCode);
  if (csp.length) parts.push(csp.join(' '));
  if (country) parts.push(country);
  return parts.length ? parts.join(', ') : 'Unknown location';
}
