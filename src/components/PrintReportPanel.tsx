import { useEffect, useMemo, useRef, useState } from "react";
import type { GuestStay } from "../types";
import {
  DEFAULT_PRINT_OPTIONS,
  DEFAULT_PRINT_SCOPE,
  buildPrintReport,
  collectGroupNames,
  collectLeaderNames,
  guestContact,
  periodAnalytics,
  periodTotals,
  getPeriodDays,
  roomLabel,
  stayOverlapsPeriod,
  type PrintReportOptions,
  type PrintScope,
  type PrintScopeKind,
  type ReportPeriod,
} from "../printReport";
import { downloadSnapshotsCsv } from "../exportCsv";
import { formatStayIntolerances } from "../intolerances";
import { generateReportPdf, pdfFilename, sharePdfByEmail } from "../printPdf";
import { useSettings } from "../SettingsContext";
import { groupRoomsBySection, namesForRoom } from "../partyStay";
import { mealPersonCount, stayDisplayName, stayGroupLabel, stayRoomsLabel } from "../stayUtils";
import { dateToIso, formatDateIt, isoToDate, todayIso } from "../utils";
import { ReportProfilesSection } from "./ReportProfilesSection";

type Props = {
  stays: GuestStay[];
  defaultDate?: string;
};

type ToggleKey = keyof Omit<PrintReportOptions, "period" | "anchorDate" | "rangeDayCount">;

const TOGGLE_GROUPS: {
  title?: string;
  items: { key: ToggleKey; label: string; hint: string }[];
}[] = [
  {
    items: [
      { key: "includeSummary", label: "Riepilogo numeri", hint: "Ospiti, camere, pasti" },
      {
        key: "includeArrivals",
        label: "Arrivi",
        hint: "Camere da preparare",
      },
      {
        key: "includeDepartures",
        label: "Partenze",
        hint: "Camere da pulire",
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
      { key: "includeGroups", label: "Gruppi", hint: "Nome gruppo e referente" },
      { key: "includeContact", label: "Telefono / email", hint: "Contatti ospite e referente" },
      { key: "includeNotes", label: "Note", hint: "Note libere" },
    ],
  },
];

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "day", label: "Giorno" },
  { id: "week", label: "Settimana" },
  { id: "month", label: "Mese" },
];

function shiftAnchorDate(anchor: string, period: ReportPeriod, delta: number): string {
  const d = isoToDate(anchor) ?? new Date();
  if (period === "week") d.setDate(d.getDate() + delta * 7);
  else if (period === "month") d.setMonth(d.getMonth() + delta);
  else d.setDate(d.getDate() + delta);
  return dateToIso(d);
}

