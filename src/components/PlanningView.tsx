import { useEffect, useMemo, useState } from "react";
import type { GuestStay } from "../types";
import { ROOMS, ROOM_SECTIONS } from "../data/rooms";
import { TOTAL_ROOMS, countOccupiedOnDay, getDayOccupancy, verifyAvailability } from "../roomAvailability";
import { stayDisplayName } from "../stayUtils";
import { dateToIso, formatDateIt, isoToDate, todayIso } from "../utils";
import { DateInput } from "./DateInput";

type Props = {
  stays: GuestStay[];
  day?: string;
};

type ViewMode = "mese" | "settimana";

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function occupancyClass(free: number): string {
  if (free >= 20) return "plan-ok";
  if (free >= 5) return "plan-warn";
  return "plan-full";
}

function monthMatrix(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<string | null>(startPad).fill(null),
  ];
  for (let d = 1; d <= lastDay; d++) {
    cells.push(dateToIso(new Date(year, month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function weekStartMonday(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return dateToIso(d);
}

function weekDaysFrom(iso: string): string[] {
  const start = isoToDate(weekStartMonday(iso));
  if (!start) return [];
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(dateToIso(d));
  }
  return days;
}

function defaultCheckOut(checkIn: string): string {
  const d = isoToDate(checkIn);
  if (!d) return checkIn;
  d.setDate(d.getDate() + 5);
  return dateToIso(d);
}

export function PlanningView({ stays, day = todayIso() }: Props) {
  const today = todayIso();
  const [viewMode, setViewMode] = useState<ViewMode>("mese");
  const [cursor, setCursor] = useState(() => isoToDate(day) ?? isoToDate(today) ?? new Date());
  const [selectedDay, setSelectedDay] = useState(day);
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(() => defaultCheckOut(today));
  const [roomsNeeded, setRoomsNeeded] = useState(1);

  useEffect(() => {
    setSelectedDay(day);
    const d = isoToDate(day);
    if (d) setCursor(d);
  }, [day]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthWeeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const weekDays = useMemo(() => weekDaysFrom(dateToIso(cursor)), [cursor]);

  const availability = useMemo(
    () => verifyAvailability(stays, checkIn, checkOut, roomsNeeded),
    [stays, checkIn, checkOut, roomsNeeded],
  );

  const dayDetail = useMemo(
    () => getDayOccupancy(stays, selectedDay),
    [stays, selectedDay],
  );

  const { stayByRoom, occupiedCount: selectedOccupied, freeCount: selectedFree, conflicts, unknownRoomStays } =
    dayDetail;

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function shiftWeek(delta: number) {
    setCursor((c) => {
      const n = new Date(c);
      n.setDate(n.getDate() + delta * 7);
      return n;
    });
  }

  function renderDayCell(day: string, large = false) {
    const occupied = countOccupiedOnDay(stays, day);
    const free = TOTAL_ROOMS - occupied;
    const isSelected = day === selectedDay;
    const isToday = day === today;

    return (
      <button
        key={day}
        type="button"
        className={`plan-day ${occupancyClass(free)}${large ? " plan-day-lg" : ""}${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
        onClick={() => setSelectedDay(day)}
        title={`${formatDateIt(day)}: ${occupied} occupate, ${free} libere`}
      >
        <span className="plan-day-n">{Number(day.slice(8, 10))}</span>
        <span className="plan-day-stat">{occupied}/{TOTAL_ROOMS}</span>
        <span className="plan-day-free">{free} libere</span>
      </button>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Occupazione/Disponibilità</h2>
        <p className="muted">Occupazione mese per mese o settimana per settimana — verifica posti senza registrare.</p>
      </header>

      <div className="card inset plan-check">
        <h3>Verifica disponibilità</h3>
        <div className="grid two">
          <DateInput label="Arrivo" value={checkIn} onChange={setCheckIn} />
          <DateInput label="Partenza" value={checkOut} onChange={setCheckOut} />
        </div>
        <label className="plan-rooms-needed">
          <span>Camere richieste</span>
          <input
            type="number"
            min={1}
            max={TOTAL_ROOMS}
            value={roomsNeeded}
            onChange={(e) => setRoomsNeeded(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        {availability && (
          <div className={`plan-result ${availability.ok ? "ok" : "no"}`}>
            {availability.ok ? (
              <p>
                <strong>Sì</strong> — ci sono almeno <strong>{roomsNeeded}</strong> camere libere ogni giorno
                dall&apos;{formatDateIt(checkIn)} al {formatDateIt(checkOut)} (minimo{" "}
                <strong>{availability.minFree}</strong> libere il {formatDateIt(availability.minFreeDay)}).
              </p>
            ) : (
              <p>
                <strong>No</strong> — non bastano le camere per tutti i giorni richiesti. Il giorno più critico è il{" "}
                <strong>{formatDateIt(availability.minFreeDay)}</strong> con solo{" "}
                <strong>{availability.minFree}</strong> camere libere (ne servono {roomsNeeded}).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="plan-toolbar">
        <fieldset className="segmented">
          <legend>Vista</legend>
          <label className={viewMode === "mese" ? "seg active" : "seg"}>
            <input
              type="radio"
              name="plan-view"
              checked={viewMode === "mese"}
              onChange={() => setViewMode("mese")}
            />
            Mese
          </label>
          <label className={viewMode === "settimana" ? "seg active" : "seg"}>
            <input
              type="radio"
              name="plan-view"
              checked={viewMode === "settimana"}
              onChange={() => setViewMode("settimana")}
            />
            Settimana
          </label>
        </fieldset>

        <div className="plan-nav">
          <button
            type="button"
            className="btn ghost"
            onClick={() => (viewMode === "mese" ? shiftMonth(-1) : shiftWeek(-1))}
          >
            ←
          </button>
          <span className="plan-period">
            {viewMode === "mese"
              ? `${MONTHS_IT[month]} ${year}`
              : `Settimana dal ${formatDateIt(weekDays[0] ?? today)}`}
          </span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => (viewMode === "mese" ? shiftMonth(1) : shiftWeek(1))}
          >
            →
          </button>
        </div>
      </div>

      <div className="plan-legend">
        <span className="plan-legend-item plan-ok">≥20 libere</span>
        <span className="plan-legend-item plan-warn">5–19 libere</span>
        <span className="plan-legend-item plan-full">&lt;5 libere</span>
      </div>

      {viewMode === "mese" ? (
        <div className="plan-month">
          <div className="plan-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          {monthWeeks.map((week, wi) => (
            <div key={wi} className="plan-week-row">
              {week.map((day, di) =>
                day ? (
                  renderDayCell(day)
                ) : (
                  <div key={`e-${wi}-${di}`} className="plan-day plan-day-empty" />
                ),
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="plan-week-view">
          <div className="plan-weekdays">
            {weekDays.map((day) => (
              <span key={day} className="plan-week-label" title={formatDateIt(day)}>
                <span>{WEEKDAYS[(isoToDate(day)!.getDay() + 6) % 7]}</span>
                <span className="plan-week-date">{formatDateIt(day)}</span>
              </span>
            ))}
          </div>
          <div className="plan-week-row plan-week-row-tall">
            {weekDays.map((day) => renderDayCell(day, true))}
          </div>
        </div>
      )}

      <div className="card inset plan-day-detail">
        <h3>Dettaglio {formatDateIt(selectedDay)}</h3>
        <p className="muted">
          {selectedOccupied} camere occupate · {selectedFree} libere su {TOTAL_ROOMS}
          {selectedDay !== day && (
            <span className="plan-day-note">
              {" "}
              · Giorno report: {formatDateIt(day)} (cambia data in alto per allineare)
            </span>
          )}
        </p>
        {conflicts.length > 0 && (
          <div className="plan-conflicts warn">
            <strong>Attenzione:</strong>{" "}
            {conflicts.map((c) => (
              <span key={c.roomId}>
                camera {c.roomId} con {c.stays.length} ospiti (
                {c.stays.map((s) => stayDisplayName(s)).join(", ")})
              </span>
            ))}
          </div>
        )}
        {unknownRoomStays.length > 0 && (
          <div className="plan-conflicts warn">
            <strong>Camere non riconosciute:</strong>{" "}
            {unknownRoomStays.map((s) => (
              <span key={s.id}>
                {stayDisplayName(s)} (id &quot;{s.roomId}&quot;)
              </span>
            ))}
          </div>
        )}
        <div className="plan-blocks">
          {ROOM_SECTIONS.map((sec) => {
            const sectionRooms = ROOMS.filter(sec.filter);
            const occupied = sectionRooms.filter((r) => stayByRoom.has(r.id)).length;
            return (
              <div key={sec.id} className={`plan-block plan-block-${sec.id}`}>
                <div className="plan-block-head">
                  <h4>{sec.title}</h4>
                  <span className="plan-block-range">{sec.range}</span>
                  <span className="plan-block-stat">
                    {occupied}/{sectionRooms.length} occupate
                  </span>
                </div>
                <div className="plan-block-rooms">
                  {sectionRooms.map((room) => {
                    const stay = stayByRoom.get(room.id);
                    const markerCount = room.bedType === "double" ? 2 : 1;
                    return (
                      <div
                        key={room.id}
                        className={`${stay ? "plan-room occupied" : "plan-room free"}${room.large ? " plan-room-large" : ""}`}
                        title={
                          stay
                            ? `${stayDisplayName(stay)} · dal ${formatDateIt(stay.checkIn)} al ${formatDateIt(stay.checkOut)}`
                            : "Libera"
                        }
                      >
                        <div
                          className={`plan-room-markers ${
                            markerCount === 2 ? "plan-room-markers-double" : "plan-room-markers-single"
                          }`}
                          aria-hidden
                        >
                          {Array.from({ length: markerCount }).map((_, i) => (
                            <span
                              key={`${room.id}-m-${i}`}
                              className={`plan-room-marker ${stay ? "occupied" : "free"}`}
                            />
                          ))}
                        </div>
                        <span className="plan-room-n">
                          {room.number}
                          {room.large && <span className="room-extra-badge">extra</span>}
                          {room.bedType === "double" && <span className="room-extra-badge">doppia</span>}
                        </span>
                        {stay ? (
                          <>
                            <span className="plan-room-guest">{stayDisplayName(stay)}</span>
                            {stay.group && <span className="plan-room-group">{stay.group.name}</span>}
                          </>
                        ) : (
                          <span className="plan-room-free">Libera</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
