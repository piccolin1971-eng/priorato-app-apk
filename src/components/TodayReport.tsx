import { useMemo, useState } from "react";
import type { GuestStay } from "../types";
import { ROOMS } from "../data/rooms";
import { deleteStay } from "../storage";
import { getDayOccupancy } from "../roomAvailability";
import { getPersonCount, mealPersonCount, stayDisplayName, stayRoomsLabel } from "../stayUtils";
import { formatDateIt, isActiveOn, mealIncluded, todayIso } from "../utils";
import { EditStayModal } from "./EditStayModal";

type Props = {
  stays: GuestStay[];
  day?: string;
  onChange: (stays: GuestStay[]) => void;
  onOpenRooms?: () => void;
};

const SECTION = {
  ospiti: "sezione-ospiti",
  intolleranze: "sezione-intolleranze",
  arrivi: "sezione-arrivi",
  partenze: "sezione-partenze",
} as const;

function sumPeople(stays: GuestStay[]): number {
  return stays.reduce((n, s) => n + getPersonCount(s), 0);
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("section-highlight");
  window.setTimeout(() => el.classList.remove("section-highlight"), 1400);
}

function StatButton({
  value,
  label,
  title,
  onClick,
}: {
  value: string | number;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="stat stat-clickable" onClick={onClick} title={title}>
      <span className="stat-n">{value}</span>
      <span className="stat-l">{label}</span>
    </button>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <span className="stat-n">{value}</span>
      <span className="stat-l">{label}</span>
    </div>
  );
}

