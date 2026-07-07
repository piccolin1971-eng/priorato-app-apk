import { useEffect, useMemo, useState } from "react";
import type { BoardType, GuestStay, RegistrationKind } from "../types";
import { assignNearbyPartyRooms, partyPeopleAndRooms } from "../assignNearbyRooms";
import { getAvailableRooms } from "../roomAvailability";
import { updateStay } from "../storage";
import { getPersonCount, getStayRoomIds } from "../stayUtils";
import { boardLabel, defaultMeals } from "../utils";
import { DateInput } from "./DateInput";

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
  leaderName: string;
  leaderPhone: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  board: BoardType;
  lunch: boolean;
  dinner: boolean;
  intolerances: string;
  notes: string;
  partyExtra: number;
  partyCouples: number;
};

function stayToForm(stay: GuestStay): FormState {
  const people = getPersonCount(stay);
  const mode = stay.kind ?? (stay.group ? "group" : stay.secondGuestName ? "double" : people > 1 ? "party" : "single");
  return {
    mode,
    guestName: stay.guestName,
    secondGuestName: stay.secondGuestName ?? "",
    guestPhone: stay.guestPhone ?? "",
    guestEmail: stay.guestEmail ?? "",
    groupName: stay.group?.name ?? "",
    leaderName: stay.group?.leaderName ?? "",
    leaderPhone: stay.group?.leaderPhone ?? "",
    roomId: stay.roomId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    board: stay.board,
    lunch: stay.lunch,
    dinner: stay.dinner,
    intolerances: stay.intolerances,
    notes: stay.notes,
    partyExtra: Math.max(0, people - 1),
    partyCouples: stay.secondGuestName ? 1 : 0,
  };
}

