import type { DaySnapshot } from "./printReport";
import { guestContact } from "./printReport";
import type { GuestStay } from "./types";
import { getPersonCount, stayDisplayName, stayRoomsLabel } from "./stayUtils";
import { formatDateIt } from "./utils";

function csvEscape(value: string | number | boolean | undefined | null): string {
  const s = String(value ?? "");
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function staysToCsv(stays: GuestStay[]): string {
  const headers = [
    "Nome",
    "Persone",
    "Camera",
    "Arrivo",
    "Partenza",
    "Pensione",
    "Pranzo",
    "Cena",
    "Intolleranze",
    "Gruppo",
    "Capo gruppo",
    "Telefono",
    "Email",
    "Note",
  ];
  const rows = stays.map((s) =>
    [
      stayDisplayName(s),
      getPersonCount(s),
      stayRoomsLabel(s),
      formatDateIt(s.checkIn),
      formatDateIt(s.checkOut),
      s.board,
      s.lunch ? "sì" : "no",
      s.dinner ? "sì" : "no",
      s.intolerances,
      s.group?.name ?? "",
      s.group?.leaderName ?? "",
      s.guestPhone ?? s.group?.leaderPhone ?? "",
      s.guestEmail ?? "",
      s.notes,
    ]
      .map(csvEscape)
      .join(";"),
  );
  return [headers.join(";"), ...rows].join("\n");
}

export function snapshotsToCsv(snapshots: DaySnapshot[]): string {
  const headers = [
    "Data",
    "Ospiti",
    "Camere occupate",
    "Camere libere",
    "Pranzo",
    "Cena",
    "Intolleranze",
    "Arrivi",
    "Partenze",
  ];
  const rows = snapshots.map((s) =>
    [
      formatDateIt(s.day),
      s.peopleInHouse,
      s.occupancy,
      s.free,
      s.lunchPeople,
      s.dinnerPeople,
      s.intolerances.length,
      s.arrivals.length,
      s.departures.length,
    ]
      .map(csvEscape)
      .join(";"),
  );
  return [headers.join(";"), ...rows].join("\n");
}

export function downloadStaysCsv(stays: GuestStay[], filename?: string): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(filename ?? `priorato-ospiti-${stamp}.csv`, staysToCsv(stays), "text/csv;charset=utf-8");
}

export function downloadSnapshotsCsv(snapshots: DaySnapshot[], filename?: string): void {
  const stamp = snapshots[0]?.day ?? new Date().toISOString().slice(0, 10);
  downloadTextFile(
    filename ?? `priorato-report-${stamp}.csv`,
    snapshotsToCsv(snapshots),
    "text/csv;charset=utf-8",
  );
}

export function guestsInHouseToCsv(stays: GuestStay[]): string {
  const headers = ["Nome", "Camera", "Gruppo", "Pranzo", "Cena", "Intolleranze", "Contatti"];
  const rows = stays.map((s) =>
    [
      stayDisplayName(s),
      stayRoomsLabel(s),
      s.group ? `${s.group.name} (${s.group.leaderName})` : "",
      s.lunch ? "sì" : "no",
      s.dinner ? "sì" : "no",
      s.intolerances,
      guestContact(s),
    ]
      .map(csvEscape)
      .join(";"),
  );
  return [headers.join(";"), ...rows].join("\n");
}