function periodNavLabel(period: ReportPeriod, anchor: string, rangeDayCount = 2): string {
  const days = getPeriodDays(period, anchor, rangeDayCount);
  if (period === "week" || period === "range") {
    return `${formatDateIt(days[0] ?? anchor)} – ${formatDateIt(days[days.length - 1] ?? anchor)}`;
  }
  const d = isoToDate(anchor);
  if (!d) return "Mese";
  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function PartyOccupantsPrint({ stays }: { stays: GuestStay[] }) {
  const groups = stays.filter((s) => (s.group?.participants ?? []).some((p) => p.name.trim()));
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map((stay) => {
        const grouped = groupRoomsBySection(stay.roomIds?.length ? stay.roomIds : [stay.roomId]);
        return (
          <section key={stay.id} className="print-section print-party-occupants">
            <h3>
              Nominativi per camera
              {stayGroupLabel(stay) ? ` — ${stayGroupLabel(stay)}` : ""}
              {stay.group?.leaderName && stayGroupLabel(stay) !== stay.group.leaderName
                ? ` · referente ${stay.group.leaderName}`
                : ""}
            </h3>
            <div className="plan-blocks party-assign-blocks print-party-blocks">
              {grouped.map(({ section, rooms }) => (
                <div key={section.id} className={`plan-block plan-block-${section.id}`}>
                  <div className="plan-block-head">
                    <h4>{section.title}</h4>
                    <span className="plan-block-range">{section.range}</span>
                    <span className="plan-block-stat">
                      {rooms.length} camer{rooms.length === 1 ? "a" : "e"}
                    </span>
                  </div>
                  <ul className="print-party-room-list">
                    {rooms.map((room) => {
                      const names = namesForRoom(stay, room.id);
                      return (
                        <li key={room.id}>
                          <strong>
                            {room.number}
                            {room.bedType === "double" ? " (doppia)" : ""}
                            {room.large ? " extra" : ""}
                          </strong>
                          <span>{names.length ? names.join(" · ") : "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
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
      {options.includeIntolerances && <td>{formatStayIntolerances(stay) || "—"}</td>}
      {options.includeGroups && (
        <td>
          {stay.group
            ? `${stay.group.name}${stay.group.leaderName ? ` · referente ${stay.group.leaderName}` : ""}`
            : "—"}
        </td>
      )}
      {options.includeContact && <td>{guestContact(stay) || "—"}</td>}
      {options.includeNotes && <td>{stay.notes.trim() || "—"}</td>}
    </tr>
  );
}

export function PrintPreviewContent({
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
          {options.includeArrivals && snap.arrivals.length > 0 && (
            <section className="print-section print-section-arrivals">
              <h3>
                Arrivi — camere da preparare
                {!singleDay && ` · ${formatDateIt(snap.day)}`}
              </h3>
              <ul className="print-bullet-list">
                {snap.arrivals.map((s) => (
                  <li key={s.id}>
                    <strong>{stayRoomsLabel(s)}</strong> · {stayDisplayName(s)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {options.includeDepartures && snap.departures.length > 0 && (
            <section className="print-section print-section-departures">
              <h3>
                Partenze — camere da pulire
                {!singleDay && ` · ${formatDateIt(snap.day)}`}
              </h3>
              <ul className="print-bullet-list">
                {snap.departures.map((s) => (
                  <li key={s.id}>
                    <strong>{stayRoomsLabel(s)}</strong> · {stayDisplayName(s)}
                  </li>
                ))}
              </ul>
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

          {(options.includeGuestList || options.includeRooms) && (
            <PartyOccupantsPrint stays={snap.inHouse} />
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
                      {s.guestName}: {formatStayIntolerances(s)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
        </div>
      ))}

      {!options.includeSummary &&
        !options.includeGuestList &&
        !options.includeArrivals &&
        !options.includeDepartures &&
        !(options.includeHistoryStats && !singleDay) && (
          <p className="print-empty">Seleziona almeno una sezione da includere nel report.</p>
        )}
    </div>
  );
}

export function PrintReportPanel({ stays, defaultDate = todayIso() }: Props) {
  const { staffEmails } = useSettings();
  const [options, setOptions] = useState<PrintReportOptions>({
    ...DEFAULT_PRINT_OPTIONS,
    anchorDate: defaultDate,
  });
  const [scope, setScope] = useState<PrintScope>(DEFAULT_PRINT_SCOPE);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOptions((o) => ({ ...o, anchorDate: defaultDate }));
  }, [defaultDate]);

  useEffect(() => {
    if (emailOpen) setSelectedEmails([...staffEmails]);
  }, [emailOpen, staffEmails]);

  const periodDays = useMemo(
    () => getPeriodDays(options.period, options.anchorDate, options.rangeDayCount),
    [options.period, options.anchorDate, options.rangeDayCount],
  );
  const periodStays = useMemo(
    () => stays.filter((s) => stayOverlapsPeriod(s, periodDays)),
    [stays, periodDays],
  );
  const groupNames = useMemo(() => collectGroupNames(periodStays), [periodStays]);
  const leaderNames = useMemo(() => collectLeaderNames(periodStays), [periodStays]);
  const report = useMemo(() => buildPrintReport(stays, options, scope), [stays, options, scope]);

  useEffect(() => {
    setScope((s) => {
      if (s.kind === "all") return s;
      const names = s.kind === "group" ? groupNames : leaderNames;
      if (!names.length) return s.value ? { ...s, value: "" } : s;
      if (names.includes(s.value)) return s;
      return { kind: s.kind, value: names[0]! };
    });
  }, [groupNames, leaderNames]);

  function setPeriod(period: ReportPeriod) {
    setOptions((o) => ({ ...o, period }));
  }

  function setScopeKind(kind: PrintScopeKind) {
    if (kind === "all") {
      setScope(DEFAULT_PRINT_SCOPE);
      return;
    }
    const names = kind === "group" ? groupNames : leaderNames;
    setScope({ kind, value: names[0] ?? "" });
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

  function openEmailDialog() {
    setPreviewOpen(true);
    setEmailStatus("");
    setEmailOpen(true);
  }

  function toggleEmailRecipient(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  async function handleSendEmail() {
    const area = printAreaRef.current;
    if (!area) {
      setEmailStatus("Apri l'anteprima e riprova.");
      return;
    }
    if (!selectedEmails.length) {
      setEmailStatus("Seleziona almeno un destinatario.");
      return;
    }

    setEmailBusy(true);
    setEmailStatus("Generazione PDF…");
    try {
      const filename = pdfFilename(report.title);
      const blob = await generateReportPdf(area, filename);
      const res = await sharePdfByEmail(
        blob,
        filename,
        selectedEmails,
        report.title,
        `Report Priorato — ${report.periodLabel}\n${report.title}`,
      );
      setEmailStatus(res.message);
      if (res.ok) window.setTimeout(() => setEmailOpen(false), 2500);
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : "Invio non riuscito.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <section className="panel print-panel">
      <header className="panel-head">
        <h2>Stampa report</h2>
        <p className="muted">Scegli periodo, filtro e contenuti, poi anteprima o stampa.</p>
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
          <p className="muted print-day-from-header">
            Data del report: <strong>{formatDateIt(options.anchorDate)}</strong> — si cambia in alto.
          </p>
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

        <fieldset className="segmented print-scope">
          <legend>Filtra per</legend>
          {(
            [
              { id: "all" as const, label: "Tutti" },
              { id: "group" as const, label: "Gruppo" },
              { id: "leader" as const, label: "Referente" },
            ] as const
          ).map((p) => (
            <label key={p.id} className={scope.kind === p.id ? "seg active" : "seg"}>
              <input
                type="radio"
                name="print-scope"
                checked={scope.kind === p.id}
                onChange={() => setScopeKind(p.id)}
              />
              {p.label}
            </label>
          ))}
        </fieldset>

        {scope.kind === "group" &&
          (groupNames.length ? (
            <label className="print-scope-pick">
              Gruppo nel periodo
              <select
                value={scope.value}
                onChange={(e) => setScope({ kind: "group", value: e.target.value })}
              >
                {groupNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted print-scope-empty">Nessun gruppo nel periodo scelto.</p>
          ))}

        {scope.kind === "leader" &&
          (leaderNames.length ? (
            <label className="print-scope-pick">
              Referente nel periodo
              <select
                value={scope.value}
                onChange={(e) => setScope({ kind: "leader", value: e.target.value })}
              >
                {leaderNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="muted print-scope-empty">Nessun referente nel periodo scelto.</p>
          ))}

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
          <button type="button" className="btn ghost" onClick={openEmailDialog}>
            Invia PDF per email…
          </button>
          <button type="button" className="btn ghost" onClick={handleCsv}>
            Esporta CSV
          </button>
        </div>

        <ReportProfilesSection />
      </div>

      {previewOpen && (
        <div className="print-preview-wrap card inset">
          <p className="muted print-preview-hint no-print">
            Anteprima — usa «Stampa…» o Ctrl+P. In stampa spariscono menu e pulsanti.
          </p>
          <div className="print-preview" id="print-area" ref={printAreaRef}>
            <PrintPreviewContent report={report} />
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => !emailBusy && setEmailOpen(false)}>
          <div
            className="modal confirm-dialog print-email-dialog"
            role="dialog"
            aria-labelledby="print-email-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="print-email-title">Invia report per email</h3>
            <p className="muted">
              Viene generato un PDF con le sezioni selezionate e inviato ai dipendenti scelti.
            </p>
            {staffEmails.length === 0 ? (
              <p className="print-email-empty">
                Nessuna email configurata. Aggiungi i contatti in <strong>Impostazioni → Email dipendenti</strong>.
              </p>
            ) : (
              <ul className="print-email-list">
                {staffEmails.map((email) => (
                  <li key={email}>
                    <label className="print-email-recipient">
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(email)}
                        disabled={emailBusy}
                        onChange={() => toggleEmailRecipient(email)}
                      />
                      {email}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {emailStatus && <p className="settings-status">{emailStatus}</p>}
            <div className="actions">
              <button
                type="button"
                className="btn ghost"
                disabled={emailBusy}
                onClick={() => setEmailOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={emailBusy || staffEmails.length === 0 || selectedEmails.length === 0}
                onClick={handleSendEmail}
              >
                {emailBusy ? "Invio…" : "Genera PDF e invia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
