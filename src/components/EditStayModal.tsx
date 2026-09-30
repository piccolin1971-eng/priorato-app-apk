import { useEffect, useMemo, useState } from "react";
import type { ArrivalMeal, BoardType, DepartureMeal, GuestStay, IntoleranceCounts, RegistrationKind } from "../types";
import { formatPartyLayoutLabel } from "../assignNearbyRooms";
import { getAvailableRooms, findRoomOverlaps, formatOverlapMessage } from "../roomAvailability";
import { MAX_PARTY_PEOPLE } from "../data/rooms";
import { pickDefaultRoom, roomOptionLabel, sortRoomsForSelect } from "../roomSelect";
import { buildIntoleranceFields, buildMealTimingFields } from "../stayFields";
import {
  buildPartyGroupInfo,
  countCouplesInRoomIds,
  isPartyLikeStay,
  occupantsFromStay,
  participantsFromOccupants,
} from "../partyStay";
import { getDeviceName } from "../device";
import { deleteStay, updateStay } from "../storage";
import { getPersonCount, getStayRoomIds, stayDisplayName, stayRoomsLabel } from "../stayUtils";
import { useSettings } from "../SettingsContext";
import { usePartyRooms } from "../usePartyRooms";
import { boardLabel, defaultMeals } from "../utils";
import { DateInput } from "./DateInput";
import { ConfirmDialog } from "./ConfirmDialog";
import { IntoleranceCountsFields, emptyIntoleranceCounts } from "./IntoleranceCountsFields";
import { MealTimingFields } from "./MealTimingFields";
import { PartyRoomsEditor } from "./PartyRoomsEditor";

type Props = {
  stay: GuestStay;
  stays: GuestStay[];
  onClose: () => void;
  onSaved: (stays: GuestStay[]) => void;
};

type FormState = {
  mode: RegistrationKind;
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

function stayToForm(stay: GuestStay): FormState {
  const people = getPersonCount(stay);
  const roomIds = getStayRoomIds(stay);
  const partyLike = isPartyLikeStay(stay);
  let mode: RegistrationKind = "single";
  if (stay.secondGuestName?.trim()) mode = "double";
  else if (partyLike) mode = "party";

  const groupName = stay.group?.name ?? "";

  return {
    mode,
    guestName: stay.guestName,
    secondGuestName: stay.secondGuestName ?? "",
    guestPhone: stay.guestPhone ?? "",
    guestEmail: stay.guestEmail ?? "",
    groupName: groupName === "Gruppo" || groupName === "Gruppo senza nome" ? "" : groupName,
    roomId: stay.roomId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    board: stay.board,
    lunch: stay.lunch,
    dinner: stay.dinner,
    intolerances: stay.intolerances,
    intoleranceCounts: stay.intoleranceCounts ?? emptyIntoleranceCounts(),
    arrivalMeal: stay.arrivalMeal,
    departureMeal: stay.departureMeal,
    notes: stay.notes,
    partyPeople: partyLike ? people : 0,
    partyCouples: partyLike
      ? Math.max(
          0,
          Math.min(
            countCouplesInRoomIds(roomIds),
            people - roomIds.length,
            Math.floor(people / 2),
          ),
        )
      : 0,
  };
}

export function EditStayModal({ stay, stays, onClose, onSaved }: Props) {
  if (stay.kind === "meal") {
    return <MealEditModal stay={stay} onClose={onClose} onSaved={onSaved} />;
  }
  return <OvernightEditModal stay={stay} stays={stays} onClose={onClose} onSaved={onSaved} />;
}

function boardForMeals(lunch: boolean, dinner: boolean): BoardType {
  if (lunch && dinner) return "full";
  if (lunch) return "half_lunch";
  if (dinner) return "half_dinner";
  return "bb";
}

function MealEditModal({
  stay,
  onClose,
  onSaved,
}: {
  stay: GuestStay;
  onClose: () => void;
  onSaved: (stays: GuestStay[]) => void;
}) {
  const [guestName, setGuestName] = useState(stay.guestName);
  const [guestPhone, setGuestPhone] = useState(stay.guestPhone ?? "");
  const [day, setDay] = useState(stay.checkIn);
  const [personCount, setPersonCount] = useState(getPersonCount(stay));
  const [lunch, setLunch] = useState(stay.lunch);
  const [dinner, setDinner] = useState(stay.dinner);
  const [intolerances, setIntolerances] = useState(stay.intolerances);
  const [intoleranceCounts, setIntoleranceCounts] = useState<IntoleranceCounts>(
    stay.intoleranceCounts ?? emptyIntoleranceCounts(),
  );
  const [notes, setNotes] = useState(stay.notes);
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return setMessage("Inserisci un nome o riferimento.");
    if (!lunch && !dinner) return setMessage("Segna almeno pranzo o cena.");
    const people = Math.max(1, personCount);
    const intoleranceExtras = buildIntoleranceFields(
      people > 1 ? "party" : "single",
      intoleranceCounts,
      intolerances,
    );
    onSaved(
      updateStay({
        ...stay,
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
        updatedAt: new Date().toISOString(),
        lastModifiedByDevice: getDeviceName(),
        group: undefined,
        secondGuestName: undefined,
        arrivalMeal: undefined,
        departureMeal: undefined,
      }),
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal panel"
        role="dialog"
        aria-labelledby="edit-meal-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="edit-meal-title">Modifica pranzo/cena</h2>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <DateInput label="Giorno" value={day} onChange={setDay} />
          <div className="grid two">
            <label>
              Nome o riferimento *
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </label>
            <label>
              Telefono
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
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
              <input value={intolerances} onChange={(e) => setIntolerances(e.target.value)} />
            </label>
          )}
          {personCount > 1 && (
            <label>
              Note intolleranze
              <input value={intolerances} onChange={(e) => setIntolerances(e.target.value)} />
            </label>
          )}
          <label>
            Note
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          {message && <p className="warn-text">{message}</p>}
          <div className="form-actions">
            <button type="button" className="btn danger ghost" onClick={() => setDeleteOpen(true)}>
              Elimina
            </button>
            <button type="submit" className="btn primary">
              Salva
            </button>
          </div>
        </form>
        <ConfirmDialog
          open={deleteOpen}
          title="Elimina pranzo/cena"
          message={`Eliminare definitivamente ${stayDisplayName(stay)}?`}
          confirmLabel="Elimina"
          danger
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            onSaved(deleteStay(stay.id));
          }}
        />
      </div>
    </div>
  );
}

