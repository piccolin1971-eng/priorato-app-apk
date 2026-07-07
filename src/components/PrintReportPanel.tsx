import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { it } from "react-day-picker/locale";
import type { GuestStay } from "../types";
import {
  DEFAULT_PRINT_OPTIONS,
  buildPrintReport,
  guestContact,
  periodAnalytics,
  periodTotals,
  getPeriodDays,
  roomLabel,
  type PrintReportOptions,
  type ReportPeriod,
} from "../printReport";
import { downloadSnapshotsCsv } from "../exportCsv";
import { mealPersonCount, stayDisplayName, stayRoomsLabel } from "../stayUtils";
import { dateToIso, formatDateIt, formatWeekdayIt, isoToDate, todayIso } from "../utils";

type Props = {
  stays: GuestStay[];
  defaultDate?: string;
};

type ToggleKey = keyof Omit<PrintReportOptions, "period" | "anchorDate">;

const TOGGLE_GROUPS: {
  title?: string;
  items: { key: ToggleKey; label: string; hint: string }[];
}[] = [
  {
    items: [
      { key: "includeSummary", label: "Riepilogo numeri", hint: "Ospiti, camere, pasti" },
      {
        key: "includeArrivalsDepartures",
        label: "Arrivi e partenze",
        hint: "Movimenti del giorno",
      },
    ],
  },
  {
    title: "Elenco ospiti",
    items: [
      { key: "includeGuestList", label: "Nomi ospiti", hint: "Elenco nominativo" },
      { key: "includeRooms", label: "Camere", hint: "Numero camera per ospite" },
      { key: "includeMeals", label: "Pranzo e cena", hint: "Presenza ai pasti" },
      { key: "includeIntolerances", label: "Intolleranze", hint: "Allergie e diete" },
      { key: "includeGroups", label: "Gruppi", hint: "Nome gruppo e capo" },
      { key: "includeContact", label: "Telefono / email", hint: "Contatti ospite e capo gruppo" },
      { key: "includeNotes", label: "Note", hint: "Note libere" },
    ],
  },
];

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "day", label: "Giorno" },
  { id: "week", label: "Settimana" },
  { id: "month", label: "Mese" },
];

function addDays(iso: string, delta: number): string {
  const d = isoToDate(iso) ?? new Date();
  d.setDate(d.getDate() + delta);
  return dateToIso(d);
}

function shiftAnchorDate(anchor: string, period: ReportPeriod, delta: number): string {
  const d = isoToDate(anchor) ?? new Date();
  if (period === "week") d.setDate(d.getDate() + delta * 7);
  else if (period === "month") d.setMonth(d.getMonth() + delta);
  else d.setDate(d.getDate() + delta);
  return dateToIso(d);
}

