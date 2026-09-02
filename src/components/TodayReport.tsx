import { useEffect, useMemo, useState } from "react";
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
import { stayBookingKind } from "../partyStay";
import { getPersonCount, mealPersonCount, stayDisplayName, stayGroupLabel, stayRoomsLabel, filterStaysByQuery, isPlaceholderGroupName } from "../stayUtils";
import { formatDateIt, stayOccupiesDay, todayIso } from "../utils";
import { useSettings } from "../SettingsContext";
import { EditStayModal } from "./EditStayModal";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  stays: GuestStay[];
  day?: string;
  searchQuery?: string;
  onChange: (stays: GuestStay[]) => void;
  onOpenRooms?: () => void;
  /** Sulla home: niente titolo "Report del…", stessa maschera di numeri. */
  embedded?: boolean;
};

const SECTION = {
  ospiti: "sezione-ospiti",
  intolleranze: "sezione-intolleranze",
  pranzo: "sezione-pranzo",
  cena: "sezione-cena",
  arrivi: "sezione-arrivi",
  partenze: "sezione-partenze",
} as const;

type OpenSection = "none" | (typeof SECTION)[keyof typeof SECTION];

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

function joinItAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

type MovementBreakdown = {
  people: number;
  lines: string[];
  mixed: boolean;
};

