import { useState } from "react";
import type { BoardType, GuestStay } from "../types";
import { addStay } from "../storage";
import { getDeviceName } from "../device";
import { buildIntoleranceFields } from "../stayFields";
import { newId, todayIso } from "../utils";
import { DateInput } from "./DateInput";
import { IntoleranceCountsFields, emptyIntoleranceCounts } from "./IntoleranceCountsFields";
import type { IntoleranceCounts } from "../types";

type Props = {
  stays?: GuestStay[];
  defaultDay?: string;
  onSaved: (stays: GuestStay[]) => void;
  onCancel?: () => void;
};

function boardForMeals(lunch: boolean, dinner: boolean): BoardType {
  if (lunch && dinner) return "full";
  if (lunch) return "half_lunch";
  if (dinner) return "half_dinner";
  return "bb";
}

export function MealRegistrationForm({ defaultDay = todayIso(), onSaved, onCancel }: Props) {
  const [day, setDay] = useState(defaultDay);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [personCount, setPersonCount] = useState(1);
  const [lunch, setLunch] = useState(true);
  const [dinner, setDinner] = useState(false);
  const [intolerances, setIntolerances] = useState("");
  const [intoleranceCounts, setIntoleranceCounts] = useState<IntoleranceCounts>(emptyIntoleranceCounts());
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      setMessage("Inserisci un nome o un riferimento (es. gruppo parrocchiale).");
      return;
    }
    if (!lunch && !dinner) {
      setMessage("Segna almeno pranzo o cena.");
      return;
    }
    const people = Math.max(1, personCount);
    const intoleranceExtras = buildIntoleranceFields(
      people > 1 ? "party" : "single",
      intoleranceCounts,
      intolerances,
    );
    const stay: GuestStay = {
      id: newId(),
      kind: "meal",
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim() || undefined,
      roomId: "",
      roomIds: [],
      personCount: people,
      checkIn: day,
      checkOut: day,
      board: boardForMeals(lunch, dinner),
      lunch,
      dinner,
      intolerances: intoleranceExtras.intolerances,
      intoleranceCounts: intoleranceExtras.intoleranceCounts,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      registeredByDevice: getDeviceName(),
    };
    onSaved(addStay(stay));
    setGuestName("");
    setGuestPhone("");
    setPersonCount(1);
    setLunch(true);
    setDinner(false);
    setIntolerances("");
    setIntoleranceCounts(emptyIntoleranceCounts());
    setNotes("");
    setMessage("Registrato. Compare nei contatori pranzo/cena della home.");
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Registra pranzi / cene</h2>
        <p className="muted">
          Solo pasti, senza camera. Serve alla cucina: aggiorna i contatori «A pranzo» e «A cena» in home.
        </p>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <DateInput label="Giorno" value={day} onChange={setDay} />

        <div className="grid two">
          <label>
            Nome o riferimento *
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Es. Mario Rossi / Gruppo catechisti"
              autoComplete="name"
            />
          </label>
          <label>
            Telefono
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Opzionale"
              inputMode="tel"
            />
          </label>
        </div>

        <label>
          Persone
          <input
            type="number"
            min={1}
            max={200}
            value={personCount}
            onChange={(e) => setPersonCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <fieldset className="meal-only-meals">
          <legend>Pasti</legend>
          <label className="check">
            <input type="checkbox" checked={lunch} onChange={(e) => setLunch(e.target.checked)} />
            Pranzo
          </label>
          <label className="check">
            <input type="checkbox" checked={dinner} onChange={(e) => setDinner(e.target.checked)} />
            Cena
          </label>
        </fieldset>

        {personCount > 1 ? (
          <IntoleranceCountsFields
            value={intoleranceCounts}
            onChange={setIntoleranceCounts}
            totalPeople={personCount}
          />
        ) : (
          <label>
            Intolleranze / diete
            <input
              value={intolerances}
              onChange={(e) => setIntolerances(e.target.value)}
              placeholder="Es. senza glutine, senza lattosio…"
            />
          </label>
        )}

        {personCount > 1 && (
          <label>
            Note intolleranze (testo libero)
            <input
              value={intolerances}
              onChange={(e) => setIntolerances(e.target.value)}
              placeholder="Dettagli opzionali"
            />
          </label>
        )}

        <label>
          Note
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>

        {message && <p className={message.startsWith("Registrato") ? "ok-text" : "warn-text"}>{message}</p>}

        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn ghost" onClick={onCancel}>
              Annulla
            </button>
          )}
          <button type="submit" className="btn primary">
            Salva pasti
          </button>
        </div>
      </form>
    </section>
  );
}
