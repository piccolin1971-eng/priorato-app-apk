import { useMemo, useState } from "react";
import type { GuestStay } from "../types";
import { ROOMS } from "../data/rooms";
import { deleteStay } from "../storage";
import { getDayOccupancy } from "../roomAvailability";
import {
  aggregateIntoleranceCounts,
  formatIntoleranceCounts,
  formatStayIntolerances,
  hasIntoleranceInfo,
  intoleranceCountsTotal,
} from "../intolerances";
import { formatStayMealTiming, mealIncludedOnDay } from "../mealTiming";
import { getPersonCount, mealPersonCount, stayDisplayName, stayRoomsLabel, filterStaysByQuery } from "../stayUtils";
import { formatDateIt, isActiveOn, todayIso } from "../utils";
import { useSettings } from "../SettingsContext";
import { EditStayModal } from "./EditStayModal";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  stays: GuestStay[];
  day?: string;
  searchQuery?: string;
  onChange: (stays: GuestStay[]) => void;
  onOpenRooms?: () => void;
};

const SECTION = {
  ospiti: "sezione-ospiti",
  intolleranze: "sezione-intolleranze",
  pranzo: "sezione-pranzo",
  cena: "sezione-cena",
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
  className,
}: {
  value: string | number;
  label: string;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`stat stat-clickable${className ? ` ${className}` : ""}`}
      onClick={onClick}
      title={title}
    >
      <span className="stat-n">{value}</span>
      <span className="stat-l">{label}</span>
    </button>
  );
}

