import type { ArrivalMeal, DepartureMeal } from "../types";
import {
  ARRIVAL_MEAL_OPTIONS,
  DEPARTURE_MEAL_OPTIONS,
} from "../mealTiming";

type Props = {
  arrivalMeal?: ArrivalMeal;
  departureMeal?: DepartureMeal;
  onArrivalChange: (value?: ArrivalMeal) => void;
  onDepartureChange: (value?: DepartureMeal) => void;
};

export function MealTimingFields({
  arrivalMeal,
  departureMeal,
  onArrivalChange,
  onDepartureChange,
}: Props) {
  return (
    <fieldset className="meal-timing">
      <legend>Orari pasti (per la cucina)</legend>
      <div className="grid two">
        <label>
          Arrivo
          <select
            value={arrivalMeal ?? ""}
            onChange={(e) =>
              onArrivalChange((e.target.value || undefined) as ArrivalMeal | undefined)
            }
          >
            <option value="">Non specificato</option>
            {ARRIVAL_MEAL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Partenza
          <select
            value={departureMeal ?? ""}
            onChange={(e) =>
              onDepartureChange((e.target.value || undefined) as DepartureMeal | undefined)
            }
          >
            <option value="">Non specificato</option>
            {DEPARTURE_MEAL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
