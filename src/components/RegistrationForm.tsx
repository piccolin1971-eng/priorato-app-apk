import { useEffect, useMemo, useState } from "react";
import type { BoardType, GuestStay, RegistrationKind } from "../types";
import { addStay } from "../storage";
import { assignNearbyPartyRooms, partyPeopleAndRooms } from "../assignNearbyRooms";
import { getAvailableRooms, pickFirstFreeRoom, findRoomOverlaps, formatOverlapMessage } from "../roomAvailability";
import { boardLabel, dateToIso, defaultMeals, isoToDate, newId, todayIso } from "../utils";
import { DateInput } from "./DateInput";

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
  groupParticipants: {
    name: string;
    roomType: "single" | "double";
    inRoomWith: string;
    roomId: string;
    intolerances: string;
  }[];
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
    groupParticipants: [],
    roomId: pickFirstFreeRoom(stays, checkIn, checkOut, "single"),
    checkIn,
    checkOut,
    board: "bb",
    lunch: false,
    dinner: false,
    intolerances: "",
    notes: "",
    partyExtra: 0,
    partyCouples: 0,
  };
}

const MODES: { id: RegMode; label: string; hint: string }[] = [
  { id: "single", label: "Singolo", hint: "1 persona, camera singola" },
  { id: "double", label: "Camera doppia", hint: "2 persone, 1 camera doppia" },
  { id: "party", label: "Più persone", hint: "Una registrazione, più camere vicine" },
  { id: "group", label: "Gruppo organizzato", hint: "Con capo gruppo (1 persona)" },
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
  const suggestedGroupRooms = useMemo(() => {
    const anchor = availableRooms.find((r) => r.id === form.roomId);
    const score = (roomId: string) => {
      const r = availableRooms.find((x) => x.id === roomId);
      if (!r) return 9999;
      if (r.id === "106") return 9000;
      if (!anchor) return r.number;
      if (r.zone === anchor.zone && r.floor === anchor.floor) return r.number;
      if (r.zone === anchor.zone) return 1000 + r.number;
      return 2000 + r.number;
    };
    return [...availableRooms].sort((a, b) => score(a.id) - score(b.id));
  }, [availableRooms, form.roomId]);

  useEffect(() => {
    if (!datesValid || form.mode === "party") return;
    const freeIds = new Set(availableRooms.map((r) => r.id));
    if (!form.roomId || !freeIds.has(form.roomId)) {
      const next = availableRooms.find((r) => r.id !== "106")?.id ?? availableRooms[0]?.id ?? "";
      if (next !== form.roomId) setForm((f) => ({ ...f, roomId: next }));
    }
  }, [availableRooms, datesValid, form.roomId, form.mode]);

  useEffect(() => {
    if (form.mode !== "party") return;
    // Default intelligente: pre-seleziona sempre la proposta migliore corrente.
    setPartySelectedRoomIds(partyPlan?.roomIds ?? []);
  }, [form.mode, partyPlan]);

  function setMode(mode: RegMode) {
    setForm((f) => ({
      ...f,
      mode,
      secondGuestName: mode === "double" ? f.secondGuestName : "",
      partyExtra: mode === "party" ? f.partyExtra : 0,
      partyCouples: mode === "party" ? f.partyCouples : 0,
      groupParticipants: mode === "group" ? f.groupParticipants : [],
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

  function updateGroupParticipant(
    idx: number,
    patch: Partial<{
      name: string;
      roomType: "single" | "double";
      inRoomWith: string;
      roomId: string;
      intolerances: string;
    }>,
  ) {
    setForm((f) => ({
      ...f,
      groupParticipants: f.groupParticipants.map((row, i) =>
        i === idx ? { ...row, ...patch } : row,
      ),
    }));
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

  function setBoard(board: BoardType) {
    const meals = defaultMeals(board);
    setForm((f) => ({ ...f, board, lunch: meals.lunch, dinner: meals.dinner }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.mode !== "group" && !form.guestName.trim()) {
      setMessage("Inserisci il nome dell'ospite.");
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
        intolerances: form.intolerances.trim(),
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
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
        intolerances: form.intolerances.trim(),
        notes: [form.notes.trim(), `Camere: ${selectedRooms.map((r) => r.number).join(", ")}`]
          .filter(Boolean)
          .join(" · "),
        createdAt: new Date().toISOString(),
      };
    } else if (form.mode === "group") {
      if (!form.leaderName.trim()) {
        setMessage("Per i gruppi indica il capo gruppo.");
        return;
      }
      if (!form.roomId || !availableRooms.some((r) => r.id === form.roomId)) {
        setMessage("Seleziona una stanza valida per il capo gruppo.");
        return;
      }
      const participants = form.groupParticipants
        .map((p) => ({
          name: p.name.trim(),
          roomType: p.roomType,
          inRoomWith: p.inRoomWith.trim(),
          roomId: p.roomId,
          intolerances: p.intolerances.trim(),
        }))
        .filter((p) => p.name || p.roomId || p.intolerances || p.inRoomWith);
      if (participants.some((p) => !p.name || !p.roomId)) {
        setMessage("Ogni partecipante deve avere nome e stanza assegnata.");
        return;
      }
      if (participants.some((p) => p.roomType === "double" && !p.inRoomWith)) {
        setMessage("Per ogni camera doppia indica “In camera con”.");
        return;
      }
      const allRoomIds = [form.roomId, ...participants.map((p) => p.roomId)];
      if (new Set(allRoomIds).size !== allRoomIds.length) {
        setMessage("Ogni membro del gruppo deve avere una stanza diversa.");
        return;
      }
      if (!allRoomIds.every((id) => availableRooms.some((r) => r.id === id))) {
        setMessage("Una o più stanze del gruppo non sono disponibili per le date selezionate.");
        return;
      }
      if (!guardOverlap(allRoomIds)) return;
      stay = {
        id: newId(),
        kind: "group",
        guestName: form.leaderName.trim(),
        personCount:
          1 + participants.reduce((n, p) => n + (p.roomType === "double" ? 2 : 1), 0),
        guestPhone: form.guestPhone.trim() || undefined,
        guestEmail: form.guestEmail.trim() || undefined,
        roomId: form.roomId,
        roomIds: allRoomIds,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        board: form.board,
        lunch: form.lunch,
        dinner: form.dinner,
        intolerances: form.intolerances.trim(),
        notes: form.notes.trim(),
        group: {
          name: form.groupName.trim() || "Gruppo senza nome",
          leaderName: form.leaderName.trim(),
          leaderPhone: form.leaderPhone.trim() || undefined,
          participants: participants.map((p) => ({
            name: p.name,
            roomId: p.roomId,
            roomType: p.roomType,
            inRoomWith: p.roomType === "double" ? p.inRoomWith : undefined,
            intolerances: p.intolerances || undefined,
          })),
        },
        createdAt: new Date().toISOString(),
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
        intolerances: form.intolerances.trim(),
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
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
      groupName: f.mode === "group" ? f.groupName : "",
      leaderName: f.mode === "group" ? f.leaderName : "",
      leaderPhone: f.mode === "group" ? f.leaderPhone : "",
      groupParticipants: f.mode === "group" ? f.groupParticipants : [],
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

        {form.mode === "group" && (
          <div className="card inset">
            <h3>Gruppo</h3>
            <div className="grid two">
              <label>
                Nome gruppo
                <input
                  value={form.groupName}
                  onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
                  placeholder="es. Pellegrinaggio Roma"
                />
              </label>
              <label>
                Capo gruppo *
                <input
                  value={form.leaderName}
                  onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
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
              <label>
                Stanza capo gruppo *
                <select
                  value={form.roomId}
                  disabled={!datesValid || availableRooms.length === 0}
                  onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  {availableRooms.length === 0 ? (
                    <option value="">Nessuna stanza libera</option>
                  ) : (
                    [...availableRooms].sort((a, b) =>
                      a.id === "106" ? 1 : b.id === "106" ? -1 : a.number - b.number,
                    ).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            {form.groupParticipants.map((p, idx) => {
              const taken = new Set(
                [form.roomId, ...form.groupParticipants.map((row) => row.roomId)].filter(Boolean),
              );
              const participantNumber =
                1 +
                form.groupParticipants
                  .slice(0, idx)
                  .reduce((n, row) => n + (row.roomType === "double" ? 2 : 1), 0);
              return (
                <div key={`grp-${idx}`} className="card inset">
                  <div className="grid two">
                    <label>
                      Partecipante {participantNumber} *
                      <input
                        value={p.name}
                        onChange={(e) => updateGroupParticipant(idx, { name: e.target.value })}
                      />
                    </label>
                    <label>
                      Tipo camera
                      <select
                        value={p.roomType}
                        onChange={(e) =>
                          updateGroupParticipant(idx, {
                            roomType: e.target.value as "single" | "double",
                            roomId: "",
                            inRoomWith: "",
                          })
                        }
                      >
                        <option value="single">Singola</option>
                        <option value="double">Doppia</option>
                      </select>
                    </label>
                    {p.roomType === "double" && (
                      <label>
                        In camera con (partecipante {participantNumber + 1}) *
                        <input
                          value={p.inRoomWith}
                          onChange={(e) =>
                            updateGroupParticipant(idx, { inRoomWith: e.target.value })
                          }
                          placeholder="Nome compagna/o"
                        />
                      </label>
                    )}
                    <label>
                      Stanza assegnata *
                      <select
                        value={p.roomId}
                        onChange={(e) => updateGroupParticipant(idx, { roomId: e.target.value })}
                      >
                        <option value="">Seleziona stanza</option>
                        {suggestedGroupRooms
                          .filter(
                            (r) =>
                              (r.id === p.roomId || !taken.has(r.id)) &&
                              r.bedType === p.roomType,
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Intolleranze
                      <input
                        value={p.intolerances}
                        onChange={(e) =>
                          updateGroupParticipant(idx, { intolerances: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          groupParticipants: f.groupParticipants.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="actions">
              <button
                type="button"
                className="btn ghost small"
                onClick={() =>
                  setForm((f) => {
                    const taken = new Set([f.roomId, ...f.groupParticipants.map((row) => row.roomId)].filter(Boolean));
                    const suggestedRoomId =
                      suggestedGroupRooms.find(
                        (r) => r.bedType === "single" && r.id !== "106" && !taken.has(r.id),
                      )?.id ?? "";
                    return {
                      ...f,
                      groupParticipants: [
                        ...f.groupParticipants,
                        {
                          name: "",
                          roomType: "single",
                          inRoomWith: "",
                          roomId: suggestedRoomId,
                          intolerances: "",
                        },
                      ],
                    };
                  })
                }
              >
                + Aggiungi partecipante
              </button>
            </div>
          </div>
        )}

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
            <h3>Più persone, una registrazione</h3>
            <p className="muted reg-hint">
              Es. «Mario Rossi» +4 = 5 persone a pranzo/cena, con camere vicine nello stesso piano.
            </p>
            <label>
              Primo ospite / referente *
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
                  min={1}
                  max={30}
                  value={form.partyExtra}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      partyExtra: Math.max(0, Number(e.target.value) || 0),
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
              <p className={`party-plan-preview${partyPlan ? "" : " warn-text"}`}>
                {partyPlan
                  ? `Camere proposte (${partyPlan.sectionTitle}): ${partyPlan.rooms.map((r) => r.number).join(", ")}`
                  : "Camere insufficienti o non raggruppabili nello stesso blocco."}
              </p>
            )}
            {datesValid && partyLayout.valid && partyPlan && partyPlan.sectionTitle.includes("+") && (
              <p className="party-plan-note warn-text">
                Il gruppo sarà distribuito su più blocchi/piani ({partyPlan.sectionTitle}). Controlla le
                camere selezionate prima di salvare.
              </p>
            )}
            {datesValid && partyLayout.valid && partyAvailableRooms.length > 0 && (
              <div className="party-room-picker">
                <p className="muted">
                  Puoi cambiare le camere proposte (es. scale/ascensore). Seleziona {partyLayout.roomsNeeded} camere:
                  almeno {partyLayout.couplesCount} doppie e {partyLayout.singlesCount} singole.
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
            )}
          </div>
        )}

        <div className="grid two">
          {form.mode !== "double" && form.mode !== "party" && form.mode !== "group" && (
            <label>
              Nome ospite *
              <input
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
                placeholder="Nome e cognome"
              />
            </label>
          )}
          {form.mode !== "party" && form.mode !== "group" && (
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
          {form.mode !== "party" && form.mode !== "group" && (
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
                      {r.label}
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

        {form.mode !== "group" ? (
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
        ) : (
          <>
            <label>
              Tipo pensione capo gruppo
              <select value={form.board} onChange={(e) => setBoard(e.target.value as BoardType)}>
                <option value="bb">Notte + colazione</option>
                <option value="half_lunch">Mezza pensione (pranzo)</option>
                <option value="half_dinner">Mezza pensione (cena)</option>
                <option value="full">Pensione completa</option>
              </select>
            </label>
            <fieldset className="checks">
              <legend>Pasti capo gruppo</legend>
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

        <div className="grid two">
          <label>
            Intolleranze / allergie
            <input
              value={form.intolerances}
              onChange={(e) => setForm((f) => ({ ...f, intolerances: e.target.value }))}
            />
          </label>
          <label>
            Note
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>

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