export function TodayReport({ stays, day = todayIso(), onChange, onOpenRooms }: Props) {
  const [editing, setEditing] = useState<GuestStay | null>(null);

  const stats = useMemo(() => {
    const occupancy = getDayOccupancy(stays, day);
    const inHouse = stays.filter((s) => isActiveOn(s, day));
    const arrivals = stays.filter((s) => s.checkIn === day);
    const departures = stays.filter((s) => s.checkOut === day);
    const lunch = inHouse.filter((s) => mealIncluded(s, "lunch"));
    const dinner = inHouse.filter((s) => mealIncluded(s, "dinner"));
    const intolerances = inHouse.filter((s) => s.intolerances.trim());
    const lunchIntolerances = lunch.filter((s) => s.intolerances.trim());
    const dinnerIntolerances = dinner.filter((s) => s.intolerances.trim());

    const freeRooms = occupancy.freeCount;

    const groups = new Map<string, { leader: string; count: number; name: string }>();
    for (const s of inHouse) {
      if (!s.group) continue;
      const key = `${s.group.name}|${s.group.leaderName}`;
      const prev = groups.get(key) ?? { name: s.group.name, leader: s.group.leaderName, count: 0 };
      prev.count += getPersonCount(s);
      groups.set(key, prev);
    }

    return {
      inHouse,
      arrivals,
      departures,
      lunch,
      dinner,
      intolerances,
      lunchIntolerances,
      dinnerIntolerances,
      freeRooms,
      occupied: occupancy.occupiedCount,
      peopleInHouse: sumPeople(inHouse),
      lunchPeople: lunch.reduce((n, s) => n + mealPersonCount(s, "lunch"), 0),
      dinnerPeople: dinner.reduce((n, s) => n + mealPersonCount(s, "dinner"), 0),
      groups: [...groups.values()],
    };
  }, [stays, day]);

  return (
    <section className="panel">
      {editing && (
        <EditStayModal
          stay={editing}
          stays={stays}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            onChange(next);
            setEditing(null);
          }}
        />
      )}
      <header className="panel-head">
        <h2>Report del {formatDateIt(day)}</h2>
        <p className="muted">Occupazione camere e presenze a pranzo/cena.</p>
      </header>

      <div className="stat-grid">
        <StatButton
          value={stats.peopleInHouse}
          label="Persone in casa"
          title="Vai all'elenco ospiti"
          onClick={() => scrollToSection(SECTION.ospiti)}
        />
        <StatButton
          value={`${stats.occupied}/${ROOMS.length}`}
          label="Camere occupate"
          title="Vedi schema camere"
          onClick={() => onOpenRooms?.()}
        />
        <Stat value={stats.lunchPeople} label="A pranzo" />
        <Stat value={stats.dinnerPeople} label="A cena" />
        <StatButton
          value={stats.arrivals.length}
          label="Arrivi oggi"
          title="Vai agli arrivi"
          onClick={() => scrollToSection(SECTION.arrivi)}
        />
        <StatButton
          value={stats.departures.length}
          label="Partenze oggi"
          title="Vai alle partenze"
          onClick={() => scrollToSection(SECTION.partenze)}
        />
      </div>

      {(stats.lunchIntolerances.length > 0 || stats.dinnerIntolerances.length > 0) && (
        <div className="stat-grid stat-grid-compact">
          <StatButton
            value={stats.lunchIntolerances.length}
            label="Intoll. a pranzo"
            title="Vai al dettaglio intolleranze"
            onClick={() => scrollToSection(SECTION.intolleranze)}
          />
          <StatButton
            value={stats.dinnerIntolerances.length}
            label="Intoll. a cena"
            title="Vai al dettaglio intolleranze"
            onClick={() => scrollToSection(SECTION.intolleranze)}
          />
        </div>
      )}

      {stats.groups.length > 0 && (
        <div className="card inset">
          <h3>Gruppi in casa</h3>
          <ul className="simple-list">
            {stats.groups.map((g) => (
              <li key={`${g.name}-${g.leader}`}>
                <strong>{g.name}</strong> — capo gruppo: {g.leader} ({g.count} ospiti)
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.intolerances.length > 0 && (
        <div className="card inset warn report-section" id={SECTION.intolleranze}>
          <h3>Intolleranze / allergie</h3>
          <ul className="simple-list">
            {stats.intolerances.map((s) => (
              <li key={s.id}>
                {stayDisplayName(s)} ({stayRoomsLabel(s)}): {s.intolerances}
                {(s.lunch || s.dinner) && (
                  <span className="muted">
                    {" "}
                    — {s.lunch && s.dinner ? "pranzo e cena" : s.lunch ? "pranzo" : "cena"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="split-panels">
        <div className="card inset report-section" id={SECTION.arrivi}>
          <h3>Arrivi</h3>
          {stats.arrivals.length === 0 ? (
            <p className="muted">Nessun arrivo.</p>
          ) : (
            <ul className="guest-list">
              {stats.arrivals.map((s) => (
                <GuestRow key={s.id} stay={s} onEdit={setEditing} onDelete={onChange} />
              ))}
            </ul>
          )}
        </div>
        <div className="card inset report-section" id={SECTION.partenze}>
          <h3>Partenze</h3>
          {stats.departures.length === 0 ? (
            <p className="muted">Nessuna partenza.</p>
          ) : (
            <ul className="guest-list">
              {stats.departures.map((s) => (
                <GuestRow key={s.id} stay={s} onEdit={setEditing} onDelete={onChange} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card inset report-section" id={SECTION.ospiti}>
        <h3>Tutti gli ospiti in casa</h3>
        {stats.inHouse.length === 0 ? (
          <p className="muted">Nessun ospite registrato per oggi.</p>
        ) : (
          <ul className="guest-list">
            {stats.inHouse.map((s) => (
              <GuestRow key={s.id} stay={s} showMeals onEdit={setEditing} onDelete={onChange} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GuestRow({
  stay,
  showMeals,
  onEdit,
  onDelete,
}: {
  stay: GuestStay;
  showMeals?: boolean;
  onEdit: (stay: GuestStay) => void;
  onDelete: (stays: GuestStay[]) => void;
}) {
  return (
    <li className="guest-row">
      <div>
        <strong>{stayDisplayName(stay)}</strong>
        <span className="muted block">{stayRoomsLabel(stay)}</span>
        <span className="muted block">
          dal {formatDateIt(stay.checkIn)} al {formatDateIt(stay.checkOut)}
        </span>
        {stay.group && (
          <span className="tag">
            {stay.group.name} · capo: {stay.group.leaderName}
          </span>
        )}
        {showMeals && (
          <span className="meals">
            {stay.lunch && <span className="pill">Pranzo</span>}
            {stay.dinner && <span className="pill">Cena</span>}
            {stay.intolerances && <span className="pill warn">{stay.intolerances}</span>}
          </span>
        )}
      </div>
      <div className="guest-row-actions">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => onEdit(stay)}
          title="Modifica registrazione"
        >
          ✎
        </button>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            const room = stayRoomsLabel(stay);
            const msg =
              `Eliminare definitivamente la presenza di ${stayDisplayName(stay)}` +
              (room ? ` (${room})` : "") +
              "?\n\nL'operazione non può essere annullata.";
            if (window.confirm(msg)) onDelete(deleteStay(stay.id));
          }}
          title="Elimina presenza"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
