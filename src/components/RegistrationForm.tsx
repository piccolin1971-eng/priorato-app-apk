import { useEffect, useMemo, useState } from "react";
import type { ArrivalMeal, BoardType, DepartureMeal, GuestStay, IntoleranceCounts, RegistrationKind } from "../types";
import { addStay } from "../storage";
import { assignNearbyPartyRooms, formatPartyRoomList, partyPeopleAndRooms } from "../assignNearbyRooms";
import { getAvailableRooms, pickFirstFreeRoom, findRoomOverlaps, formatOverlapMessage, TOTAL_ROOMS } from "../roomAvailability";
import { pickDefaultRoom, roomOptionLabel, sortRoomsForSelect } from "../roomSelect";
import { buildIntoleranceFields, buildMealTimingFields } from "../stayFields";
import { buildPartyGroupInfo } from "../partyStay";
import { getDeviceName } from "../device";
import { boardLabel, dateToIso, defaultMeals, isoToDate, newId, todayIso } from "../utils";
import { DateInput } from "./DateInput";
import { IntoleranceCountsFields, emptyIntoleranceCounts } from "./IntoleranceCountsFields";
import { MealTimingFields } from "./MealTimingFields";

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
  leaderName: string;
  leaderPhone: string;
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
  partyExtra: number;
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
    leaderName: "",
    leaderPhone: "",
    roomId: pickFirstFreeRoom(stays, checkIn, checkOut, "single"),
    checkIn,
    checkOut,
    board: "bb",
    lunch: false,
    dinner: false,
    intolerances: "",
    intoleranceCounts: emptyIntoleranceCounts(),
    notes: "",
    partyExtra: 0,
    partyCouples: 0,
  };
}

const MODES: { id: RegMode; label: string; hint: string }[] = [
  { id: "single", label: "Singolo", hint: "1 persona, camera singola" },
  { id: "double", label: "Camera doppia", hint: "2 persone, 1 camera doppia" },
  {
    id: "party",
    label: "Più persone/gruppi",
    hint: "Più camere, conteggi pasti e intolleranze; nome gruppo opzionale",
  },
];

