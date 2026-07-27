import {
  DEFAULT_PRINT_OPTIONS,
  type PrintReportOptions,
  type ReportPeriod,
} from "./printReport";
import { dateToIso, todayIso } from "./utils";

function dayIsoFrom(now: Date): string {
  return dateToIso(now);
}

/** Contenuti del report (senza periodo/data). */
export type ReportContentFlags = Omit<
  PrintReportOptions,
  "period" | "anchorDate" | "rangeDayCount"
>;

export type ProfilePeriodKind = "day" | "days" | "week";

export type ReportSendProfile = {
  id: string;
  name: string;
  enabled: boolean;
  emails: string[];
  /** Orari "HH:mm" (24h). Almeno uno. */
  times: string[];
  /**
   * Giorni settimana ISO-like: 1=lun … 7=dom.
   * Vuoto = tutti i giorni.
   */
  weekdays: number[];
  periodKind: ProfilePeriodKind;
  /** 0 = oggi, 1 = domani, 2 = dopodomani… */
  startOffsetDays: number;
  /** Usato se periodKind === "days" (es. 2 = oggi+domani se offset 0). */
  dayCount: number;
  content: ReportContentFlags;
};

export type DueReportSlot = {
  profile: ReportSendProfile;
  time: string;
  slotKey: string;
  options: PrintReportOptions;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function newProfileId(): string {
  return `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultReportContent(): ReportContentFlags {
  return {
    includeSummary: DEFAULT_PRINT_OPTIONS.includeSummary,
    includeGuestList: DEFAULT_PRINT_OPTIONS.includeGuestList,
    includeContact: DEFAULT_PRINT_OPTIONS.includeContact,
    includeRooms: DEFAULT_PRINT_OPTIONS.includeRooms,
    includeMeals: DEFAULT_PRINT_OPTIONS.includeMeals,
    includeIntolerances: DEFAULT_PRINT_OPTIONS.includeIntolerances,
    includeGroups: DEFAULT_PRINT_OPTIONS.includeGroups,
    includeArrivals: DEFAULT_PRINT_OPTIONS.includeArrivals,
    includeDepartures: DEFAULT_PRINT_OPTIONS.includeDepartures,
    includeNotes: DEFAULT_PRINT_OPTIONS.includeNotes,
    includeHistoryStats: DEFAULT_PRINT_OPTIONS.includeHistoryStats,
  };
}

export function createEmptyProfile(partial?: Partial<ReportSendProfile>): ReportSendProfile {
  return {
    id: newProfileId(),
    name: "",
    enabled: true,
    emails: [],
    times: ["18:00"],
    weekdays: [],
    periodKind: "day",
    startOffsetDays: 0,
    dayCount: 2,
    content: {
      ...defaultReportContent(),
      includeContact: false,
      includeNotes: false,
      includeHistoryStats: false,
    },
    ...partial,
  };
}

export function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  if (!TIME_RE.test(t)) return null;
  return t;
}

export function parseTimesInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const t = normalizeTime(part);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.sort();
}

export function formatTimes(times: string[]): string {
  return times.join(", ");
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return dateToIso(d);
}

/** Giorno settimana 1=lun … 7=dom. */
export function weekdayMon1(d = new Date()): number {
  const js = d.getDay(); // 0=dom
  return js === 0 ? 7 : js;
}

export function profileRunsToday(profile: ReportSendProfile, now = new Date()): boolean {
  if (!profile.enabled) return false;
  if (!profile.emails.length || !profile.times.length) return false;
  if (!profile.weekdays.length) return true;
  return profile.weekdays.includes(weekdayMon1(now));
}

export function profileToPrintOptions(
  profile: ReportSendProfile,
  now = new Date(),
): PrintReportOptions {
  const today = dayIsoFrom(now);
  const anchor = addDaysIso(today, Math.max(0, profile.startOffsetDays | 0));

  if (profile.periodKind === "week") {
    return {
      ...profile.content,
      period: "week",
      anchorDate: anchor,
    };
  }

  if (profile.periodKind === "days") {
    const count = Math.max(2, Math.min(14, profile.dayCount | 0 || 2));
    return {
      ...profile.content,
      period: "range",
      anchorDate: anchor,
      rangeDayCount: count,
    };
  }

  return {
    ...profile.content,
    period: "day",
    anchorDate: anchor,
  };
}

export function describeProfilePeriod(profile: ReportSendProfile): string {
  const off = profile.startOffsetDays | 0;
  const startLabel =
    off === 0 ? "oggi" : off === 1 ? "domani" : `tra ${off} giorni`;

  if (profile.periodKind === "week") {
    return `settimana di ${startLabel}`;
  }
  if (profile.periodKind === "days") {
    const n = Math.max(2, profile.dayCount | 0 || 2);
    return `${n} giorni da ${startLabel}`;
  }
  return `giorno: ${startLabel}`;
}

export function slotKey(profileId: string, dayIso: string, time: string): string {
  return `${profileId}|${dayIso}|${time}`;
}

/**
 * Slot in scadenza: orario raggiunto (o passato di poco), non ancora inviato oggi.
 * Finestra: da HH:mm fino a +30 minuti (se l'app si apre in ritardo).
 */
export function findDueSlots(
  profiles: ReportSendProfile[],
  lastSentKeys: string[],
  now = new Date(),
): DueReportSlot[] {
  const sent = new Set(lastSentKeys);
  const dayIso = dayIsoFrom(now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const due: DueReportSlot[] = [];

  for (const profile of profiles) {
    if (!profileRunsToday(profile, now)) continue;
    for (const time of profile.times) {
      const norm = normalizeTime(time);
      if (!norm) continue;
      const [hh, mm] = norm.split(":").map(Number);
      const minutesSlot = hh! * 60 + mm!;
      if (minutesNow < minutesSlot) continue;
      if (minutesNow > minutesSlot + 30) continue;
      const key = slotKey(profile.id, dayIso, norm);
      if (sent.has(key)) continue;
      due.push({
        profile,
        time: norm,
        slotKey: key,
        options: profileToPrintOptions(profile, now),
      });
    }
  }

  return due.sort((a, b) => a.time.localeCompare(b.time));
}

export function pruneLastSentKeys(keys: string[], keepDays = 7): string[] {
  const cutoff = addDaysIso(todayIso(), -keepDays);
  return keys.filter((k) => {
    const parts = k.split("|");
    const day = parts[1];
    return day !== undefined && day >= cutoff;
  });
}

/** Validazione base prima del salvataggio. */
export function validateProfile(p: ReportSendProfile): string | null {
  if (!p.name.trim()) return "Inserisci un nome profilo (es. Pulizie).";
  if (!p.emails.length) return "Aggiungi almeno un destinatario.";
  if (!p.times.length) return "Aggiungi almeno un orario (es. 18:00).";
  if (p.periodKind === "days" && (p.dayCount | 0) < 2) {
    return "Per «più giorni» indica almeno 2 giorni.";
  }
  return null;
}

export function isReportPeriod(v: string): v is ReportPeriod {
  return v === "day" || v === "week" || v === "month" || v === "range";
}
