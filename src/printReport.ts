import { ROOMS } from "./data/rooms";
import { isPartyLikeStay } from "./partyStay";
import { getDayOccupancy, TOTAL_ROOMS } from "./roomAvailability";
import type { GuestStay } from "./types";
import { hasIntoleranceInfo } from "./intolerances";
import { mealIncludedOnDay } from "./mealTiming";
import { getPersonCount, isPlaceholderGroupName } from "./stayUtils";
import { dateToIso, formatDateIt, isoToDate, stayOccupiesDay } from "./utils";

export type ReportPeriod = "day" | "week" | "month" | "range";

export type PrintReportOptions = {
  period: ReportPeriod;
  anchorDate: string;
  /** Giorni consecutivi se period === "range" (min 2). */
  rangeDayCount?: number;
  includeSummary: boolean;
  includeGuestList: boolean;
  includeContact: boolean;
  includeRooms: boolean;
  includeMeals: boolean;
  includeIntolerances: boolean;
  includeGroups: boolean;
  includeArrivals: boolean;
  includeDepartures: boolean;
  includeNotes: boolean;
  includeHistoryStats: boolean;
};

export type DaySnapshot = {
  day: string;
  occupancy: number;
  free: number;
  peopleInHouse: number;
  lunchPeople: number;
  dinnerPeople: number;
  inHouse: GuestStay[];
  arrivals: GuestStay[];
  departures: GuestStay[];
  lunch: GuestStay[];
  dinner: GuestStay[];
  intolerances: GuestStay[];
};

export type BuiltPrintReport = {
  title: string;
  periodLabel: string;
  days: string[];
  snapshots: DaySnapshot[];
  options: PrintReportOptions;
};

export function getPeriodDays(
  period: ReportPeriod,
  anchor: string,
  rangeDayCount = 2,
): string[] {
  const d = isoToDate(anchor);
  if (!d) return [];

  if (period === "day") return [anchor];

  if (period === "range") {
    const count = Math.max(2, Math.min(31, rangeDayCount | 0 || 2));
    const days: string[] = [];
    for (let i = 0; i < count; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      days.push(dateToIso(cur));
    }
    return days;
  }

  if (period === "week") {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      days.push(dateToIso(cur));
    }
    return days;
  }

  const year = d.getFullYear();
  const month = d.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  for (let i = 1; i <= last; i++) {
    days.push(dateToIso(new Date(year, month, i)));
  }
  return days;
}

