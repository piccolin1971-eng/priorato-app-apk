import type {
  ArrivalMeal,
  DepartureMeal,
  IntoleranceCounts,
  RegistrationKind,
} from "./types";
import { intoleranceCountsTotal, normalizeIntoleranceCounts } from "./intolerances";

export function buildMealTimingFields(
  arrivalMeal?: ArrivalMeal,
  departureMeal?: DepartureMeal,
): { arrivalMeal?: ArrivalMeal; departureMeal?: DepartureMeal } {
  return { arrivalMeal, departureMeal };
}

export function buildIntoleranceFields(
  mode: RegistrationKind,
  counts: IntoleranceCounts,
  text: string,
): { intolerances: string; intoleranceCounts?: IntoleranceCounts } {
  const normalized =
    mode === "party" ? normalizeIntoleranceCounts(counts) : {};
  return {
    intolerances: text.trim(),
    intoleranceCounts:
      intoleranceCountsTotal(normalized) > 0 ? normalized : undefined,
  };
}
