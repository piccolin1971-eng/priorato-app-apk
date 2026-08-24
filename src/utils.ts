import type { BoardType, DepartureMeal, GuestStay } from "./types";
import { mealIncludedOnDay } from "./mealTiming";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateIt(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** Nome giorno in italiano (es. Giovedì). */
export function formatWeekdayIt(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return "";
  const name = d.toLocaleDateString("it-IT", { weekday: "long" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Converte gg/mm/aaaa o gg-mm-aaaa in ISO yyyy-mm-dd */
export function parseDateIt(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(iso + "T12:00:00");
  if (
    check.getFullYear() !== y ||
    check.getMonth() + 1 !== mo ||
    check.getDate() !== d
  ) {
    return null;
  }
  return iso;
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export function isActiveOn(stay: GuestStay, day: string): boolean {
  return stay.checkIn <= day && day < stay.checkOut;
}

/** Partenza dopo pranzo/cena: le camere restano occupate il giorno di checkout. */
export function stayKeepsRoomOnCheckout(stay: GuestStay): boolean {
  return stay.departureMeal === "after_lunch" || stay.departureMeal === "after_dinner";
}

export function occupancyEndExclusive(stay: GuestStay): string {
  return stayKeepsRoomOnCheckout(stay) ? addDaysIso(stay.checkOut, 1) : stay.checkOut;
}

/** Presente in casa quel giorno: notti + partenza tardiva il giorno di checkout. */
export function stayOccupiesDay(stay: GuestStay, day: string): boolean {
  return stay.checkIn <= day && day < occupancyEndExclusive(stay);
}

function intervalEndExclusive(checkOut: string, departureMeal?: DepartureMeal): string {
  if (departureMeal === "after_lunch" || departureMeal === "after_dinner") {
    return addDaysIso(checkOut, 1);
  }
  return checkOut;
}

/** Sovrapposizione camere, includendo partenze dopo pranzo/cena. */
export function staysOverlap(
  checkIn: string,
  checkOut: string,
  stay: GuestStay,
  excludeId?: string,
  newDepartureMeal?: DepartureMeal,
): boolean {
  if (excludeId && stay.id === excludeId) return false;
  if (!checkIn || !checkOut || checkOut <= checkIn) return false;
  const newEnd = intervalEndExclusive(checkOut, newDepartureMeal);
  return checkIn < occupancyEndExclusive(stay) && stay.checkIn < newEnd;
}

export function boardLabel(board: BoardType): string {
  switch (board) {
    case "bb":
      return "Notte + colazione";
    case "half_lunch":
      return "Mezza pensione (pranzo)";
    case "half_dinner":
      return "Mezza pensione (cena)";
    case "full":
      return "Pensione completa";
  }
}

export function defaultMeals(board: BoardType): { lunch: boolean; dinner: boolean } {
  switch (board) {
    case "bb":
      return { lunch: false, dinner: false };
    case "half_lunch":
      return { lunch: true, dinner: false };
    case "half_dinner":
      return { lunch: false, dinner: true };
    case "full":
      return { lunch: true, dinner: true };
  }
}

export function mealIncluded(stay: GuestStay, meal: "lunch" | "dinner", day?: string): boolean {
  if (day) return mealIncludedOnDay(stay, day, meal);
  return meal === "lunch" ? stay.lunch : stay.dinner;
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
