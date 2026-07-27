import type { IntoleranceCounts } from "../types";
import {
  EMPTY_INTOLERANCE_COUNTS,
  INTOLERANCE_TYPES,
  intoleranceCountsTotal,
  normalizeIntoleranceCounts,
} from "../intolerances";

type Props = {
  value: IntoleranceCounts;
  onChange: (value: IntoleranceCounts) => void;
  totalPeople?: number;
  legend?: string;
};

export function IntoleranceCountsFields({
  value,
  onChange,
  totalPeople,
  legend = "Intolleranze per tipo (conteggio persone)",
}: Props) {
  const normalized = normalizeIntoleranceCounts(value);
  const sum = intoleranceCountsTotal(normalized);

  function setCount(id: (typeof INTOLERANCE_TYPES)[number]["id"], raw: string) {
    const n = Math.max(0, Number(raw) || 0);
    const next = { ...normalized };
    if (n <= 0) delete next[id];
    else next[id] = n;
    onChange(next);
  }

  return (
    <fieldset className="intolerance-counts">
      <legend>{legend}</legend>
      <p className="muted small-hint">
        Indica quante persone hanno ogni intolleranza (non serve il nome).
      </p>
      <div className="grid intolerance-grid">
        {INTOLERANCE_TYPES.map((t) => (
          <label key={t.id}>
            {t.label}
            <input
              type="number"
              min={0}
              max={totalPeople ?? 999}
              value={normalized[t.id] ?? ""}
              placeholder="0"
              onChange={(e) => setCount(t.id, e.target.value)}
            />
          </label>
        ))}
      </div>
      {totalPeople != null && sum > totalPeople && (
        <p className="warn-text">Attenzione: la somma ({sum}) supera le persone ({totalPeople}).</p>
      )}
      {sum > 0 && (
        <p className="muted small-hint">
          Totale segnalazioni: {sum}
          {totalPeople != null ? ` · Persone nel gruppo: ${totalPeople}` : ""}
        </p>
      )}
    </fieldset>
  );
}

export function emptyIntoleranceCounts(): IntoleranceCounts {
  return { ...EMPTY_INTOLERANCE_COUNTS };
}