function OvernightEditModal({ stay, stays, onClose, onSaved }: Props) {
  const { confirmBeforeDelete } = useSettings();
  const [form, setForm] = useState(() => stayToForm(stay));
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const datesValid = form.checkOut > form.checkIn;
  const totalPeople = Math.max(0, form.partyPeople);
  const bedFilter = form.mode === "double" ? "double" : form.mode === "single" ? "single" : undefined;

  const availableRooms = useMemo(
    () =>
      datesValid && form.mode !== "party"
        ? getAvailableRooms(stays, form.checkIn, form.checkOut, stay.id, bedFilter, form.departureMeal)
        : [],
    [stays, form.checkIn, form.checkOut, datesValid, stay.id, form.mode, bedFilter, form.departureMeal],
  );

  const party = usePartyRooms({
    enabled: form.mode === "party",
    stays,
    excludeStayId: stay.id,
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    totalPeople,
    couplesCount: form.partyCouples,
    initialRoomIds: getStayRoomIds(stay),
    initialOccupants: occupantsFromStay(stay),
    departureMeal: form.departureMeal,
  });

  useEffect(() => {
    if (!datesValid || form.mode === "party") return;
    const freeIds = new Set(availableRooms.map((r) => r.id));
    if (!form.roomId || !freeIds.has(form.roomId)) {
      const next = pickDefaultRoom(availableRooms);
      if (next !== form.roomId) setForm((f) => ({ ...f, roomId: next }));
    }
  }, [availableRooms, datesValid, form.roomId, form.mode]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setBoard(board: BoardType) {
    const meals = defaultMeals(board);
    setForm((f) => ({ ...f, board, lunch: meals.lunch, dinner: meals.dinner }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) return setMessage("Inserisci il referente.");
    if (!datesValid) return setMessage("La data di partenza deve essere dopo l'arrivo.");
    if (form.mode === "double" && !form.secondGuestName.trim()) {
      return setMessage("Inserisci il nome del secondo ospite.");
    }
    if (form.mode !== "party" && (!form.roomId || !availableRooms.some((r) => r.id === form.roomId))) {
      return setMessage("Camera non disponibile per le date selezionate.");
    }
    if (form.mode === "party" && (totalPeople < 2 || !party.partyLayout.valid || !party.partySelectionOk)) {
      return setMessage("Controlla persone, camere doppie e disponibilità per le date.");
    }

    const selectedPartyRooms = party.selectedRoomIds;
    const roomIds = form.mode === "party" ? selectedPartyRooms : [form.roomId];

    const overlaps = findRoomOverlaps(stays, form.checkIn, form.checkOut, roomIds, stay.id, form.departureMeal);
    if (overlaps.length) {
      return setMessage(formatOverlapMessage(overlaps));
    }

    const updated: GuestStay = {
      ...stay,
      kind: form.mode === "group" ? "party" : form.mode,
      guestName: form.guestName.trim(),
      secondGuestName: form.mode === "double" ? form.secondGuestName.trim() : undefined,
      guestPhone: form.guestPhone.trim() || undefined,
      guestEmail: form.guestEmail.trim() || undefined,
      roomId: form.mode === "party" ? selectedPartyRooms[0]! : form.roomId,
      roomIds: form.mode === "party" ? selectedPartyRooms : [form.roomId],
      personCount: form.mode === "double" ? 2 : form.mode === "party" ? totalPeople : 1,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      board: form.board,
      lunch: form.lunch,
      dinner: form.dinner,
      ...buildIntoleranceFields(form.mode === "group" ? "party" : form.mode, form.intoleranceCounts, form.intolerances),
      ...buildMealTimingFields(form.arrivalMeal, form.departureMeal),
      notes: form.notes.trim(),
      updatedAt: new Date().toISOString(),
      lastModifiedByDevice: getDeviceName(),
      group:
        form.mode === "party"
          ? buildPartyGroupInfo({
              guestName: form.guestName,
              guestPhone: form.guestPhone,
              groupName: form.groupName,
              participants: participantsFromOccupants(selectedPartyRooms, party.occupants),
            })
          : undefined,
    };

    onSaved(updateStay(updated));
  }

  const maxDoubles = Math.floor(totalPeople / 2);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal panel"
        role="dialog"
        aria-labelledby="edit-stay-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="edit-stay-title">Modifica registrazione</h2>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <div className="grid two">
            {form.mode !== "double" && form.mode !== "party" && (
              <label>
                Nome ospite *
                <input
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                />
              </label>
            )}
            {form.mode !== "party" && (
              <label>
                Camera *
                <select
                  value={form.roomId}
                  disabled={!datesValid || availableRooms.length === 0}
                  onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  {sortRoomsForSelect(availableRooms).map((r) => (
                    <option key={r.id} value={r.id}>
                      {roomOptionLabel(r)}
                    </option>
                  ))}
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
          {form.mode === "double" && (
            <div className="card inset">
              <h3>Camera doppia</h3>
              <label>
                Primo ospite *
                <input
                  value={form.guestName}
                  onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                />
              </label>
              <label>
                Secondo ospite *
                <input
                  value={form.secondGuestName}
                  onChange={(e) => setForm((f) => ({ ...f, secondGuestName: e.target.value }))}
                />
              </label>
            </div>
          )}
          {form.mode === "party" && (
            <div className="card inset">
              <h3>Più persone / gruppi</h3>
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
          <MealTimingFields
            arrivalMeal={form.arrivalMeal}
            departureMeal={form.departureMeal}
            onArrivalChange={(arrivalMeal) => setForm((f) => ({ ...f, arrivalMeal }))}
            onDepartureChange={(departureMeal) => setForm((f) => ({ ...f, departureMeal }))}
          />
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
          {form.mode === "party" && (
            <IntoleranceCountsFields
              value={form.intoleranceCounts}
              onChange={(intoleranceCounts) => setForm((f) => ({ ...f, intoleranceCounts }))}
              totalPeople={totalPeople}
            />
          )}
          <div className="grid two">
            {(form.mode === "single" || form.mode === "double") && (
              <label>
                Intolleranze / allergie
                <input
                  value={form.intolerances}
                  onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
                />
              </label>
            )}
            <label>
              Note
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
          {form.mode === "party" && (
            <label>
              Note intolleranze (opzionale)
              <input
                value={form.intolerances}
                onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
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
            <button type="submit" className="btn primary">
              Salva modifiche
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Annulla
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => (confirmBeforeDelete ? setDeleteOpen(true) : onSaved(deleteStay(stay.id)))}
            >
              Elimina
            </button>
            {message && <p className="feedback warn-text">{message}</p>}
          </div>
        </form>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Elimina ospite"
        message={`Eliminare definitivamente ${stayDisplayName(stay)} (${stayRoomsLabel(stay)})?`}
        confirmLabel="Elimina"
        danger
        onConfirm={() => onSaved(deleteStay(stay.id))}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
