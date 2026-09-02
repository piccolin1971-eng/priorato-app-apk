import type { GuestStay } from "./types";
import {
  applyDbMeta,
  loadDbMeta,
  type DbChangeAction,
  type DbMeta,
} from "./dbMeta";
import { getDeviceName } from "./device";
import { loadStays, writeStaysOnly } from "./storage";

export const SYNC_CURSOR_KEY = "priorato-sync-cursor-v1";
export const SYNC_STATUS_KEY = "priorato-sync-status-v1";

export type SyncPayload = {
  version: 1;
  serverRevision: number;
  updatedAt: string;
  updatedBy: string;
  lastAction: DbChangeAction;
  lastGuestName?: string;
  stays: GuestStay[];
};

export type SyncResult = {
  ok: boolean;
  conflict?: boolean;
  payload?: SyncPayload | null;
  error?: string;
  message: string;
};

export type SyncStatus = {
  lastAt: string;
  ok: boolean;
  message: string;
};

export function loadSyncCursor(): number {
  const n = Number(localStorage.getItem(SYNC_CURSOR_KEY) || "0");
  return Number.isFinite(n) ? n : 0;
}

export function saveSyncCursor(revision: number): void {
  localStorage.setItem(SYNC_CURSOR_KEY, String(revision));
}

export function loadSyncStatus(): SyncStatus | null {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncStatus;
  } catch {
    return null;
  }
}

function saveSyncStatus(status: SyncStatus): void {
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
}

export function isSyncConfigured(url: string, password: string): boolean {
  return url.trim().startsWith("http") && password.trim().length > 0;
}

function buildOutgoingPayload(stays: GuestStay[]): Omit<SyncPayload, "serverRevision"> {
  const meta = loadDbMeta();
  return {
    version: 1,
    updatedAt: meta.lastModifiedAt || new Date().toISOString(),
    updatedBy: meta.lastModifiedByDevice || getDeviceName(),
    lastAction: meta.lastAction,
    lastGuestName: meta.lastGuestName,
    stays,
  };
}

export function payloadToMeta(payload: SyncPayload): DbMeta {
  return {
    revision: Math.max(loadDbMeta().revision, payload.serverRevision),
    lastModifiedAt: payload.updatedAt,
    lastModifiedByDevice: payload.updatedBy,
    lastAction: payload.lastAction,
    lastGuestName: payload.lastGuestName,
  };
}

export function applyRemotePayload(payload: SyncPayload): GuestStay[] {
  writeStaysOnly(payload.stays);
  applyDbMeta(payloadToMeta(payload));
  saveSyncCursor(payload.serverRevision);
  window.dispatchEvent(
    new CustomEvent("priorato-db-changed", {
      detail: { meta: loadDbMeta(), local: false },
    }),
  );
  return loadStays();
}

async function postScript(
  url: string,
  body: Record<string, unknown>,
): Promise<SyncResult> {
  let res: Response;
  try {
    res = await fetch(url.trim(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch {
    const result: SyncResult = {
      ok: false,
      error: "network",
      message: "Nessuna rete, o lo script non risponde.",
    };
    saveSyncStatus({ lastAt: new Date().toISOString(), ok: false, message: result.message });
    return result;
  }

  const text = await res.text();
  let data: {
    ok?: boolean;
    conflict?: boolean;
    payload?: SyncPayload | null;
    error?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    const result: SyncResult = {
      ok: false,
      error: "parse",
      message:
        "Risposta non valida. Controlla che lo script sia distribuito come App web, accesso «Chiunque».",
    };
    saveSyncStatus({ lastAt: new Date().toISOString(), ok: false, message: result.message });
    return result;
  }

  if (data.conflict) {
    return {
      ok: false,
      conflict: true,
      payload: data.payload ?? null,
      message: "Un’altra postazione ha salvato prima.",
    };
  }
  if (!data.ok) {
    const message =
      data.error === "password"
        ? "Password errata."
        : `Sync non riuscita (${data.error || "errore"}).`;
    saveSyncStatus({ lastAt: new Date().toISOString(), ok: false, message });
    return { ok: false, error: data.error, message };
  }

  saveSyncStatus({
    lastAt: new Date().toISOString(),
    ok: true,
    message: "Allineata",
  });
  return { ok: true, payload: data.payload ?? null, message: "Allineata" };
}

export async function pullStations(url: string, password: string): Promise<SyncResult> {
  return postScript(url, { action: "pull", password: password.trim() });
}

export async function pushStations(
  url: string,
  password: string,
  stays: GuestStay[],
  force = false,
): Promise<SyncResult> {
  const result = await postScript(url, {
    action: "push",
    password: password.trim(),
    baseRevision: loadSyncCursor(),
    force,
    payload: buildOutgoingPayload(stays),
  });
  if (result.ok && result.payload?.serverRevision) {
    saveSyncCursor(result.payload.serverRevision);
  }
  return result;
}
