import type { GuestStay, IntoleranceCounts, IntoleranceTypeId } from "./types";
import { mealIncludedOnDay } from "./mealTiming";

export const INTOLERANCE_TYPES: { id: IntoleranceTypeId; label: string }[] = [
  { id: "glutine", label: "Glutine" },
  { id: "lattosio", label: "Lattosio" },
  { id: "uova", label: "Uova" },
  { id: "frutta_secca", label: "Frutta a guscio" },
  { id: "pesce", label: "Pesce" },
  { id: "altro", label: "Altro" },
];

export const EMPTY_INTOLERANCE_COUNTS: IntoleranceCounts = {};

export function normalizeIntoleranceCounts(counts?: IntoleranceCounts): IntoleranceCounts {
  if (!counts) return {};
  const out: IntoleranceCounts = {};
  for (const t of INTOLERANCE_TYPES) {
    const n = counts[t.id];
    if (n != null && n > 0) out[t.id] = Math.floor(n);
  }
  return out;
}

export function intoleranceCountsTotal(counts?: IntoleranceCounts): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((n, v) => n + (v ?? 0), 0);
}

export function hasIntoleranceInfo(stay: GuestStay): boolean {
  return stay.intolerances.trim().length > 0 || intoleranceCountsTotal(stay.intoleranceCounts) > 0;
}

export function formatIntoleranceCounts(counts?: IntoleranceCounts): string {
  const normalized = normalizeIntoleranceCounts(counts);
  const parts = INTOLERANCE_TYPES.filter((t) => (normalized[t.id] ?? 0) > 0).map(
    (t) => `${t.label}: ${normalized[t.id]}`,
  );
  return parts.join(" · ");
}

export function formatStayIntolerances(stay: GuestStay): string {
  const counts = formatIntoleranceCounts(stay.intoleranceCounts);
  const text = stay.intolerances.trim();
  if (counts && text) return `${counts} — ${text}`;
  return counts || text;
}

export function mergeIntoleranceTotals(totals: IntoleranceCounts, add?: IntoleranceCounts): IntoleranceCounts {
  const out = { ...totals };
  for (const t of INTOLERANCE_TYPES) {
    const n = add?.[t.id] ?? 0;
    if (n > 0) out[t.id] = (out[t.id] ?? 0) + n;
  }
  return out;
}

export function aggregateIntoleranceCounts(
  stays: GuestStay[],
  day: string,
  meal: "lunch" | "dinner",
): IntoleranceCounts {
  let totals: IntoleranceCounts = {};
  for (const stay of stays) {
    if (!mealIncludedOnDay(stay, day, meal)) continue;
    const counts = normalizeIntoleranceCounts(stay.intoleranceCounts);
    if (intoleranceCountsTotal(counts) === 0) continue;
    totals = mergeIntoleranceTotals(totals, counts);
  }
  return totals;
}