export function RegistrationForm({ stays, onSaved }: Props) {
  const [form, setForm] = useState(() => newForm(stays));
  const [message, setMessage] = useState("");
  const [partySelectedRoomIds, setPartySelectedRoomIds] = useState<string[]>([]);

  const datesValid = form.checkOut > form.checkIn;
  const totalPeople = 1 + Math.max(0, form.partyExtra);
  const partyLayout = partyPeopleAndRooms(totalPeople, form.partyCouples);

  const bedFilter = form.mode === "double" ? "double" : form.mode === "single" ? "single" : undefined;

  const availableRooms = useMemo(
    () =>
      datesValid && form.mode !== "party"
        ? getAvailableRooms(stays, form.checkIn, form.checkOut, undefined, bedFilter)
        : [],
    [stays, form.checkIn, form.checkOut, datesValid, form.mode, bedFilter],
  );

  const partyPlan = useMemo(() => {
    if (!datesValid || form.mode !== "party" || !partyLayout.valid) return null;
    return assignNearbyPartyRooms(
      stays,
      form.checkIn,
      form.checkOut,
      partyLayout.couplesCount,
      partyLayout.singlesCount,
    );
  }, [stays, form, datesValid, partyLayout]);
  const partyAvailableRooms = useMemo(
    () => (datesValid && form.mode === "party" ? getAvailableRooms(stays, form.checkIn, form.checkOut) : []),
    [stays, form.checkIn, form.checkOut, datesValid, form.mode],
  );

  useEffect(() => {
    if (!datesValid || form.mode === "party") return;
    const freeIds = new Set(availableRooms.map((r) => r.id));
    if (!form.roomId || !freeIds.has(form.roomId)) {
      const next = pickDefaultRoom(availableRooms);
      if (next !== form.roomId) setForm((f) => ({ ...f, roomId: next }));
    }
  }, [availableRooms, datesValid, form.roomId, form.mode]);

  useEffect(() => {
    if (form.mode !== "party") return;
    const allowed = new Set(partyAvailableRooms.map((r) => r.id));
    setPartySelectedRoomIds((prev) => {
      const kept = prev.filter((id) => allowed.has(id));
      if (kept.length > 0) return kept;
      return partyPlan?.roomIds ?? [];
    });
  }, [form.mode, partyAvailableRooms, partyPlan]);

  function setMode(mode: RegMode) {
    setForm((f) => ({
      ...f,
      mode,
      secondGuestName: mode === "double" ? f.secondGuestName : "",
      partyExtra: mode === "party" ? f.partyExtra : 0,
      partyCouples: mode === "party" ? f.partyCouples : 0,
      groupName: mode === "party" ? f.groupName : "",
      leaderName: mode === "party" ? f.leaderName : "",
      leaderPhone: mode === "party" ? f.leaderPhone : "",
      intoleranceCounts:
        mode === "party" ? f.intoleranceCounts : emptyIntoleranceCounts(),
      roomId:
        mode === "party"
          ? ""
          : pickFirstFreeRoom(
              stays,
              f.checkIn,
              f.checkOut,
              mode === "double" ? "double" : mode === "single" ? "single" : undefined,
            ),
    }));
    if (mode !== "party") setPartySelectedRoomIds([]);
    setMessage("");
  }

  function togglePartyRoom(roomId: string) {
    setPartySelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  }

  const partySelectionOk = useMemo(() => {
    if (form.mode !== "party") return true;
    if (!partyLayout.valid) return false;
    if (partyPlan && partyPlan.roomsShortage > 0) return false;
    if (partySelectedRoomIds.length !== partyLayout.roomsNeeded) return false;
    const selected = partyAvailableRooms.filter((r) => partySelectedRoomIds.includes(r.id));
    const doubles = selected.filter((r) => r.bedType === "double").length;
    return doubles >= partyLayout.couplesCount;
  }, [form.mode, partyLayout, partySelectedRoomIds, partyAvailableRooms, partyPlan]);

  function setBoard(board: BoardType) {
    const meals = defaultMeals(board);
    setForm((f) => ({ ...f, board, lunch: meals.lunch, dinner: meals.dinner }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) {
      setMessage("Inserisci il referente o il capo gruppo.");
      return;
    }
    if (!datesValid) {
      setMessage("La data di partenza deve essere dopo l'arrivo.");
      return;
    }

    function guardOverlap(roomIds: string[]): boolean {
      const overlaps = findRoomOverlaps(stays, form.checkIn, form.checkOut, roomIds);
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
      if (form.partyExtra < 1) {
        setMessage("Indica quante altre persone oltre al nominativo principale.");
        return;
      }
      if (!partyLayout.valid) {
        setMessage("Controlla il numero di coppie in camera doppia.");
        return;
      }
      if (!partySelectionOk) {
        setMessage("Seleziona il numero corretto di camere (doppie/singole) per il gruppo.");
        return;
      }
      const selectedRooms = partyAvailableRooms.filter((r) => partySelectedRoomIds.includes(r.id));
      const selectedRoomIds = selectedRooms.map((r) => r.id);
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
          leaderName: form.leaderName,
          leaderPhone: form.leaderPhone,
        }),
        notes: [form.notes.trim(), `Camere: ${selectedRooms.map((r) => r.number).join(", ")}`]
          .filter(Boolean)
          .join(" · "),
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
      partyExtra: f.mode === "party" ? f.partyExtra : 0,
      partyCouples: f.mode === "party" ? f.partyCouples : 0,
      groupName: f.mode === "party" ? f.groupName : "",
      leaderName: f.mode === "party" ? f.leaderName : "",
      leaderPhone: f.mode === "party" ? f.leaderPhone : "",
    }));
    setMessage("Registrazione salvata.");
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Nuova registrazione</h2>
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
              Una registrazione per tutte le persone: conteggi pasti, camere e intolleranze. I nomi
              singoli non servono.
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
                Capo gruppo (opzionale)
                <input
                  value={form.leaderName}
                  onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
                  placeholder="Se diverso dal referente"
                />
              </label>
              <label>
                Telefono capo gruppo
                <input
                  type="tel"
                  value={form.leaderPhone}
                  onChange={(e) => setForm((f) => ({ ...f, leaderPhone: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Referente / nominativo principale *
              <input
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </label>
            <div className="grid two">
              <label>
                Altre persone oltre al nominativo
                <input
                  type="number"
                  min={0}
                  max={TOTAL_ROOMS - 1}
                  value={form.partyExtra === 0 ? "" : form.partyExtra}
                  placeholder="es. 49"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      partyExtra: Math.min(
                        TOTAL_ROOMS - 1,
                        Math.max(0, Number(e.target.value || "0") || 0),
                      ),
                    }))
                  }
                />
                <span className="hint">Totale: {totalPeople} persone</span>
              </label>
              <label>
                Coppie in camera doppia
                <input
                  type="number"
                  min={0}
                  max={Math.floor(totalPeople / 2)}
                  value={form.partyCouples}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      partyCouples: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                <span className="hint">
                  {partyLayout.couplesCount} doppie + {partyLayout.singlesCount} singole ={" "}
                  {partyLayout.roomsNeeded} camere
                </span>
              </label>
            </div>
            {datesValid && partyLayout.valid && (
              <p className={`party-plan-preview${partyPlan && partyPlan.roomsShortage === 0 ? "" : " warn-text"}`}>
                {!partyPlan
                  ? `Non ci sono camere sufficienti per ${partyLayout.roomsNeeded} posti nelle date scelte.`
                  : partyPlan.roomsShortage > 0
                    ? `Sistemate ${partyPlan.rooms.length} camere su ${partyLayout.roomsNeeded} richieste — mancano ancora ${partyPlan.roomsShortage} camere.`
                    : partyPlan.usesMultipleBlocks
                      ? `Camere proposte su più blocchi (${partyPlan.sectionTitle}): ${formatPartyRoomList(partyPlan.rooms)}`
                      : `Camere proposte (${partyPlan.sectionTitle}): ${formatPartyRoomList(partyPlan.rooms)}`}
              </p>
            )}
            {datesValid && partyLayout.valid && partyPlan && partyPlan.usesMultipleBlocks && partyPlan.roomsShortage === 0 && (
              <p className="party-plan-note warn-text">
                Il gruppo non sta in un solo blocco: distribuito su {partyPlan.sectionTitle}. Puoi
                modificare le camere proposte se serve (scale/ascensori).
              </p>
            )}
            {datesValid && partyLayout.valid && partyAvailableRooms.length > 0 && (
              <div className="party-room-picker">
                <p className="muted">
                  Puoi cambiare le camere proposte (es. scale/ascensore). Seleziona {partyLayout.roomsNeeded} camere:
                  almeno {partyLayout.couplesCount} doppie e {partyLayout.singlesCount} singole.
                </p>
                <div className="grid two">
                  {sortRoomsForSelect(partyAvailableRooms).map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={partySelectedRoomIds.includes(r.id)}
                        onChange={() => togglePartyRoom(r.id)}
                      />
                      {roomOptionLabel(r)} ({r.bedType === "double" ? "doppia" : "singola"})
                    </label>
                  ))}
                </div>
              </div>
            )}
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
                  availableRooms.map((r) => (
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

        {form.mode === "party" && (
          <div className="grid two">
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
          </div>
        )}

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

        <div className="actions">
          <button
            type="submit"
            className="btn primary"
            disabled={
              !datesValid ||
              (form.mode === "party"
                ? !partySelectionOk || form.partyExtra < 1
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