function periodNavLabel(period: ReportPeriod, anchor: string): string {
  const days = getPeriodDays(period, anchor);
  if (period === "week") {
    return `Settimana ${formatDateIt(days[0] ?? anchor)} – ${formatDateIt(days[days.length - 1] ?? anchor)}`;
  }
  const d = isoToDate(anchor);
  if (!d) return "Mese";
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function GuestPrintRow({
  stay,
  options,
}: {
  stay: GuestStay;
  options: PrintReportOptions;
}) {
  return (
    <tr>
      <td>{stayDisplayName(stay)}</td>
      {options.includeRooms && <td>{stayRoomsLabel(stay)}</td>}
      {options.includeMeals && (
        <td>
          {stay.lunch && `Pranzo (${mealPersonCount(stay, "lunch")}) `}
          {stay.dinner && `Cena (${mealPersonCount(stay, "dinner")})`}
          {!stay.lunch && !stay.dinner && "—"}
        </td>
      )}
      {options.includeIntolerances && <td>{stay.intolerances.trim() || "—"}</td>}
      {options.includeGroups && (
        <td>{stay.group ? `${stay.group.name} · ${stay.group.leaderName}` : "—"}</td>
      )}
      {options.includeContact && <td>{guestContact(stay) || "—"}</td>}
      {options.includeNotes && <td>{stay.notes.trim() || "—"}</td>}
    </tr>
  );
}

function PrintPreviewContent({
  report,
}: {
  report: ReturnType<typeof buildPrintReport>;
}) {
  const { options, snapshots, title, periodLabel } = report;
  const totals = periodTotals(snapshots);
  const analytics = periodAnalytics(snapshots);
  const showGuestTable = options.includeGuestList;
  const singleDay = options.period === "day";

  return (
    <div className="print-doc-inner">
      <header className="print-doc-head">
        <h1>Priorato — Accoglienza</h1>
        <h2>{title}</h2>
        <p className="print-doc-meta">
          {periodLabel} · generato il {formatDateIt(todayIso())} alle{" "}
          {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      {options.includeSummary && (
        <section className="print-section">
          <h3>Riepilogo</h3>
          {singleDay && snapshots[0] && (
            <ul className="print-summary-list">
              <li>
                Ospiti in casa: <strong>{snapshots[0].peopleInHouse}</strong>
              </li>
              <li>
                Camere occupate: <strong>{snapshots[0].occupancy}</strong> / {totals.totalRooms}
              </li>
              <li>
                A pranzo: <strong>{snapshots[0].lunchPeople}</strong>
              </li>
              <li>
                A cena: <strong>{snapshots[0].dinnerPeople}</strong>
              </li>
              <li>
                Intolleranze segnalate: <strong>{snapshots[0].intolerances.length}</strong>
              </li>
            </ul>
          )}
          {!singleDay && (
            <>
              <p>
                Picco camere occupate: <strong>{totals.maxOccupied}</strong> · Arrivi nel periodo:{" "}
                <strong>{totals.totalArrivals}</strong> · Partenze:{" "}
                <strong>{totals.totalDepartures}</strong>
              </p>
              <table className="print-table print-table-compact">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ospiti</th>
                    <th>Camere</th>
                    <th>Pranzo</th>
                    <th>Cena</th>
                    <th>Intoll.</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.day}>
                      <td>{formatDateIt(s.day)}</td>
                      <td>{s.peopleInHouse}</td>
                      <td>
                        {s.occupancy}/{totals.totalRooms}
                      </td>
                      <td>{s.lunchPeople}</td>
                      <td>{s.dinnerPeople}</td>
                      <td>{s.intolerances.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {!singleDay && options.includeHistoryStats && (
        <section className="print-section print-history-section">
          <h3>Analisi del periodo</h3>
          <p className="print-history-intro">
            Sintesi su {snapshots.length} giorni — medie giornaliere e picchi di occupazione.
          </p>
          <table className="print-table print-table-compact print-history-table">
            <tbody>
              <tr>
                <th scope="row">Media camere occupate</th>
                <td>
                  <strong>{analytics.avgOccupancy}</strong> su {totals.totalRooms}
                </td>
              </tr>
              <tr>
                <th scope="row">Media ospiti in casa</th>
                <td>
                  <strong>{analytics.avgPeople}</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">Media a pranzo</th>
                <td>
                  <strong>{analytics.avgLunch}</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">Media a cena</th>
                <td>
                  <strong>{analytics.avgDinner}</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">Presenze-persona (notti)</th>
                <td>
                  <strong>{analytics.totalPersonNights}</strong>
                </td>
              </tr>
              {analytics.busiestDay && (
                <tr>
                  <th scope="row">Giorno più pieno</th>
                  <td>
                    <strong>{formatDateIt(analytics.busiestDay.day)}</strong> —{" "}
                    {analytics.busiestDay.occupancy} camere
                  </td>
                </tr>
              )}
              {analytics.quietestDay && (
                <tr>
                  <th scope="row">Giorno più libero</th>
                  <td>
                    <strong>{formatDateIt(analytics.quietestDay.day)}</strong> —{" "}
                    {analytics.quietestDay.occupancy} camere
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {snapshots.map((snap) => (
        <div key={snap.day}>
          {options.includeArrivalsDepartures &&
            (snap.arrivals.length > 0 || snap.departures.length > 0) && (
              <section className="print-section">
                <h3>
                  Arrivi e partenze
                  {!singleDay && ` — ${formatDateIt(snap.day)}`}
                </h3>
                {snap.arrivals.length > 0 && (
                  <>
                    <h4>Arrivi</h4>
                    <ul className="print-bullet-list">
                      {snap.arrivals.map((s) => (
                        <li key={s.id}>
                          {stayDisplayName(s)}
                          {options.includeRooms && ` · ${stayRoomsLabel(s)}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {snap.departures.length > 0 && (
                  <>
                    <h4>Partenze</h4>
                    <ul className="print-bullet-list">
                      {snap.departures.map((s) => (
                        <li key={s.id}>
                          {stayDisplayName(s)}
                          {options.includeRooms && ` · ${stayRoomsLabel(s)}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

          {showGuestTable && snap.inHouse.length > 0 && (
            <section className="print-section">
              <h3>
                Ospiti in casa
                {!singleDay && ` — ${formatDateIt(snap.day)}`}
                {singleDay && ` (${snap.peopleInHouse})`}
              </h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    {options.includeRooms && <th>Camera</th>}
                    {options.includeMeals && <th>Pasti</th>}
                    {options.includeIntolerances && <th>Intolleranze</th>}
                    {options.includeGroups && <th>Gruppo</th>}
                    {options.includeContact && <th>Contatti</th>}
                    {options.includeNotes && <th>Note</th>}
                  </tr>
                </thead>
                <tbody>
                  {snap.inHouse
                    .slice()
                    .sort((a, b) => roomLabel(a.roomId).localeCompare(roomLabel(b.roomId)))
                    .map((s) => (
                      <GuestPrintRow key={s.id} stay={s} options={options} />
                    ))}
                </tbody>
              </table>
            </section>
          )}

          {options.includeIntolerances &&
            !options.includeGuestList &&
            snap.intolerances.length > 0 && (
              <section className="print-section">
                <h3>
                  Intolleranze
                  {!singleDay && ` — ${formatDateIt(snap.day)}`}
                </h3>
                <ul className="print-bullet-list">
                  {snap.intolerances.map((s) => (
                    <li key={s.id}>
                      {s.guestName}: {s.intolerances}
                    </li>
                  ))}
                </ul>
              </section>
            )}
        </div>
      ))}

      {!options.includeSummary &&
        !options.includeGuestList &&
        !options.includeArrivalsDepartures &&
        !(options.includeHistoryStats && !singleDay) && (
          <p className="print-empty">Seleziona almeno una sezione da includere nel report.</p>
        )}
    </div>
  );
}

export function PrintReportPanel({ stays, defaultDate = todayIso() }: Props) {
  const [options, setOptions] = useState<PrintReportOptions>({
    ...DEFAULT_PRINT_OPTIONS,
    anchorDate: defaultDate,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    setOptions((o) => ({ ...o, anchorDate: defaultDate }));
  }, [defaultDate]);

  const report = useMemo(() => buildPrintReport(stays, options), [stays, options]);
  const quickDates = useMemo(() => {
    const dayAfterTomorrow = addDays(todayIso(), 2);
    return [
      { id: "oggi", label: "Oggi", iso: todayIso() },
      { id: "domani", label: "Domani", iso: addDays(todayIso(), 1) },
      { id: "terzo", label: formatWeekdayIt(dayAfterTomorrow), iso: dayAfterTomorrow },
    ];
  }, []);

  function setPeriod(period: ReportPeriod) {
    setOptions((o) => ({ ...o, period }));
    if (period !== "day") setDateOpen(false);
  }

  function toggle(key: ToggleKey) {
    setOptions((o) => ({ ...o, [key]: !o[key] }));
  }

  function handlePrint() {
    setPreviewOpen(true);
    window.setTimeout(() => window.print(), 200);
  }
  function handlePdf() {
    setPreviewOpen(true);
    window.setTimeout(() => window.print(), 200);
  }

  function handleCsv() {
    downloadSnapshotsCsv(report.snapshots, `priorato-report-${options.period}.csv`);
  }

  return (
    <section className="panel print-panel">
      <header className="panel-head">
        <h2>Stampa report</h2>
        <p className="muted">Scegli periodo e contenuti, poi anteprima o stampa.</p>
      </header>

      <div className="print-config no-print">
        <fieldset className="segmented">
          <legend>Periodo</legend>
          {PERIODS.map((p) => (
            <label key={p.id} className={options.period === p.id ? "seg active" : "seg"}>
              <input
                type="radio"
                name="print-period"
                checked={options.period === p.id}
                onChange={() => setPeriod(p.id)}
              />
              {p.label}
            </label>
          ))}
        </fieldset>

        {options.period === "day" && (
          <div className="quick-report-day">
            <div className="quick-report-day-row">
              {quickDates.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={options.anchorDate === d.iso ? "quick-day-btn active" : "quick-day-btn"}
                  onClick={() => setOptions((o) => ({ ...o, anchorDate: d.iso }))}
                >
                  <span className="quick-day-main">{d.label}</span>
                  <span className="quick-day-date">{formatDateIt(d.iso)}</span>
                </button>
              ))}
              <button
                type="button"
                className={`btn quick-day-cal-btn${dateOpen ? " active" : ""}`}
                onClick={() => setDateOpen((v) => !v)}
                aria-label="Apri calendario report"
              >
                📅
              </button>
            </div>
            {dateOpen && (
              <div className="date-popover" role="dialog" aria-label="Calendario report">
                <DayPicker
                  mode="single"
                  locale={it}
                  weekStartsOn={1}
                  selected={isoToDate(options.anchorDate)}
                  onSelect={(d) => {
                    if (!d) return;
                    setOptions((o) => ({ ...o, anchorDate: dateToIso(d) }));
                    setDateOpen(false);
                  }}
                  defaultMonth={isoToDate(options.anchorDate)}
                />
              </div>
            )}
          </div>
        )}

        {options.period !== "day" && (
          <div className="print-period-nav">
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                setOptions((o) => ({
                  ...o,
                  anchorDate: shiftAnchorDate(o.anchorDate, o.period, -1),
                }))
              }
              aria-label="Periodo precedente"
            >
              ←
            </button>
            <span className="print-period-label">{periodNavLabel(options.period, options.anchorDate)}</span>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                setOptions((o) => ({
                  ...o,
                  anchorDate: shiftAnchorDate(o.anchorDate, o.period, 1),
                }))
              }
              aria-label="Periodo successivo"
            >
              →
            </button>
          </div>
        )}

        <div className="print-toggles card inset">
          <h3>Contenuti</h3>
          <div className="print-toggle-groups">
            {TOGGLE_GROUPS.map((group, groupIndex) => (
              <div key={groupIndex} className="print-toggle-group">
                {group.title && <h4 className="print-toggle-group-title">{group.title}</h4>}
                <div className="print-toggle-grid">
                  {group.items.map((t) => (
                    <label key={t.key} className="print-toggle" title={t.hint}>
                      <input
                        type="checkbox"
                        checked={options[t.key]}
                        onChange={() => toggle(t.key)}
                      />
                      <span className="print-toggle-label">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`print-history-option card inset${options.period === "day" ? " print-history-option-disabled" : ""}`}
        >
          <label className="print-history-toggle">
            <input
              type="checkbox"
              checked={options.includeHistoryStats}
              disabled={options.period === "day"}
              onChange={() => toggle("includeHistoryStats")}
            />
            <span className="print-history-copy">
              <strong>Statistiche del periodo</strong>
              <span className="muted">
                {options.period === "day"
                  ? "Disponibile con periodo Settimana o Mese: medie giornaliere e giorni più pieni/liberi."
                  : "Sezione separata con medie giornaliere e giorni più pieni/liberi."}
              </span>
            </span>
          </label>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => setPreviewOpen((v) => !v)}
          >
            {previewOpen ? "Nascondi anteprima" : "Anteprima di stampa"}
          </button>
          <button type="button" className="btn ghost" onClick={handlePrint}>
            Stampa…
          </button>
          <button type="button" className="btn ghost" onClick={handlePdf}>
            Crea PDF…
          </button>
          <button type="button" className="btn ghost" onClick={handleCsv}>
            Esporta CSV
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="print-preview-wrap card inset">
          <p className="muted print-preview-hint no-print">
            Anteprima — usa «Stampa…» o Ctrl+P. In stampa spariscono menu e pulsanti.
          </p>
          <div className="print-preview" id="print-area">
            <PrintPreviewContent report={report} />
          </div>
        </div>
      )}
    </section>
  );
}
