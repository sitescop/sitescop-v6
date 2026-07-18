/** Stable colorful styles for client names (list + detail). */

const CLIENT_NAME_PALETTES = [
  { text: 'text-sky-700', bg: 'bg-sky-100', ring: 'ring-sky-300' },
  { text: 'text-emerald-700', bg: 'bg-emerald-100', ring: 'ring-emerald-300' },
  { text: 'text-violet-700', bg: 'bg-violet-100', ring: 'ring-violet-300' },
  { text: 'text-amber-800', bg: 'bg-amber-100', ring: 'ring-amber-300' },
  { text: 'text-rose-700', bg: 'bg-rose-100', ring: 'ring-rose-300' },
  { text: 'text-teal-700', bg: 'bg-teal-100', ring: 'ring-teal-300' },
  { text: 'text-indigo-700', bg: 'bg-indigo-100', ring: 'ring-indigo-300' },
  { text: 'text-orange-700', bg: 'bg-orange-100', ring: 'ring-orange-300' },
  { text: 'text-fuchsia-700', bg: 'bg-fuchsia-100', ring: 'ring-fuchsia-300' },
  { text: 'text-cyan-800', bg: 'bg-cyan-100', ring: 'ring-cyan-300' },
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getClientNameStyle(firstName: string, lastName: string) {
  const full = `${firstName} ${lastName}`.trim().toLowerCase() || '?';
  const palette = CLIENT_NAME_PALETTES[hashName(full) % CLIENT_NAME_PALETTES.length]!;
  const initials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || '?';
  return { ...palette, initials, fullName: `${firstName} ${lastName}`.trim() };
}