export function TodayReport({ stays, day = todayIso(), searchQuery = "", onChange, onOpenRooms }: Props) {
  const [editing, setEditing] = useState<GuestStay | null>(null);
  const [quickFilter, setQuickFilter] = useState<"all" | "arrivals" | "departures" | "lunch" | "dinner">("all");
  const { confirmBeforeDelete } = useSettings();

  const stats = useMemo(() => {
    const occupancy = getDayOccupancy(stays, day);
    const inHouse = filterStaysByQuery(stays.filter((s) => isActiveOn(s, day)), searchQuery);
    const arrivals = filterStaysByQuery(stays.filter((s) => s.checkIn === day), searchQuery);
    const departures = filterStaysByQuery(stays.filter((s) => s.checkOut === day), searchQuery);
    const lunch = inHouse.filter((s) => mealIncludedOnDay(s, day, "lunch"));
    const dinner = inHouse.filter((s) => mealIncludedOnDay(s, day, "dinner"));
    const intolerances = inHouse.filter((s) => hasIntoleranceInfo(s));
    const lunchIntolerances = lunch.filter((s) => hasIntoleranceInfo(s));
    const dinnerIntolerances = dinner.filter((s) => hasIntoleranceInfo(s));
    const lunchIntolCounts = aggregateIntoleranceCounts(stays, day, "lunch");
    const dinnerIntolCounts = aggregateIntoleranceCounts(stays, day, "dinner");
    const intolCountTotal =
      intoleranceCountsTotal(lunchIntolCounts) + intoleranceCountsTotal(dinnerIntolCounts);

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
      lunchIntolerancesCount: lunchIntolerances.length,
      dinnerIntolerancesCount: dinnerIntolerances.length,
      lunchIntolCounts,
      dinnerIntolCounts,
      intolCountTotal,
      freeRooms,
      occupied: occupancy.occupiedCount,
      peopleInHouse: sumPeople(inHouse),
      lunchPeople: lunch.reduce((n, s) => n + mealPersonCount(s, "lunch", day), 0),
      dinnerPeople: dinner.reduce((n, s) => n + mealPersonCount(s, "dinner", day), 0),
      groups: [...groups.values()],
    };
  }, [stays, day, searchQuery]);

  const searching = searchQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (quickFilter === "all") return stats;
    const match = (s: GuestStay) => {
      if (quickFilter === "arrivals") return s.checkIn === day;
      if (quickFilter === "departures") return s.checkOut === day;
      if (quickFilter === "lunch") return mealIncludedOnDay(s, day, "lunch");
      return mealIncludedOnDay(s, day, "dinner");
    };
    return {
      ...stats,
      inHouse: stats.inHouse.filter(match),
      arrivals: stats.arrivals.filter(match),
      departures: stats.departures.filter(match),
      lunch: stats.lunch.filter(match),
      dinner: stats.dinner.filter(match),
      intolerances: stats.intolerances.filter(match),
      groups: stats.groups,
    };
  }, [stats, quickFilter, day]);

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
        {searching && <p className="muted">Filtro ricerca attivo.</p>}
      </header>

      <div className="today-quick-filters">
        <button
          type="button"
          className={quickFilter === "all" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => setQuickFilter("all")}
        >
          Tutto
        </button>
        <button
          type="button"
          className={quickFilter === "arrivals" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => setQuickFilter("arrivals")}
        >
          Arrivi
        </button>
        <button
          type="button"
          className={quickFilter === "departures" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => setQuickFilter("departures")}
        >
          Partenze
        </button>
        <button
          type="button"
          className={quickFilter === "lunch" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => setQuickFilter("lunch")}
        >
          Con pranzo
        </button>
        <button
          type="button"
          className={quickFilter === "dinner" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => setQuickFilter("dinner")}
        >
          Con cena
        </button>
      </div>

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
        <StatButton
          value={stats.lunchPeople}
          label="A pranzo"
          title="Vai all'elenco pranzo"
          onClick={() => scrollToSection(SECTION.pranzo)}
        />
        <StatButton
          value={stats.dinnerPeople}
          label="A cena"
          title="Vai all'elenco cena"
          onClick={() => scrollToSection(SECTION.cena)}
        />
        {(stats.intolerances.length > 0 || stats.intolCountTotal > 0) && (
          <StatButton
            value={stats.intolCountTotal > 0 ? stats.intolCountTotal : stats.intolerances.length}
            label={
              stats.intolCountTotal > 0
                ? `Diete pranzo/cena`
                : `Pranzo ${stats.lunchIntolerancesCount} · Cena ${stats.dinnerIntolerancesCount}`
            }
            title="Vai al dettaglio intolleranze"
            onClick={() => scrollToSection(SECTION.intolleranze)}
            className="stat-alert"
          />
        )}
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

      {stats.groups.length > 0 && (
        <div className="card inset">
          <h3 className="report-title">Gruppi in casa</h3>
          <ul className="simple-list">
            {stats.groups.map((g) => (
              <li key={`${g.name}-${g.leader}`}>
                <strong>{g.name}</strong> — capo gruppo: {g.leader} ({g.count} ospiti)
              </li>
            ))}
          </ul>
        </div>
      )}

      {(stats.intolerances.length > 0 || stats.intolCountTotal > 0) && (
        <div className="card inset warn report-section" id={SECTION.intolleranze}>
          <h3 className="report-title">Intolleranze / allergie (cucina)</h3>
          {stats.intolCountTotal > 0 && (
            <div className="intolerance-totals">
              {intoleranceCountsTotal(stats.lunchIntolCounts) > 0 && (
                <p>
                  <strong>Pranzo:</strong> {formatIntoleranceCounts(stats.lunchIntolCounts)}
                </p>
              )}
              {intoleranceCountsTotal(stats.dinnerIntolCounts) > 0 && (
                <p>
                  <strong>Cena:</strong> {formatIntoleranceCounts(stats.dinnerIntolCounts)}
                </p>
              )}
            </div>
          )}
          {filtered.intolerances.length > 0 && (
            <ul className="simple-list">
              {filtered.intolerances.map((s) => (
                <li key={s.id}>
                  {stayDisplayName(s)} ({stayRoomsLabel(s)}): {formatStayIntolerances(s)}
                  {(s.lunch || s.dinner) && (
                    <span className="muted">
                      {" "}
                      — {s.lunch && s.dinner ? "pranzo e cena" : s.lunch ? "pranzo" : "cena"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="split-panels">
        <div className="card inset report-section" id={SECTION.pranzo}>
          <h3 className="report-title">Elenco pranzo</h3>
          {filtered.lunch.length === 0 ? (
            <p className="muted">Nessuno a pranzo.</p>
          ) : (
            <ul className="simple-list">
              {filtered.lunch.map((s) => (
                <li key={`lunch-${s.id}`}>
                  {stayDisplayName(s)} · {stayRoomsLabel(s)}
                  {s.group && ` · ${s.group.name}`}
                  {formatStayIntolerances(s) && ` · ${formatStayIntolerances(s)}`}
                  {formatStayMealTiming(s, day) && ` · ${formatStayMealTiming(s, day)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card inset report-section" id={SECTION.cena}>
          <h3 className="report-title">Elenco cena</h3>
          {filtered.dinner.length === 0 ? (
            <p className="muted">Nessuno a cena.</p>
          ) : (
            <ul className="simple-list">
              {filtered.dinner.map((s) => (
                <li key={`dinner-${s.id}`}>
                  {stayDisplayName(s)} · {stayRoomsLabel(s)}
                  {s.group && ` · ${s.group.name}`}
                  {formatStayIntolerances(s) && ` · ${formatStayIntolerances(s)}`}
                  {formatStayMealTiming(s, day) && ` · ${formatStayMealTiming(s, day)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="split-panels">
        <div className="card inset report-section" id={SECTION.arrivi}>
          <h3 className="report-title">Arrivi</h3>
          {filtered.arrivals.length === 0 ? (
            <p className="muted">Nessun arrivo.</p>
          ) : (
            <ul className="guest-list">
              {filtered.arrivals.map((s) => (
                <GuestRow
                  key={s.id}
                  stay={s}
                  day={day}
                  confirmBeforeDelete={confirmBeforeDelete}
                  onEdit={setEditing}
                  onDelete={onChange}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="card inset report-section" id={SECTION.partenze}>
          <h3 className="report-title">Partenze</h3>
          {filtered.departures.length === 0 ? (
            <p className="muted">Nessuna partenza.</p>
          ) : (
            <ul className="guest-list">
              {filtered.departures.map((s) => (
                <GuestRow
                  key={s.id}
                  stay={s}
                  day={day}
                  confirmBeforeDelete={confirmBeforeDelete}
                  onEdit={setEditing}
                  onDelete={onChange}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card inset report-section" id={SECTION.ospiti}>
        <h3 className="report-title">Tutti gli ospiti in casa</h3>
        {filtered.inHouse.length === 0 ? (
          <p className="muted">Nessun ospite registrato per oggi.</p>
        ) : (
          <ul className="guest-list">
            {filtered.inHouse.map((s) => (
              <GuestRow
                key={s.id}
                stay={s}
                day={day}
                showMeals
                confirmBeforeDelete={confirmBeforeDelete}
                onEdit={setEditing}
                onDelete={onChange}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GuestRow({
  stay,
  day,
  showMeals,
  confirmBeforeDelete,
  onEdit,
  onDelete,
}: {
  stay: GuestStay;
  day: string;
  showMeals?: boolean;
  confirmBeforeDelete: boolean;
  onEdit: (stay: GuestStay) => void;
  onDelete: (stays: GuestStay[]) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function doDelete() {
    onDelete(deleteStay(stay.id));
    setConfirmOpen(false);
  }

  function requestDelete() {
    if (confirmBeforeDelete) {
      setConfirmOpen(true);
      return;
    }
    doDelete();
  }

  const room = stayRoomsLabel(stay);
  const confirmMessage =
    `Eliminare definitivamente la presenza di ${stayDisplayName(stay)}` +
    (room ? ` (${room})` : "") +
    "?\n\nL'operazione non può essere annullata.";

  return (
    <li className="guest-row">
      <div>
        <strong>{stayDisplayName(stay)}</strong>
        {showMeals && (
          <span className="meals meals-inline">
            {stay.lunch && <span className="pill">Pranzo</span>}
            {stay.dinner && <span className="pill">Cena</span>}
            {stay.intolerances && <span className="pill warn">{formatStayIntolerances(stay)}</span>}
          </span>
        )}
        <span className="muted block">{stayRoomsLabel(stay)}</span>
        <span className="muted block">
          dal {formatDateIt(stay.checkIn)} al {formatDateIt(stay.checkOut)}
          {formatStayMealTiming(stay, day) && ` · ${formatStayMealTiming(stay, day)}`}
        </span>
        {stay.group && (
          <span className="tag">
            {stay.group.name} · capo: {stay.group.leaderName}
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
          onClick={requestDelete}
          title="Elimina presenza"
        >
          ✕
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Elimina ospite"
        message={confirmMessage}
        confirmLabel="Elimina"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}
