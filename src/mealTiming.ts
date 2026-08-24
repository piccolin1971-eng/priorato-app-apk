import type { ArrivalMeal, DepartureMeal, GuestStay } from "./types";
import { getPersonCount } from "./stayUtils";

export const ARRIVAL_MEAL_OPTIONS: { id: ArrivalMeal; label: string }[] = [
  { id: "lunch", label: "Per pranzo" },
  { id: "dinner", label: "Per cena" },
];

export const DEPARTURE_MEAL_OPTIONS: { id: DepartureMeal; label: string }[] = [
  { id: "after_breakfast", label: "Dopo colazione" },
  { id: "after_lunch", label: "Dopo pranzo" },
  { id: "after_dinner", label: "Dopo cena" },
];

export function arrivalMealLabel(value?: ArrivalMeal): string {
  return ARRIVAL_MEAL_OPTIONS.find((o) => o.id === value)?.label ?? "";
}

export function departureMealLabel(value?: DepartureMeal): string {
  return DEPARTURE_MEAL_OPTIONS.find((o) => o.id === value)?.label ?? "";
}

/** Pasto incluso per uno stay in un giorno specifico (arrivo/partenza). */
export function mealIncludedOnDay(stay: GuestStay, day: string, meal: "lunch" | "dinner"): boolean {
  const base = meal === "lunch" ? stay.lunch : stay.dinner;
  if (!base) return false;

  const overnight = stay.checkIn <= day && day < stay.checkOut;
  const checkoutDay = stay.checkOut === day;
  if (!overnight && !checkoutDay) return false;

  if (stay.checkIn === day && stay.arrivalMeal === "dinner" && meal === "lunch") return false;

  if (checkoutDay) {
    if (!stay.departureMeal || stay.departureMeal === "after_breakfast") return false;
    if (meal === "dinner" && stay.departureMeal === "after_lunch") return false;
  }

  return true;
}

export function mealPersonCountOnDay(
  stay: GuestStay,
  day: string,
  meal: "lunch" | "dinner",
): number {
  if (!mealIncludedOnDay(stay, day, meal)) return 0;
  return getPersonCount(stay);
}

export function formatStayMealTiming(stay: GuestStay, day: string): string {
  const parts: string[] = [];
  if (stay.checkIn === day && stay.arrivalMeal) {
    parts.push(`Arrivo ${arrivalMealLabel(stay.arrivalMeal).toLowerCase()}`);
  }
  if (stay.checkOut === day && stay.departureMeal) {
    parts.push(`Partenza ${departureMealLabel(stay.departureMeal).toLowerCase()}`);
  }
  return parts.join(" · ");
}
