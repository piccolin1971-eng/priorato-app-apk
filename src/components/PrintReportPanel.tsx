import { useEffect, useMemo, useState } from "react";
import type { GuestStay } from "../types";
import {
  DEFAULT_PRINT_OPTIONS,
  buildPrintReport,
  guestContact,
  periodTotals,
  roomLabel,
  type PrintReportOptions,
  type ReportPeriod,
} from "../printReport";
import { mealPersonCount, stayDisplayName, stayRoomsLabel } from "../stayUtils";
import { formatDateIt, todayIso } from "../utils";
import { DateInput } from "./DateInput";

type Props = {
  stays: GuestStay[];
  defaultDate?: string;
};

type ToggleKey = keyof Omit<PrintReportOptions, "period" | "anchorDate">;

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "includeSummary", label: "Riepilogo numeri", hint: "Ospiti, camere, pasti" },
  { key: "includeGuestList", label: "Nomi ospiti", hint: "Elenco nominativo" },
  { key: "includeContact", label: "Telefono / email", hint: "Contatti ospite e capo gruppo" },
  { key: "includeRooms", label: "Camere", hint: "Numero camera per ospite" },
  { key: "includeMeals", label: "Pranzo e cena", hint: "Presenza ai pasti" },
  { key: "includeIntolerances", label: "Intolleranze", hint: "Allergie e diete" },
  { key: "includeGroups", label: "Gruppi", hint: "Nome gruppo e capo" },
  { key: "includeArrivalsDepartures", label: "Arrivi e partenze", hint: "Movimenti del giorno" },
  { key: "includeNotes", label: "Note", hint: "Note libere" },
];

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "day", label: "Giorno" },
  { id: "week", label: "Settimana" },
  { id: "month", label: "Mese" },
];

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
        !options.includeArrivalsDepartures && (
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

  useEffect(() => {
    setOptions((o) => ({ ...o, anchorDate: defaultDate }));
  }, [defaultDate]);

  const report = useMemo(() => buildPrintReport(stays, options), [stays, options]);

  function setPeriod(period: ReportPeriod) {
    setOptions((o) => ({ ...o, period }));
  }

  function toggle(key: ToggleKey) {
    setOptions((o) => ({ ...o, [key]: !o[key] }));
  }

  function handlePrint() {
    setPreviewOpen(true);
    window.setTimeout(() => window.print(), 200);
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

        <DateInput
          label={options.period === "day" ? "Giorno" : "Data di riferimento"}
          value={options.anchorDate}
          onChange={(anchorDate) => setOptions((o) => ({ ...o, anchorDate }))}
        />

        <div className="print-toggles card inset">
          <h3>Contenuti</h3>
          <div className="print-toggle-grid">
            {TOGGLES.map((t) => (
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
