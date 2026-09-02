import type { GuestStay } from "./types";
import { recordDbChange, type DbChangeInfo } from "./dbMeta";
import { normalizeStay } from "./stayUtils";

const KEY = "priorato-stays-v1";

function migrateStays(stays: GuestStay[]): GuestStay[] {
  return stays.map((s) => normalizeStay(s));
}

function writeStays(stays: GuestStay[]): void {
  localStorage.setItem(KEY, JSON.stringify(stays));
}

/** Scrive i soggiorni senza aumentare la revisione locale (arrivo da sync). */
export function writeStaysOnly(stays: GuestStay[]): void {
  writeStays(migrateStays(stays));
}

export function saveStays(stays: GuestStay[], change?: DbChangeInfo): void {
  writeStays(stays);
  if (change) recordDbChange(change);
}

export function loadStays(): GuestStay[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestStay[];
    if (!Array.isArray(parsed)) return [];
    const migrated = migrateStays(parsed);
    const changed = JSON.stringify(migrated) !== JSON.stringify(parsed);
    if (changed) writeStays(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function addStay(stay: GuestStay, change?: DbChangeInfo): GuestStay[] {
  const stays = loadStays();
  const next = [...stays, normalizeStay(stay)];
  saveStays(next, change ?? { action: "create", guestName: stay.guestName });
  return next;
}

export function deleteStay(id: string, change?: DbChangeInfo): GuestStay[] {
  const stays = loadStays();
  const removed = stays.find((s) => s.id === id);
  const next = stays.filter((s) => s.id !== id);
  saveStays(
    next,
    change ?? { action: "delete", guestName: removed?.guestName },
  );
  return next;
}

export function updateStay(stay: GuestStay, change?: DbChangeInfo): GuestStay[] {
  const stays = loadStays();
  const next = stays.map((s) => (s.id === stay.id ? normalizeStay(stay) : s));
  saveStays(next, change ?? { action: "update", guestName: stay.guestName });
  return next;
}
