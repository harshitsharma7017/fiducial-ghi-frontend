import { RISK_TYPE_LABELS, ROLE_LABELS, formatRate, type RiskType, type User } from '@/shared';

/** A per-mille rate for display, or an em dash when the master has no value. */
export function displayRate(value: string | null | undefined): string {
  return value ? formatRate(value) : '—';
}

export function riskTypeLabel(value: RiskType | null): string {
  return value ? RISK_TYPE_LABELS[value] : 'Blank';
}

/** The user's roles for display, for example "Admin, Relationship Manager". */
export function rolesLabel(user: Pick<User, 'roles'>): string {
  return user.roles.map((role) => ROLE_LABELS[role]).join(', ');
}

/** Up to two initials for an avatar: "Asha Menon" gives "AM", "Administrator" gives "A". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0));
  const picked = letters.length > 1 ? [letters[0], letters.at(-1)] : letters;
  return picked.join('').toUpperCase() || '?';
}
