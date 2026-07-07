import type { GuestStay } from "./types";
import { loadStays, saveStays } from "./storage";

export const BACKUP_VERSION = 1;
export const AUTO_BACKUP_KEY = "priorato-backup-auto-v1";

export type BackupBundle = {
  version: number;
  exportedAt: string;
  stays: GuestStay[];
  app: "priorato";
};

export type AutoBackupIntervalHours = 6 | 12 | 24 | 168;

export const BACKUP_INTERVALS: { hours: AutoBackupIntervalHours; label: string }[] = [
  { hours: 6, label: "Ogni 6 ore" },
  { hours: 12, label: "Ogni 12 ore" },
  { hours: 24, label: "Ogni giorno" },
  { hours: 168, label: "Ogni settimana" },
];

export function createBackupBundle(stays: GuestStay[]): BackupBundle {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stays,
    app: "priorato",
  };
}

export function parseBackupBundle(raw: string): BackupBundle {
  const data = JSON.parse(raw) as BackupBundle;
  if (!data || data.app !== "priorato" || !Array.isArray(data.stays)) {
    throw new Error("File di backup non valido.");
  }
  return data;
}

export function downloadBackupFile(stays: GuestStay[]): void {
  const bundle = createBackupBundle(stays);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = bundle.exportedAt.slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `priorato-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveAutoBackupLocal(stays: GuestStay[]): void {
  const bundle = createBackupBundle(stays);
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(bundle));
}

export function loadAutoBackupLocal(): BackupBundle | null {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return null;
    return parseBackupBundle(raw);
  } catch {
    return null;
  }
}

export type ImportMode = "replace" | "merge";

export function importBackupStays(
  bundle: BackupBundle,
  mode: ImportMode,
): GuestStay[] {
  if (mode === "replace") {
    saveStays(bundle.stays);
    return loadStays();
  }
  const current = loadStays();
  const byId = new Map(current.map((s) => [s.id, s]));
  for (const stay of bundle.stays) byId.set(stay.id, stay);
  const merged = [...byId.values()];
  saveStays(merged);
  return merged;
}

export function shouldRunAutoBackup(
  enabled: boolean,
  intervalHours: number,
  lastAt: string | undefined,
): boolean {
  if (!enabled) return false;
  if (!lastAt) return true;
  const last = Date.parse(lastAt);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= intervalHours * 60 * 60 * 1000;
}