function periodTitle(period: ReportPeriod, anchor: string, days: string[]): string {
  if (period === "day") return `Report del ${formatDateIt(anchor)}`;
  if (period === "week") {
    return `Report settimana ${formatDateIt(days[0] ?? anchor)} – ${formatDateIt(days[days.length - 1] ?? anchor)}`;
  }
  if (period === "range") {
    return `Report ${formatDateIt(days[0] ?? anchor)} – ${formatDateIt(days[days.length - 1] ?? anchor)}`;
  }
  const d = isoToDate(anchor);
  if (!d) return "Report mensile";
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
  ];
  return `Report ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildDaySnapshot(stays: GuestStay[], day: string): DaySnapshot {
  const inHouse = stays.filter((s) => stayOccupiesDay(s, day));
  const occupancy = getDayOccupancy(stays, day);
  const lunch = stays.filter((s) => mealIncludedOnDay(s, day, "lunch"));
  const dinner = stays.filter((s) => mealIncludedOnDay(s, day, "dinner"));
  const intoleranceMap = new Map<string, GuestStay>();
  for (const s of [...inHouse, ...lunch, ...dinner]) {
    if (hasIntoleranceInfo(s)) intoleranceMap.set(s.id, s);
  }
  return {
    day,
    occupancy: occupancy.occupiedCount,
    free: occupancy.freeCount,
    peopleInHouse: inHouse.reduce((n, s) => n + getPersonCount(s), 0),
    lunchPeople: lunch.reduce((n, s) => n + getPersonCount(s), 0),
    dinnerPeople: dinner.reduce((n, s) => n + getPersonCount(s), 0),
    inHouse,
    arrivals: stays.filter((s) => s.checkIn === day),
    departures: stays.filter((s) => s.checkOut === day),
    lunch,
    dinner,
    intolerances: [...intoleranceMap.values()],
  };
}

export type PrintScopeKind = "all" | "group" | "leader";

export type PrintScope = {
  kind: PrintScopeKind;
  value: string;
};

export const DEFAULT_PRINT_SCOPE: PrintScope = { kind: "all", value: "" };

export function stayOverlapsPeriod(stay: GuestStay, days: string[]): boolean {
  if (!days.length) return false;
  const start = days[0]!;
  const end = days[days.length - 1]!;
  return stay.checkIn <= end && stay.checkOut > start;
}

export function collectGroupNames(stays: GuestStay[]): string[] {
  const names = new Set<string>();
  for (const stay of stays) {
    const name = stay.group?.name?.trim();
    if (name && !isPlaceholderGroupName(name)) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "it"));
}

export function stayLeaderName(stay: GuestStay): string {
  const fromGroup = stay.group?.leaderName?.trim();
  if (fromGroup) return fromGroup;
  if (isPartyLikeStay(stay)) return stay.guestName.trim();
  return "";
}

export function collectLeaderNames(stays: GuestStay[]): string[] {
  const names = new Set<string>();
  for (const stay of stays) {
    const leader = stayLeaderName(stay);
    if (leader) names.add(leader);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "it"));
}

export function stayMatchesPrintScope(stay: GuestStay, scope: PrintScope): boolean {
  if (scope.kind === "all") return true;
  if (!scope.value.trim()) return false;
  if (scope.kind === "group") {
    return (stay.group?.name?.trim() ?? "") === scope.value;
  }
  return stayLeaderName(stay) === scope.value;
}

function scopeTitleSuffix(scope: PrintScope): string {
  if (scope.kind === "group" && scope.value) return ` — ${scope.value}`;
  if (scope.kind === "leader" && scope.value) return ` — referente ${scope.value}`;
  return "";
}

export function buildPrintReport(
  stays: GuestStay[],
  options: PrintReportOptions,
  scope: PrintScope = DEFAULT_PRINT_SCOPE,
): BuiltPrintReport {
  const days = getPeriodDays(options.period, options.anchorDate, options.rangeDayCount);
  const scoped = stays.filter((s) => stayMatchesPrintScope(s, scope));
  const snapshots = days.map((day) => buildDaySnapshot(scoped, day));
  return {
    title: `${periodTitle(options.period, options.anchorDate, days)}${scopeTitleSuffix(scope)}`,
    periodLabel:
      options.period === "day"
        ? "Giornaliero"
        : options.period === "week"
          ? "Settimanale"
          : options.period === "range"
            ? `${days.length} giorni`
            : "Mensile",
    days,
    snapshots,
    options,
  };
}

export function roomLabel(roomId: string): string {
  const room = ROOMS.find((r) => r.id === roomId);
  return room ? String(room.number) : roomId;
}

export function roomFullLabel(roomId: string): string {
  return ROOMS.find((r) => r.id === roomId)?.label ?? roomId;
}

export function guestContact(stay: GuestStay): string {
  const parts: string[] = [];
  if (stay.guestPhone?.trim()) parts.push(stay.guestPhone.trim());
  if (stay.guestEmail?.trim()) parts.push(stay.guestEmail.trim());
  if (stay.group?.leaderPhone?.trim() && stay.group.leaderName) {
    parts.push(`referente: ${stay.group.leaderPhone.trim()}`);
  }
  return parts.join(" · ");
}

export function periodTotals(snapshots: DaySnapshot[]) {
  const maxOccupied = Math.max(0, ...snapshots.map((s) => s.occupancy));
  const totalArrivals = snapshots.reduce((n, s) => n + s.arrivals.length, 0);
  const totalDepartures = snapshots.reduce((n, s) => n + s.departures.length, 0);
  return { maxOccupied, totalArrivals, totalDepartures, totalRooms: TOTAL_ROOMS };
}

export type PeriodAnalytics = {
  avgOccupancy: number;
  avgPeople: number;
  avgLunch: number;
  avgDinner: number;
  totalPersonNights: number;
  busiestDay: { day: string; occupancy: number } | null;
  quietestDay: { day: string; occupancy: number } | null;
};

export function periodAnalytics(snapshots: DaySnapshot[]): PeriodAnalytics {
  if (!snapshots.length) {
    return {
      avgOccupancy: 0,
      avgPeople: 0,
      avgLunch: 0,
      avgDinner: 0,
      totalPersonNights: 0,
      busiestDay: null,
      quietestDay: null,
    };
  }
  const n = snapshots.length;
  const sum = (fn: (s: DaySnapshot) => number) => snapshots.reduce((acc, s) => acc + fn(s), 0);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  let busiest = snapshots[0]!;
  let quietest = snapshots[0]!;
  for (const s of snapshots) {
    if (s.occupancy > busiest.occupancy) busiest = s;
    if (s.occupancy < quietest.occupancy) quietest = s;
  }
  return {
    avgOccupancy: round1(sum((s) => s.occupancy) / n),
    avgPeople: round1(sum((s) => s.peopleInHouse) / n),
    avgLunch: round1(sum((s) => s.lunchPeople) / n),
    avgDinner: round1(sum((s) => s.dinnerPeople) / n),
    totalPersonNights: sum((s) => s.peopleInHouse),
    busiestDay: { day: busiest.day, occupancy: busiest.occupancy },
    quietestDay: { day: quietest.day, occupancy: quietest.occupancy },
  };
}

export const DEFAULT_PRINT_OPTIONS: PrintReportOptions = {
  period: "day",
  anchorDate: "",
  includeSummary: true,
  includeGuestList: true,
  includeContact: false,
  includeRooms: true,
  includeMeals: true,
  includeIntolerances: true,
  includeGroups: true,
  includeArrivals: true,
  includeDepartures: true,
  includeNotes: false,
  includeHistoryStats: false,
};
