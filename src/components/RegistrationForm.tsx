import { useEffect, useMemo, useState } from "react";
import type { ArrivalMeal, BoardType, DepartureMeal, GuestStay, IntoleranceCounts, RegistrationKind } from "../types";
import { addStay } from "../storage";
import { formatPartyLayoutLabel } from "../assignNearbyRooms";
import { getAvailableRooms, findRoomOverlaps, formatOverlapMessage, getDayOccupancy, suggestHeatedRoom } from "../roomAvailability";
import { MAX_PARTY_PEOPLE } from "../data/rooms";
import { roomOptionLabel, sortRoomsForSelect } from "../roomSelect";
import { buildIntoleranceFields, buildMealTimingFields } from "../stayFields";
import { buildPartyGroupInfo, participantsFromOccupants } from "../partyStay";
import { getDeviceName } from "../device";
import { boardLabel, dateToIso, defaultMeals, isoToDate, newId, todayIso } from "../utils";
import { usePartyRooms } from "../usePartyRooms";
import { DateInput } from "./DateInput";
import { IntoleranceCountsFields, emptyIntoleranceCounts } from "./IntoleranceCountsFields";
import { MealTimingFields } from "./MealTimingFields";
import { PartyRoomsEditor } from "./PartyRoomsEditor";
import { RoomPickMap } from "./RoomPickMap";

type Props = {
  stays: GuestStay[];
  onSaved: (stays: GuestStay[]) => void;
};

type RegMode = RegistrationKind;

type FormState = {
  mode: RegMode;
  guestName: string;
  secondGuestName: string;
  guestPhone: string;
  guestEmail: string;
  groupName: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  board: BoardType;
  lunch: boolean;
  dinner: boolean;
  intolerances: string;
  intoleranceCounts: IntoleranceCounts;
  arrivalMeal?: ArrivalMeal;
  departureMeal?: DepartureMeal;
  notes: string;
  partyPeople: number;
  partyCouples: number;
};

function newForm(stays: GuestStay[]): FormState {
  const checkIn = todayIso();
  const tomorrow = isoToDate(checkIn);
  if (tomorrow) tomorrow.setDate(tomorrow.getDate() + 1);
  const checkOut = tomorrow ? dateToIso(tomorrow) : checkIn;
  return {
    mode: "single",
    guestName: "",
    secondGuestName: "",
    guestPhone: "",
    guestEmail: "",
    groupName: "",
    roomId: suggestHeatedRoom(stays, checkIn, checkOut, "single"),
    checkIn,
    checkOut,
    board: "bb",
    lunch: false,
    dinner: false,
    intolerances: "",
    intoleranceCounts: emptyIntoleranceCounts(),
    notes: "",
    partyPeople: 0,
    partyCouples: 0,
  };
}

const MODES: { id: RegMode; label: string; hint: string }[] = [
  { id: "single", label: "Singolo", hint: "1 persona, camera singola" },
  { id: "double", label: "Camera doppia", hint: "2 persone, 1 camera doppia" },
  {
    id: "party",
    label: "Più persone/gruppi",
    hint: "Più camere, conteggi pasti e intolleranze; nominativi per stanza",
  },
];

