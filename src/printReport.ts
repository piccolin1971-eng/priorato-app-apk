import { ROOMS } from "./data/rooms";
import { getDayOccupancy, TOTAL_ROOMS } from "./roomAvailability";
import type { GuestStay } from "./types";
import { getPersonCount, mealPersonCount } from "./stayUtils";
import { dateToIso, formatDateIt, isActiveOn, isoToDate, mealIncluded } from "./utils";

export type ReportPeriod = "day" | "week" | "month";

export type PrintReportOptions = {
  period: ReportPeriod;
  anchorDate: string;
  includeSummary: boolean;
  includeGuestList: boolean;
  includeContact: boolean;
  includeRooms: boolean;
  includeMeals: boolean;
  includeIntolerances: boolean;
  includeGroups: boolean;
  includeArrivalsDepartures: boolean;
  includeNotes: boolean;
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

export function getPeriodDays(period: ReportPeriod, anchor: string): string[] {
  const d = isoToDate(anchor);
  if (!d) return [];

  if (period === "day") return [anchor];

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
  const d = isoToDate(anchor);
  if (!d) return "Report mensile";
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
  ];
  return `Report ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildDaySnapshot(stays: GuestStay[], day: string): DaySnapshot {
  const inHouse = stays.filter((s) => isActiveOn(s, day));
  const occupancy = getDayOccupancy(stays, day);
  return {
    day,
    occupancy: occupancy.occupiedCount,
    free: occupancy.freeCount,
    peopleInHouse: inHouse.reduce((n, s) => n + getPersonCount(s), 0),
    lunchPeople: inHouse.reduce((n, s) => n + mealPersonCount(s, "lunch"), 0),
    dinnerPeople: inHouse.reduce((n, s) => n + mealPersonCount(s, "dinner"), 0),
    inHouse,
    arrivals: stays.filter((s) => s.checkIn === day),
    departures: stays.filter((s) => s.checkOut === day),
    lunch: inHouse.filter((s) => mealIncluded(s, "lunch")),
    dinner: inHouse.filter((s) => mealIncluded(s, "dinner")),
    intolerances: inHouse.filter((s) => s.intolerances.trim()),
  };
}

export function buildPrintReport(
  stays: GuestStay[],
  options: PrintReportOptions,
): BuiltPrintReport {
  const days = getPeriodDays(options.period, options.anchorDate);
  const snapshots = days.map((day) => buildDaySnapshot(stays, day));
  return {
    title: periodTitle(options.period, options.anchorDate, days),
    periodLabel:
      options.period === "day"
        ? "Giornaliero"
        : options.period === "week"
          ? "Settimanale"
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
    parts.push(`capo: ${stay.group.leaderPhone.trim()}`);
  }
  return parts.join(" · ");
}

export function periodTotals(snapshots: DaySnapshot[]) {
  const maxOccupied = Math.max(0, ...snapshots.map((s) => s.occupancy));
  const totalArrivals = snapshots.reduce((n, s) => n + s.arrivals.length, 0);
  const totalDepartures = snapshots.reduce((n, s) => n + s.departures.length, 0);
  return { maxOccupied, totalArrivals, totalDepartures, totalRooms: TOTAL_ROOMS };
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
  includeArrivalsDepartures: true,
  includeNotes: false,
};
