export interface AddressSuggestion {
  id: string;
  label: string;
  streetAddress: string;
  suburbLine: string;
  source: 'online' | 'recent';
}

const AU_STATE_ABBREV: Record<string, string> = {
  'new south wales': 'NSW',
  nsw: 'NSW',
  victoria: 'VIC',
  vic: 'VIC',
  queensland: 'QLD',
  qld: 'QLD',
  'south australia': 'SA',
  sa: 'SA',
  'western australia': 'WA',
  wa: 'WA',
  tasmania: 'TAS',
  tas: 'TAS',
  'northern territory': 'NT',
  nt: 'NT',
  'australian capital territory': 'ACT',
  act: 'ACT',
};

/** Rough bounding box for Australia — improves Photon result quality. */
const AU_BBOX = '112.9,-43.7,153.6,-10.6';

function abbreviateState(state: string): string {
  const key = state.trim().toLowerCase();
  return AU_STATE_ABBREV[key] ?? state.trim();
}

function buildSuburbLine(parts: {
  suburb?: string;
  state?: string;
  postcode?: string;
}): string {
  const state = parts.state ? abbreviateState(parts.state) : '';
  return [parts.suburb, state, parts.postcode].filter(Boolean).join(' ').trim();
}

function pickSuburb(props: {
  city?: string;
  district?: string;
  locality?: string;
  county?: string;
}): string {
  return props.district || props.locality || props.city || props.county || '';
}

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

function buildStreetAddress(p: PhotonFeature['properties']): string {
  const streetParts = [p.housenumber, p.street].filter(Boolean);
  const fromParts = streetParts.join(' ').trim();
  if (fromParts) return fromParts;

  const name = p.name?.trim() ?? '';
  if (name && p.street && name.toLowerCase().includes(p.street.toLowerCase())) {
    return name;
  }
  if (name && !p.street) return name;

  return fromParts || name;
}

async function searchPhoton(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('bbox', AU_BBOX);

  const response = await fetch(url.toString());
  if (!response.ok) return [];

  const data = (await response.json()) as { features?: PhotonFeature[] };
  const suggestions: AddressSuggestion[] = [];

  for (const feature of data.features ?? []) {
    const p = feature.properties;
    if (p.countrycode && p.countrycode.toLowerCase() !== 'au') continue;

    const streetAddress = buildStreetAddress(p);
    if (!streetAddress || streetAddress.length < 3) continue;

    const suburbLine = buildSuburbLine({
      suburb: pickSuburb(p),
      state: p.state,
      postcode: p.postcode,
    });

    const label = suburbLine ? `${streetAddress}, ${suburbLine}` : streetAddress;

    suggestions.push({
      id: `photon-${streetAddress}-${suburbLine}-${suggestions.length}`,
      label,
      streetAddress,
      suburbLine,
      source: 'online',
    });
  }

  return rankSuggestions(query, dedupeSuggestions(suggestions)).slice(0, 8);
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    town?: string;
    city?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

async function searchNominatim(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${query}, Australia`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'au');
  url.searchParams.set('limit', '8');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept-Language': 'en-AU',
    },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as NominatimResult[];
  const suggestions: AddressSuggestion[] = [];

  for (const item of data) {
    const a = item.address;
    if (!a) continue;

    const streetParts = [a.house_number, a.road].filter(Boolean);
    const streetAddress =
      streetParts.join(' ').trim() || item.display_name.split(',')[0]?.trim() || '';
    if (!streetAddress || streetAddress.length < 3) continue;

    const suburb =
      a.suburb ?? a.neighbourhood ?? a.city_district ?? a.town ?? a.city ?? a.municipality ?? '';
    const suburbLine = buildSuburbLine({
      suburb,
      state: a.state,
      postcode: a.postcode,
    });

    suggestions.push({
      id: `nominatim-${item.place_id}`,
      label: suburbLine ? `${streetAddress}, ${suburbLine}` : streetAddress,
      streetAddress,
      suburbLine,
      source: 'online',
    });
  }

  return rankSuggestions(query, dedupeSuggestions(suggestions));
}

function dedupeSuggestions(items: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const item of items) {
    const key = `${item.streetAddress.toLowerCase()}|${item.suburbLine.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Prefer results whose street/suburb match what the user typed. */
function rankSuggestions(query: string, items: AddressSuggestion[]): AddressSuggestion[] {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);

  return [...items].sort((a, b) => score(a) - score(b));

  function score(item: AddressSuggestion): number {
    const hay = `${item.streetAddress} ${item.suburbLine} ${item.label}`.toLowerCase();
    let s = 0;
    if (hay.startsWith(q)) s -= 20;
    if (item.streetAddress.toLowerCase().includes(q)) s -= 10;
    for (const token of tokens) {
      if (hay.includes(token)) s -= 3;
    }
    if (/\d/.test(q) && /\d/.test(item.streetAddress)) s -= 5;
    if (item.suburbLine) s -= 2;
    return s;
  }
}

export async function searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  try {
    const [photon, nominatim] = await Promise.all([
      searchPhoton(trimmed),
      searchNominatim(trimmed),
    ]);
    return rankSuggestions(trimmed, dedupeSuggestions([...photon, ...nominatim])).slice(0, 8);
  } catch {
    return [];
  }
}