function movementBreakdown(stays: GuestStay[]): MovementBreakdown {
  const groupSizes: number[] = [];
  let singles = 0;
  let couples = 0;
  let people = 0;
  for (const stay of stays) {
    people += getPersonCount(stay);
    const kind = stayBookingKind(stay);
    if (kind === "group") groupSizes.push(getPersonCount(stay));
    else if (kind === "couple") couples += 1;
    else singles += 1;
  }
  groupSizes.sort((a, b) => b - a);
  const lines: string[] = [];
  if (groupSizes.length === 1) lines.push(`1 gruppo da ${groupSizes[0]}`);
  else if (groupSizes.length > 1) {
    lines.push(`${groupSizes.length} gruppi da ${joinItAnd(groupSizes.map(String))}`);
  }
  if (singles === 1) lines.push("1 singolo");
  else if (singles > 1) lines.push(`${singles} singoli`);
  if (couples === 1) lines.push("1 coppia");
  else if (couples > 1) lines.push(`${couples} coppie`);
  const categories = [groupSizes.length > 0, singles > 0, couples > 0].filter(Boolean).length;
  return { people, lines, mixed: categories > 1 };
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

function MovementStatButton({
  kindLabel,
  breakdown,
  title,
  onClick,
}: {
  kindLabel: string;
  breakdown: MovementBreakdown;
  title: string;
  onClick: () => void;
}) {
  const empty = breakdown.lines.length === 0;
  const header = breakdown.mixed ? `${kindLabel} · ${breakdown.people} persone` : kindLabel;
  const lines = empty ? ["nessuno"] : breakdown.lines;
  const summary = empty ? `${kindLabel}: nessuno` : `${header}: ${lines.join(", ")}`;
  return (
    <button
      type="button"
      className={`stat stat-clickable stat-movement${empty ? " empty" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={summary}
    >
      <span className="stat-l">{header}</span>
      <span className="stat-movement-lines">
        {lines.map((line) => (
          <span key={line} className="stat-movement-line">
            {line}
          </span>
        ))}
      </span>
    </button>
  );
}

export function TodayReport({
  stays,
  day = todayIso(),
  searchQuery = "",
  onChange,
  onOpenRooms,
  embedded = false,
}: Props) {
  const [editing, setEditing] = useState<GuestStay | null>(null);
  const [openSection, setOpenSection] = useState<OpenSection>("none");
  const { confirmBeforeDelete } = useSettings();

  const stats = useMemo(() => {
    const occupancy = getDayOccupancy(stays, day);
    const inHouse = filterStaysByQuery(stays.filter((s) => stayOccupiesDay(s, day)), searchQuery);
    const arrivals = filterStaysByQuery(stays.filter((s) => s.checkIn === day), searchQuery);
    const departures = filterStaysByQuery(stays.filter((s) => s.checkOut === day), searchQuery);
    const lunch = filterStaysByQuery(
      stays.filter((s) => mealIncludedOnDay(s, day, "lunch")),
      searchQuery,
    );
    const dinner = filterStaysByQuery(
      stays.filter((s) => mealIncludedOnDay(s, day, "dinner")),
      searchQuery,
    );
    const intolerances = [
      ...new Map(
        [...inHouse, ...lunch, ...dinner].filter(hasIntoleranceInfo).map((s) => [s.id, s]),
      ).values(),
    ];
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
      const display = stayGroupLabel(s) ?? s.guestName;
      const key = `${display}|${s.group.leaderName}`;
      const prev = groups.get(key) ?? { name: display, leader: s.group.leaderName, count: 0 };
      prev.count += getPersonCount(s);
      groups.set(key, prev);
    }

    const departingPresentPeople = sumPeople(inHouse.filter((s) => s.checkOut === day));

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
      departingPresentPeople,
      lunchPeople: lunch.reduce((n, s) => n + mealPersonCount(s, "lunch", day), 0),
      dinnerPeople: dinner.reduce((n, s) => n + mealPersonCount(s, "dinner", day), 0),
      groups: [...groups.values()],
    };
  }, [stays, day, searchQuery]);

  const searching = searchQuery.trim().length > 0;

  useEffect(() => {
    if (openSection === "none") return;
    scrollToSection(openSection);
  }, [openSection]);

  function showSection(section: OpenSection) {
    setOpenSection(section);
  }

  return (
    <section className={`panel${embedded ? " today-report-home" : ""}`}>
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
      {!embedded && (
        <header className="panel-head">
          <h2>Report del {formatDateIt(day)}</h2>
          {searching && <p className="muted">Filtro ricerca attivo.</p>}
        </header>
      )}
      {embedded && searching && <p className="muted">Filtro ricerca attivo.</p>}

      <div className="today-quick-filters">
        <button
          type="button"
          className={openSection === "none" ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => showSection("none")}
        >
          Tutto
        </button>
        <button
          type="button"
          className={openSection === SECTION.arrivi ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => showSection(SECTION.arrivi)}
        >
          Arrivi
        </button>
        <button
          type="button"
          className={openSection === SECTION.partenze ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => showSection(SECTION.partenze)}
        >
          Partenze
        </button>
        <button
          type="button"
          className={openSection === SECTION.pranzo ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => showSection(SECTION.pranzo)}
        >
          Con pranzo
        </button>
        <button
          type="button"
          className={openSection === SECTION.cena ? "quick-filter-btn active" : "quick-filter-btn"}
          onClick={() => showSection(SECTION.cena)}
        >
          Con cena
        </button>
      </div>

      <div className="stat-grid">
        <StatButton
          value={stats.peopleInHouse}
          label={
            stats.departingPresentPeople > 0
              ? `Persone in casa · ${stats.departingPresentPeople} in partenza`
              : "Persone in casa"
          }
          title="Vai all'elenco ospiti"
          onClick={() => showSection(SECTION.ospiti)}
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
          onClick={() => showSection(SECTION.pranzo)}
        />
        <StatButton
          value={stats.dinnerPeople}
          label="A cena"
          title="Vai all'elenco cena"
          onClick={() => showSection(SECTION.cena)}
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
            onClick={() => showSection(SECTION.intolleranze)}
            className="stat-alert"
          />
        )}
      </div>
      <div className="stat-grid stat-grid-movement">
        <MovementStatButton
          kindLabel="Arrivi"
          breakdown={movementBreakdown(stats.arrivals)}
          title="Vai agli arrivi"
          onClick={() => showSection(SECTION.arrivi)}
        />
        <MovementStatButton
          kindLabel="Partenze"
          breakdown={movementBreakdown(stats.departures)}
          title="Vai alle partenze"
          onClick={() => showSection(SECTION.partenze)}
        />
      </div>

      {stats.groups.length > 0 && (
        <div className="card inset">
          <h3 className="report-title">Gruppi in casa</h3>
          <ul className="simple-list">
            {stats.groups.map((g) => (
              <li key={`${g.name}-${g.leader}`}>
                {g.name === g.leader || isPlaceholderGroupName(g.name) ? (
                  <>
                    <strong>{g.leader}</strong> ({g.count} ospiti)
                  </>
                ) : (
                  <>
                    <strong>{g.name}</strong> — referente: {g.leader} ({g.count} ospiti)
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openSection === SECTION.intolleranze && (stats.intolerances.length > 0 || stats.intolCountTotal > 0) && (
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
          {stats.intolerances.length > 0 && (
            <ul className="simple-list">
              {stats.intolerances.map((s) => (
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

      {openSection === SECTION.pranzo && (
        <div className="card inset report-section" id={SECTION.pranzo}>
          <h3 className="report-title">Elenco pranzo</h3>
          {stats.lunch.length === 0 ? (
            <p className="muted">Nessuno a pranzo.</p>
          ) : (
            <ul className="simple-list">
              {stats.lunch.map((s) => (
                <li key={`lunch-${s.id}`}>
                  {stayDisplayName(s)} · {stayRoomsLabel(s)}
                  {stayGroupLabel(s) && ` · ${stayGroupLabel(s)}`}
                  {formatStayIntolerances(s) && ` · ${formatStayIntolerances(s)}`}
                  {formatStayMealTiming(s, day) && ` · ${formatStayMealTiming(s, day)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {openSection === SECTION.cena && (
        <div className="card inset report-section" id={SECTION.cena}>
          <h3 className="report-title">Elenco cena</h3>
          {stats.dinner.length === 0 ? (
            <p className="muted">Nessuno a cena.</p>
          ) : (
            <ul className="simple-list">
              {stats.dinner.map((s) => (
                <li key={`dinner-${s.id}`}>
                  {stayDisplayName(s)} · {stayRoomsLabel(s)}
                  {stayGroupLabel(s) && ` · ${stayGroupLabel(s)}`}
                  {formatStayIntolerances(s) && ` · ${formatStayIntolerances(s)}`}
                  {formatStayMealTiming(s, day) && ` · ${formatStayMealTiming(s, day)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {openSection === SECTION.arrivi && (
        <div className="card inset report-section" id={SECTION.arrivi}>
          <h3 className="report-title">Arrivi</h3>
          {stats.arrivals.length === 0 ? (
            <p className="muted">Nessun arrivo.</p>
          ) : (
            <ul className="guest-list">
              {stats.arrivals.map((s) => (
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
      )}

      {openSection === SECTION.partenze && (
        <div className="card inset report-section" id={SECTION.partenze}>
          <h3 className="report-title">Partenze</h3>
          {stats.departures.length === 0 ? (
            <p className="muted">Nessuna partenza.</p>
          ) : (
            <ul className="guest-list">
              {stats.departures.map((s) => (
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
      )}

      {openSection === SECTION.ospiti && (
        <div className="card inset report-section" id={SECTION.ospiti}>
          <h3 className="report-title">Tutti gli ospiti in casa</h3>
          {stats.inHouse.length === 0 ? (
            <p className="muted">Nessun ospite registrato per oggi.</p>
          ) : (
            <ul className="guest-list">
              {stats.inHouse.map((s) => (
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
      )}
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
            {isPlaceholderGroupName(stay.group.name)
              ? `referente: ${stay.group.leaderName || stay.guestName}`
              : stay.group.leaderName
                ? `${stayGroupLabel(stay)} · referente: ${stay.group.leaderName}`
                : stayGroupLabel(stay)}
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
