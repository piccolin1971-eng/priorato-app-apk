import type { GuestStay } from "./types";
import { normalizeStay } from "./stayUtils";

const KEY = "priorato-stays-v1";

function migrateStays(stays: GuestStay[]): GuestStay[] {
  return stays.map((s) => normalizeStay(s));
}
export function loadStays(): GuestStay[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestStay[];
    if (!Array.isArray(parsed)) return [];
    const migrated = migrateStays(parsed);
    const changed = JSON.stringify(migrated) !== JSON.stringify(parsed);
    if (changed) saveStays(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveStays(stays: GuestStay[]): void {
  localStorage.setItem(KEY, JSON.stringify(stays));
}

export function addStay(stay: GuestStay): GuestStay[] {
  const stays = loadStays();
  const next = [...stays, normalizeStay(stay)];
  saveStays(next);
  return next;
}
export function deleteStay(id: string): GuestStay[] {
  const next = loadStays().filter((s) => s.id !== id);
  saveStays(next);
  return next;
}

export function updateStay(stay: GuestStay): GuestStay[] {
  const stays = loadStays();
  const next = stays.map((s) => (s.id === stay.id ? normalizeStay(stay) : s));
  saveStays(next);
  return next;
}