export function EditStayModal({ stay, stays, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => stayToForm(stay));
  const [message, setMessage] = useState("");
  const [partySelectedRoomIds, setPartySelectedRoomIds] = useState<string[]>(getStayRoomIds(stay));
  const datesValid = form.checkOut > form.checkIn;
  const totalPeople = 1 + Math.max(0, form.partyExtra);
  const partyLayout = partyPeopleAndRooms(totalPeople, form.partyCouples);
  const bedFilter = form.mode === "double" ? "double" : form.mode === "single" || form.mode === "group" ? "single" : undefined;

  const availableRooms = useMemo(
    () => (datesValid && form.mode !== "party" ? getAvailableRooms(stays, form.checkIn, form.checkOut, stay.id, bedFilter) : []),
    [stays, form.checkIn, form.checkOut, datesValid, stay.id, form.mode, bedFilter],
  );

  const partyPlan = useMemo(() => {
    if (!datesValid || form.mode !== "party" || !partyLayout.valid) return null;
    return assignNearbyPartyRooms(stays, form.checkIn, form.checkOut, partyLayout.couplesCount, partyLayout.singlesCount, stay.id);
  }, [stays, form, datesValid, partyLayout, stay.id]);
  const partyAvailableRooms = useMemo(
    () => (datesValid && form.mode === "party" ? getAvailableRooms(stays, form.checkIn, form.checkOut, stay.id) : []),
    [stays, form.checkIn, form.checkOut, datesValid, form.mode, stay.id],
  );

  useEffect(() => {
    if (!datesValid || form.mode === "party") return;
    const freeIds = new Set(availableRooms.map((r) => r.id));
    if (!form.roomId || !freeIds.has(form.roomId)) {
      const next = availableRooms[0]?.id ?? "";
      if (next !== form.roomId) setForm((f) => ({ ...f, roomId: next }));
    }
  }, [availableRooms, datesValid, form.roomId, form.mode]);

  useEffect(() => {
    if (form.mode !== "party") return;
    const allowed = new Set(partyAvailableRooms.map((r) => r.id));
    const kept = partySelectedRoomIds.filter((id) => allowed.has(id));
    if (kept.length > 0) {
      if (kept.length !== partySelectedRoomIds.length) setPartySelectedRoomIds(kept);
      return;
    }
    setPartySelectedRoomIds(partyPlan?.roomIds ?? []);
  }, [form.mode, partyAvailableRooms, partyPlan, partySelectedRoomIds]);

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

  function togglePartyRoom(roomId: string) {
    setPartySelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  }

  const partySelectionOk = useMemo(() => {
    if (form.mode !== "party") return true;
    if (!partyLayout.valid) return false;
    if (partySelectedRoomIds.length !== partyLayout.roomsNeeded) return false;
    const selected = partyAvailableRooms.filter((r) => partySelectedRoomIds.includes(r.id));
    const doubles = selected.filter((r) => r.bedType === "double").length;
    const singles = selected.filter((r) => r.bedType === "single").length;
    return doubles >= partyLayout.couplesCount && singles >= partyLayout.singlesCount;
  }, [form.mode, partyLayout, partySelectedRoomIds, partyAvailableRooms]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) return setMessage("Inserisci il nome dell'ospite.");
    if (!datesValid) return setMessage("La data di partenza deve essere dopo l'arrivo.");
    if (form.mode === "group" && !form.leaderName.trim()) return setMessage("Per i gruppi indica il capo gruppo.");
    if (form.mode === "double" && !form.secondGuestName.trim()) return setMessage("Inserisci il nome del secondo ospite.");
    if (form.mode !== "party" && (!form.roomId || !availableRooms.some((r) => r.id === form.roomId))) {
      return setMessage("Camera non disponibile per le date selezionate.");
    }
    if (form.mode === "party" && (!partyLayout.valid || !partySelectionOk)) {
      return setMessage("Seleziona il numero corretto di camere (doppie/singole) per il gruppo.");
    }
    const selectedPartyRooms = partyAvailableRooms.filter((r) => partySelectedRoomIds.includes(r.id));

    const updated: GuestStay = {
      ...stay,
      kind: form.mode,
      guestName: form.guestName.trim(),
      secondGuestName: form.mode === "double" ? form.secondGuestName.trim() : undefined,
      guestPhone: form.guestPhone.trim() || undefined,
      guestEmail: form.guestEmail.trim() || undefined,
      roomId: form.mode === "party" ? selectedPartyRooms[0]!.id : form.roomId,
      roomIds: form.mode === "party" ? selectedPartyRooms.map((r) => r.id) : [form.roomId],
      personCount: form.mode === "double" ? 2 : form.mode === "party" ? totalPeople : 1,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      board: form.board,
      lunch: form.lunch,
      dinner: form.dinner,
      intolerances: form.intolerances.trim(),
      notes: form.notes.trim(),
      group:
        form.mode === "group"
          ? {
              name: form.groupName.trim() || "Gruppo senza nome",
              leaderName: form.leaderName.trim(),
              leaderPhone: form.leaderPhone.trim() || undefined,
            }
          : undefined,
    };

    onSaved(updateStay(updated));
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal panel" role="dialog" aria-labelledby="edit-stay-title" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2 id="edit-stay-title">Modifica registrazione</h2>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Chiudi">✕</button>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <div className="grid two">
            {form.mode !== "double" && form.mode !== "party" && (
              <label>Nome ospite *<input value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} /></label>
            )}
            <label>Camera *<select value={form.roomId} disabled={form.mode === "party" || !datesValid || availableRooms.length === 0} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>{availableRooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
            <DateInput label="Arrivo" value={form.checkIn} onChange={(checkIn) => setForm((f) => ({ ...f, checkIn }))} />
            <DateInput label="Partenza" value={form.checkOut} onChange={(checkOut) => setForm((f) => ({ ...f, checkOut }))} />
          </div>
          {form.mode === "double" && (
            <div className="card inset">
              <h3>Camera doppia</h3>
              <label>Primo ospite *<input value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} /></label>
              <label>Secondo ospite *<input value={form.secondGuestName} onChange={(e) => setForm((f) => ({ ...f, secondGuestName: e.target.value }))} /></label>
            </div>
          )}
          {form.mode === "party" && (
            <div className="card inset">
              <label>Primo ospite / referente *<input value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} /></label>
              <div className="grid two">
                <label>Altre persone<input type="number" min={1} value={form.partyExtra} onChange={(e) => setForm((f) => ({ ...f, partyExtra: Math.max(0, Number(e.target.value) || 0) }))} /></label>
                <label>Coppie in doppia<input type="number" min={0} max={Math.floor(totalPeople / 2)} value={form.partyCouples} onChange={(e) => setForm((f) => ({ ...f, partyCouples: Math.max(0, Number(e.target.value) || 0) }))} /></label>
              </div>
              <p className="muted">Camere attuali: {getStayRoomIds(stay).join(", ")} · nuove: {partyPlan?.rooms.map((r) => r.number).join(", ") ?? "—"}</p>
              <div className="party-room-picker">
                <p className="muted">
                  Seleziona {partyLayout.roomsNeeded} camere: almeno {partyLayout.couplesCount} doppie e {partyLayout.singlesCount} singole.
                </p>
                <div className="grid two">
                  {partyAvailableRooms.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={partySelectedRoomIds.includes(r.id)}
                        onChange={() => togglePartyRoom(r.id)}
                      />
                      {r.label} ({r.bedType === "double" ? "doppia" : "singola"})
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <label>Tipo soggiorno<select value={form.board} onChange={(e) => setBoard(e.target.value as BoardType)}><option value="bb">Notte + colazione</option><option value="half_lunch">Mezza pensione (pranzo)</option><option value="half_dinner">Mezza pensione (cena)</option><option value="full">Pensione completa</option></select><span className="hint">{boardLabel(form.board)}</span></label>
          <fieldset className="checks">
            <legend>Presenza pasti</legend>
            <label><input type="checkbox" checked={form.lunch} onChange={(e) => setForm((f) => ({ ...f, lunch: e.target.checked }))} />Pranzo</label>
            <label><input type="checkbox" checked={form.dinner} onChange={(e) => setForm((f) => ({ ...f, dinner: e.target.checked }))} />Cena</label>
          </fieldset>
          <div className="actions">
            <button type="submit" className="btn primary">Salva modifiche</button>
            <button type="button" className="btn ghost" onClick={onClose}>Annulla</button>
            {message && <p className="feedback warn-text">{message}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