export function RegistrationForm({ stays, onSaved }: Props) {
  const [form, setForm] = useState(() => newForm(stays));
  const [message, setMessage] = useState("");
  const [guided, setGuided] = useState(true);
  const [step, setStep] = useState(1);

  const datesValid = form.checkOut > form.checkIn;
  const totalPeople = Math.max(0, form.partyPeople);

  const bedFilter = form.mode === "double" ? "double" : form.mode === "single" ? "single" : undefined;

  const availableRooms = useMemo(
    () =>
      datesValid && form.mode !== "party"
        ? getAvailableRooms(stays, form.checkIn, form.checkOut, undefined, bedFilter, form.departureMeal)
        : [],
    [stays, form.checkIn, form.checkOut, datesValid, form.mode, bedFilter, form.departureMeal],
  );

  const party = usePartyRooms({
    enabled: form.mode === "party",
    stays,
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    totalPeople,
    couplesCount: form.partyCouples,
    departureMeal: form.departureMeal,
  });

  useEffect(() => {
    if (!datesValid || form.mode === "party") return;
    const freeIds = new Set(availableRooms.map((r) => r.id));
    if (!form.roomId || !freeIds.has(form.roomId)) {
      const next = suggestHeatedRoom(
        stays,
        form.checkIn,
        form.checkOut,
        bedFilter,
        form.departureMeal,
      );
      if (next !== form.roomId) setForm((f) => ({ ...f, roomId: next }));
    }
  }, [availableRooms, datesValid, form.roomId, form.mode]);

  function setMode(mode: RegMode) {
    setForm((f) => ({
      ...f,
      mode,
      secondGuestName: mode === "double" ? f.secondGuestName : "",
      partyPeople: mode === "party" ? f.partyPeople : 0,
      partyCouples: mode === "party" ? f.partyCouples : 0,
      groupName: mode === "party" ? f.groupName : "",
      intoleranceCounts: mode === "party" ? f.intoleranceCounts : emptyIntoleranceCounts(),
      roomId:
        mode === "party"
          ? ""
          : suggestHeatedRoom(
              stays,
              f.checkIn,
              f.checkOut,
              mode === "double" ? "double" : mode === "single" ? "single" : undefined,
              f.departureMeal,
            ),
    }));
    if (mode !== "party") party.reset();
    setMessage("");
  }

  function setBoard(board: BoardType) {
    const meals = defaultMeals(board);
    setForm((f) => ({ ...f, board, lunch: meals.lunch, dinner: meals.dinner }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) {
      setMessage(form.mode === "party" ? "Inserisci il referente." : "Inserisci il nome dell'ospite.");
      return;
    }
    if (!datesValid) {
      setMessage("La data di partenza deve essere dopo l'arrivo.");
      return;
    }

    function guardOverlap(roomIds: string[]): boolean {
      const overlaps = findRoomOverlaps(stays, form.checkIn, form.checkOut, roomIds, undefined, form.departureMeal);
      if (!overlaps.length) return true;
      setMessage(formatOverlapMessage(overlaps));
      return false;
    }

    const mealExtras = buildMealTimingFields(form.arrivalMeal, form.departureMeal);
    const intoleranceExtras = buildIntoleranceFields(
      form.mode,
      form.intoleranceCounts,
      form.intolerances,
    );

    let stay: GuestStay;

    if (form.mode === "double") {
      if (!form.secondGuestName.trim()) {
        setMessage("Inserisci il nome del secondo ospite.");
        return;
      }
      if (!form.roomId || !availableRooms.some((r) => r.id === form.roomId)) {
        setMessage("Seleziona una camera doppia libera.");
        return;
      }
      if (!guardOverlap([form.roomId])) return;
      stay = {
        id: newId(),
        kind: "double",
        guestName: form.guestName.trim(),
        secondGuestName: form.secondGuestName.trim(),
        personCount: 2,
        guestPhone: form.guestPhone.trim() || undefined,
        guestEmail: form.guestEmail.trim() || undefined,
        roomId: form.roomId,
        roomIds: [form.roomId],
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        board: form.board,
        lunch: form.lunch,
        dinner: form.dinner,
        ...intoleranceExtras,
        ...mealExtras,
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
        registeredByDevice: getDeviceName(),
      };
    } else if (form.mode === "party") {
      if (totalPeople < 2) {
        setMessage("Indica il numero totale di persone (almeno 2).");
        return;
      }
      if (!party.partyLayout.valid) {
        setMessage("Controlla il numero di camere doppie.");
        return;
      }
      if (!party.partySelectionOk) {
        setMessage("Non ci sono camere sufficienti per il gruppo nelle date scelte.");
        return;
      }
      const selectedRoomIds = party.selectedRoomIds;
      if (!guardOverlap(selectedRoomIds)) return;
      stay = {
        id: newId(),
        kind: "party",
        guestName: form.guestName.trim(),
        personCount: totalPeople,
        guestPhone: form.guestPhone.trim() || undefined,
        guestEmail: form.guestEmail.trim() || undefined,
        roomId: selectedRoomIds[0]!,
        roomIds: selectedRoomIds,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        board: form.board,
        lunch: form.lunch,
        dinner: form.dinner,
        ...intoleranceExtras,
        ...mealExtras,
        group: buildPartyGroupInfo({
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          groupName: form.groupName,
          participants: participantsFromOccupants(selectedRoomIds, party.occupants),
        }),
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
        registeredByDevice: getDeviceName(),
      };
    } else {
      if (!form.roomId || !availableRooms.some((r) => r.id === form.roomId)) {
        setMessage("Nessuna camera singola libera per le date selezionate.");
        return;
      }
      if (!guardOverlap([form.roomId])) return;
      stay = {
        id: newId(),
        kind: "single",
        guestName: form.guestName.trim(),
        personCount: 1,
        guestPhone: form.guestPhone.trim() || undefined,
        guestEmail: form.guestEmail.trim() || undefined,
        roomId: form.roomId,
        roomIds: [form.roomId],
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        board: form.board,
        lunch: form.lunch,
        dinner: form.dinner,
        ...intoleranceExtras,
        ...mealExtras,
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
        registeredByDevice: getDeviceName(),
      };
    }

    const nextStays = addStay(stay);
    onSaved(nextStays);
    setForm((f) => ({
      ...newForm(nextStays),
      checkIn: f.checkIn,
      checkOut: f.checkOut,
      mode: f.mode,
    }));
    party.reset();
    setStep(1);
    setMessage("Registrazione salvata.");
  }

  const maxDoubles = Math.floor(totalPeople / 2);
  const stayByRoom = useMemo(
    () => getDayOccupancy(stays, form.checkIn || todayIso()).stayByRoom,
    [stays, form.checkIn],
  );
  const suggestedId = useMemo(
    () =>
      form.mode === "party" || !datesValid
        ? ""
        : suggestHeatedRoom(stays, form.checkIn, form.checkOut, bedFilter, form.departureMeal),
    [stays, form.checkIn, form.checkOut, form.mode, bedFilter, form.departureMeal, datesValid],
  );
  const availableIds = useMemo(() => new Set(availableRooms.map((r) => r.id)), [availableRooms]);

  const stepOk =
    step === 1
      ? true
      : step === 2
        ? datesValid && (form.mode !== "party" || totalPeople >= 2)
        : step === 3
          ? form.mode === "party"
            ? party.partySelectionOk
            : Boolean(form.roomId && availableIds.has(form.roomId))
          : step === 4
            ? Boolean(form.guestName.trim()) &&
              (form.mode !== "double" || Boolean(form.secondGuestName.trim()))
            : true;

  const stepTitles = ["Chi arriva", "Quando", "Dove", "Chi è", "Pensione"];

  const pathToggle = (
    <div className="reg-path-toggle" role="group" aria-label="Tipo di registrazione">
      <button
        type="button"
        className={guided ? "active" : ""}
        onClick={() => setGuided(true)}
      >
        Passo passo
      </button>
      <button
        type="button"
        className={!guided ? "active" : ""}
        onClick={() => setGuided(false)}
      >
        Tutto in una pagina
      </button>
    </div>
  );

  if (guided) {
    return (
      <section className="panel">
        <header className="panel-head">
          <h2>Nuova registrazione</h2>
          {pathToggle}
        </header>
        <p className="wizard-progress">
          Passo {step} di 5 · {stepTitles[step - 1]}
        </p>
        <form
          className="form"
          onSubmit={(e) => {
            if (step < 5) {
              e.preventDefault();
              if (stepOk) setStep((s) => s + 1);
              return;
            }
            handleSubmit(e);
          }}
        >
          {step === 1 && (
            <div className="wizard-choices">
              {(
                [
                  { id: "single" as const, label: "Singolo", desc: "Una persona, camera singola" },
                  { id: "double" as const, label: "Coppia", desc: "Due persone, una camera doppia" },
                  { id: "party" as const, label: "Gruppo", desc: "Più persone e più camere" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`wizard-choice${form.mode === m.id ? " active" : ""}`}
                  onClick={() => {
                    setMode(m.id);
                    setStep(2);
                  }}
                >
                  <span className="wizard-choice-title">{m.label}</span>
                  <span className="wizard-choice-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              {form.mode === "party" && (
                <div className="grid two wizard-party-size">
                  <label>
                    Persone totali *
                    <input
                      type="number"
                      min={2}
                      max={MAX_PARTY_PEOPLE}
                      value={form.partyPeople === 0 ? "" : form.partyPeople}
                      placeholder="es. 50"
                      onChange={(e) => {
                        const n = Math.min(
                          MAX_PARTY_PEOPLE,
                          Math.max(0, Number(e.target.value || "0") || 0),
                        );
                        setForm((f) => ({
                          ...f,
                          partyPeople: n,
                          partyCouples: Math.min(f.partyCouples, Math.floor(n / 2)),
                        }));
                      }}
                    />
                    <span className="hint">Referente compreso</span>
                  </label>
                  <label>
                    Camere doppie
                    <input
                      type="number"
                      min={0}
                      max={maxDoubles}
                      value={form.partyCouples}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          partyCouples: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                    />
                    <span className="hint">
                      {totalPeople >= 2
                        ? formatPartyLayoutLabel(party.partyLayout)
                        : "0 doppie + 0 singole"}
                    </span>
                  </label>
                </div>
              )}
              <div className="grid two">
                <DateInput
                  label="Arrivo"
                  value={form.checkIn}
                  onChange={(checkIn) => setForm((f) => ({ ...f, checkIn }))}
                />
                <DateInput
                  label="Partenza"
                  value={form.checkOut}
                  onChange={(checkOut) => setForm((f) => ({ ...f, checkOut }))}
                />
              </div>
              <MealTimingFields
                arrivalMeal={form.arrivalMeal}
                departureMeal={form.departureMeal}
                onArrivalChange={(arrivalMeal) => setForm((f) => ({ ...f, arrivalMeal }))}
                onDepartureChange={(departureMeal) => setForm((f) => ({ ...f, departureMeal }))}
              />
              {!datesValid && (
                <p className="feedback">La partenza deve essere dopo l&apos;arrivo.</p>
              )}
            </>
          )}

          {step === 3 && form.mode !== "party" && (
            <RoomPickMap
              selectedId={form.roomId}
              suggestedId={suggestedId}
              availableIds={availableIds}
              stayByRoom={stayByRoom}
              bedType={bedFilter}
              onSelect={(roomId) => setForm((f) => ({ ...f, roomId }))}
            />
          )}
          {step === 3 && form.mode === "party" && totalPeople >= 2 && datesValid && (
            <PartyRoomsEditor
              selectedRoomIds={party.selectedRoomIds}
              occupants={party.occupants}
              availableRooms={party.partyAvailableRooms}
              layout={party.partyLayout}
              shortage={party.shortage}
              onReplaceRoom={party.replaceRoom}
              onOccupantsChange={party.setOccupants}
              onReplan={party.replan}
            />
          )}
          {step === 3 && form.mode === "party" && (totalPeople < 2 || !datesValid) && (
            <p className="muted">Torna indietro: servono le date e almeno 2 persone.</p>
          )}

          {step === 4 && (
            <div className="grid two">
              {form.mode === "party" && (
                <label>
                  Nome gruppo (opzionale)
                  <input
                    value={form.groupName}
                    onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
                    placeholder="es. Pellegrinaggio, Suore di…"
                  />
                </label>
              )}
              <label>
                {form.mode === "party"
                  ? "Referente *"
                  : form.mode === "double"
                    ? "Primo ospite *"
                    : "Nome ospite *"}
                <input
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                  placeholder="Nome e cognome"
                />
              </label>
              {form.mode === "double" && (
                <label>
                  Secondo ospite *
                  <input
                    value={form.secondGuestName}
                    onChange={(e) => setForm((f) => ({ ...f, secondGuestName: e.target.value }))}
                    placeholder="Nome e cognome"
                  />
                </label>
              )}
              <label>
                Telefono
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                />
              </label>
              {(form.mode === "single" || form.mode === "double") && (
                <label>
                  Intolleranze / allergie
                  <input
                    value={form.intolerances}
                    onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
                  />
                </label>
              )}
              <label className={form.mode === "party" ? "full-width" : ""}>
                Note
                <input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              {form.mode === "party" && (
                <>
                  <div className="full-width">
                    <IntoleranceCountsFields
                      value={form.intoleranceCounts}
                      onChange={(intoleranceCounts) => setForm((f) => ({ ...f, intoleranceCounts }))}
                      totalPeople={totalPeople}
                    />
                  </div>
                  <label className="full-width">
                    Note intolleranze (opzionale)
                    <input
                      value={form.intolerances}
                      onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
                      placeholder="Dettagli aggiuntivi per la cucina"
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {step === 5 && (
            <>
              <label>
                Tipo soggiorno
                <select value={form.board} onChange={(e) => setBoard(e.target.value as BoardType)}>
                  <option value="bb">Notte + colazione</option>
                  <option value="half_lunch">Mezza pensione (pranzo)</option>
                  <option value="half_dinner">Mezza pensione (cena)</option>
                  <option value="full">Pensione completa</option>
                </select>
                <span className="hint">{boardLabel(form.board)}</span>
              </label>
              <fieldset className="checks">
                <legend>Presenza pasti</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={form.lunch}
                    onChange={(e) => setForm((f) => ({ ...f, lunch: e.target.checked }))}
                  />
                  Pranzo
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.dinner}
                    onChange={(e) => setForm((f) => ({ ...f, dinner: e.target.checked }))}
                  />
                  Cena
                </label>
              </fieldset>
            </>
          )}

          <div className="actions wizard-actions">
            {step > 1 && (
              <button type="button" className="btn ghost" onClick={() => setStep((s) => s - 1)}>
                Indietro
              </button>
            )}
            {step > 1 && step < 5 && (
              <button type="submit" className="btn primary" disabled={!stepOk}>
                Avanti
              </button>
            )}
            {step === 5 && (
              <button
                type="submit"
                className="btn primary"
                disabled={
                  !datesValid ||
                  (form.mode === "party"
                    ? !party.partySelectionOk || totalPeople < 2
                    : availableRooms.length === 0)
                }
              >
                Salva registrazione
              </button>
            )}
            {message && <p className="feedback">{message}</p>}
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="panel">
        <header className="panel-head">
          <h2>Nuova registrazione</h2>
          {pathToggle}
        </header>

      <form className="form" onSubmit={handleSubmit}>
        <fieldset className="segmented segmented-wrap">
          <legend>Modalità</legend>
          {MODES.map((m) => (
            <label
              key={m.id}
              className={form.mode === m.id ? "seg active" : "seg"}
              title={m.hint}
            >
              <input
                type="radio"
                name="reg-mode"
                checked={form.mode === m.id}
                onChange={() => setMode(m.id)}
              />
              {m.label}
            </label>
          ))}
        </fieldset>

        {form.mode === "double" && (
          <div className="card inset">
            <h3>Camera doppia</h3>
            <p className="muted reg-hint">2 persone, 1 camera — conteggio pasti ×2.</p>
            <label>
              Primo ospite *
              <input
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </label>
            <label>
              Secondo ospite *
              <input
                value={form.secondGuestName}
                onChange={(e) => setForm((f) => ({ ...f, secondGuestName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </label>
          </div>
        )}

        {form.mode === "party" && (
          <div className="card inset">
            <h3>Più persone / gruppi</h3>
            <p className="muted reg-hint">
              Una registrazione per tutte le persone: pasti, camere e intolleranze. I nominativi si
              inseriscono sotto, stanza per stanza.
            </p>
            <div className="grid two">
              <label>
                Nome gruppo (opzionale)
                <input
                  value={form.groupName}
                  onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
                  placeholder="es. Pellegrinaggio, Suore di…"
                />
              </label>
              <label>
                Referente *
                <input
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                  placeholder="Nome e cognome"
                />
              </label>
              <label>
                Telefono referente
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </label>
              <label>
                Email referente
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                />
              </label>
              <label>
                Persone totali *
                <input
                  type="number"
                  min={2}
                  max={MAX_PARTY_PEOPLE}
                  value={form.partyPeople === 0 ? "" : form.partyPeople}
                  placeholder="es. 50"
                  onChange={(e) => {
                    const n = Math.min(
                      MAX_PARTY_PEOPLE,
                      Math.max(0, Number(e.target.value || "0") || 0),
                    );
                    setForm((f) => ({
                      ...f,
                      partyPeople: n,
                      partyCouples: Math.min(f.partyCouples, Math.floor(n / 2)),
                    }));
                  }}
                />
                <span className="hint">Referente compreso</span>
              </label>
              <label>
                Camere doppie
                <input
                  type="number"
                  min={0}
                  max={maxDoubles}
                  value={form.partyCouples}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      partyCouples: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                <span className="hint">
                  {totalPeople >= 2 ? formatPartyLayoutLabel(party.partyLayout) : "0 doppie + 0 singole"}
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="grid two">
          {form.mode === "single" && (
            <label>
              Nome ospite *
              <input
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </label>
          )}
          {form.mode !== "party" && (
            <>
              <label>
                Telefono ospite
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))}
                />
              </label>
              <label>
                Email ospite
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))}
                />
              </label>
            </>
          )}
          {form.mode !== "party" && (
            <label>
              Camera *
              <select
                value={form.roomId}
                disabled={!datesValid || availableRooms.length === 0}
                onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
              >
                {availableRooms.length === 0 ? (
                  <option value="">
                    {form.mode === "double" ? "Nessuna doppia libera" : "Nessuna singola libera"}
                  </option>
                ) : (
                  sortRoomsForSelect(availableRooms).map((r) => (
                    <option key={r.id} value={r.id}>
                      {roomOptionLabel(r)}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
          <DateInput
            label="Arrivo"
            value={form.checkIn}
            onChange={(checkIn) => setForm((f) => ({ ...f, checkIn }))}
          />
          <DateInput
            label="Partenza"
            value={form.checkOut}
            onChange={(checkOut) => setForm((f) => ({ ...f, checkOut }))}
          />
        </div>

        <MealTimingFields
          arrivalMeal={form.arrivalMeal}
          departureMeal={form.departureMeal}
          onArrivalChange={(arrivalMeal) => setForm((f) => ({ ...f, arrivalMeal }))}
          onDepartureChange={(departureMeal) => setForm((f) => ({ ...f, departureMeal }))}
        />

        <>
          <label>
            Tipo soggiorno
            <select value={form.board} onChange={(e) => setBoard(e.target.value as BoardType)}>
              <option value="bb">Notte + colazione</option>
              <option value="half_lunch">Mezza pensione (pranzo)</option>
              <option value="half_dinner">Mezza pensione (cena)</option>
              <option value="full">Pensione completa</option>
            </select>
            <span className="hint">{boardLabel(form.board)}</span>
          </label>

          <fieldset className="checks">
            <legend>Presenza pasti (per tutte le persone della registrazione)</legend>
            <label>
              <input
                type="checkbox"
                checked={form.lunch}
                onChange={(e) => setForm((f) => ({ ...f, lunch: e.target.checked }))}
              />
              Pranzo
              {form.mode === "party" && form.lunch && (
                <span className="hint"> → {totalPeople} a pranzo</span>
              )}
              {form.mode === "double" && form.lunch && (
                <span className="hint"> → 2 a pranzo</span>
              )}
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.dinner}
                onChange={(e) => setForm((f) => ({ ...f, dinner: e.target.checked }))}
              />
              Cena
              {form.mode === "party" && form.dinner && (
                <span className="hint"> → {totalPeople} a cena</span>
              )}
              {form.mode === "double" && form.dinner && (
                <span className="hint"> → 2 a cena</span>
              )}
            </label>
          </fieldset>
        </>

        <div className="grid two">
          {(form.mode === "single" || form.mode === "double") && (
            <label>
              Intolleranze / allergie (testo)
              <input
                value={form.intolerances}
                onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
              />
            </label>
          )}
          <label className={form.mode === "party" ? "full-width" : ""}>
            Note
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>

        {form.mode === "party" && (
          <IntoleranceCountsFields
            value={form.intoleranceCounts}
            onChange={(intoleranceCounts) => setForm((f) => ({ ...f, intoleranceCounts }))}
            totalPeople={totalPeople}
          />
        )}

        {form.mode === "party" && (
          <label>
            Note intolleranze (opzionale)
            <input
              value={form.intolerances}
              onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
              placeholder="Dettagli aggiuntivi per la cucina"
            />
          </label>
        )}

        {form.mode === "party" && totalPeople >= 2 && datesValid && (
          <PartyRoomsEditor
            selectedRoomIds={party.selectedRoomIds}
            occupants={party.occupants}
            availableRooms={party.partyAvailableRooms}
            layout={party.partyLayout}
            shortage={party.shortage}
            onReplaceRoom={party.replaceRoom}
            onOccupantsChange={party.setOccupants}
            onReplan={party.replan}
          />
        )}

        <div className="actions">
          <button
            type="submit"
            className="btn primary"
            disabled={
              !datesValid ||
              (form.mode === "party"
                ? !party.partySelectionOk || totalPeople < 2
                : availableRooms.length === 0)
            }
          >
            Salva registrazione
          </button>
          {message && <p className="feedback">{message}</p>}
        </div>
      </form>
    </section>
  );
}
