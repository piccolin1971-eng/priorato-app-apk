import { getDeviceName } from "./device";

export const DB_META_KEY = "priorato-db-meta-v1";

export type DbChangeAction = "create" | "update" | "delete" | "import";

export type DbMeta = {
  revision: number;
  lastModifiedAt: string;
  lastModifiedByDevice: string;
  lastAction: DbChangeAction;
  lastGuestName?: string;
};

export type DbChangeInfo = {
  action: DbChangeAction;
  deviceName?: string;
  guestName?: string;
};

const EMPTY_META: DbMeta = {
  revision: 0,
  lastModifiedAt: "",
  lastModifiedByDevice: "",
  lastAction: "import",
};

export function loadDbMeta(): DbMeta {
  try {
    const raw = localStorage.getItem(DB_META_KEY);
    if (!raw) return { ...EMPTY_META };
    const parsed = JSON.parse(raw) as Partial<DbMeta>;
    return {
      revision: typeof parsed.revision === "number" ? parsed.revision : 0,
      lastModifiedAt: parsed.lastModifiedAt ?? "",
      lastModifiedByDevice: parsed.lastModifiedByDevice ?? "",
      lastAction: parsed.lastAction ?? "import",
      lastGuestName: parsed.lastGuestName,
    };
  } catch {
    return { ...EMPTY_META };
  }
}

function saveDbMeta(meta: DbMeta): void {
  localStorage.setItem(DB_META_KEY, JSON.stringify(meta));
}

export function applyDbMeta(meta: DbMeta): void {
  saveDbMeta(meta);
}

export function recordDbChange(info: DbChangeInfo): DbMeta {
  const prev = loadDbMeta();
  const meta: DbMeta = {
    revision: prev.revision + 1,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedByDevice: info.deviceName?.trim() || getDeviceName(),
    lastAction: info.action,
    lastGuestName: info.guestName?.trim() || undefined,
  };
  saveDbMeta(meta);
  window.dispatchEvent(
    new CustomEvent("priorato-db-changed", {
      detail: { meta, local: true },
    }),
  );
  return meta;
}

export function formatDbAction(action: DbChangeAction): string {
  switch (action) {
    case "create":
      return "nuova registrazione";
    case "update":
      return "modifica";
    case "delete":
      return "eliminazione";
    case "import":
      return "importazione dati";
  }
}

export function formatDbChangeSummary(meta: DbMeta): string {
  const action = formatDbAction(meta.lastAction);
  const device = meta.lastModifiedByDevice || "dispositivo sconosciuto";
  const when = meta.lastModifiedAt
    ? new Date(meta.lastModifiedAt).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const guest = meta.lastGuestName ? ` · ${meta.lastGuestName}` : "";
  return `${action}${guest} · ${device}${when ? ` · ${when}` : ""}`;
}
