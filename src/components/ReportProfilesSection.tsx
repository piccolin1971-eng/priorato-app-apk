import { useMemo, useState } from "react";
import { formatStaffEmails, parseStaffEmails } from "../staffEmails";
import {
  createEmptyProfile,
  describeProfilePeriod,
  formatTimes,
  parseTimesInput,
  validateProfile,
  type ProfilePeriodKind,
  type ReportContentFlags,
  type ReportSendProfile,
} from "../reportProfiles";
import { useSettings } from "../SettingsContext";

const CONTENT_TOGGLES: { key: keyof ReportContentFlags; label: string }[] = [
  { key: "includeSummary", label: "Riepilogo numeri" },
  { key: "includeArrivals", label: "Arrivi" },
  { key: "includeDepartures", label: "Partenze" },
  { key: "includeGuestList", label: "Nomi ospiti" },
  { key: "includeRooms", label: "Camere" },
  { key: "includeMeals", label: "Pranzo e cena" },
  { key: "includeIntolerances", label: "Intolleranze" },
  { key: "includeGroups", label: "Gruppi" },
  { key: "includeContact", label: "Telefono / email" },
  { key: "includeNotes", label: "Note" },
  { key: "includeHistoryStats", label: "Statistiche periodo" },
];

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Gio" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sab" },
  { id: 7, label: "Dom" },
];

const OFFSET_OPTIONS = [
  { value: 0, label: "Oggi" },
  { value: 1, label: "Domani" },
  { value: 2, label: "Tra 2 giorni" },
  { value: 3, label: "Tra 3 giorni" },
];

function presetPulizie(): ReportSendProfile {
  return createEmptyProfile({
    name: "Pulizie",
    times: ["18:00"],
    periodKind: "day",
    startOffsetDays: 1,
    content: {
      includeSummary: true,
      includeGuestList: false,
      includeContact: false,
      includeRooms: true,
      includeMeals: false,
      includeIntolerances: false,
      includeGroups: false,
      includeArrivals: true,
      includeDepartures: true,
      includeNotes: false,
      includeHistoryStats: false,
    },
  });
}

function presetCucina(): ReportSendProfile {
  return createEmptyProfile({
    name: "Cucina",
    times: ["18:00"],
    periodKind: "day",
    startOffsetDays: 0,
    content: {
      includeSummary: true,
      includeGuestList: true,
      includeContact: false,
      includeRooms: false,
      includeMeals: true,
      includeIntolerances: true,
      includeGroups: false,
      includeArrivals: false,
      includeDepartures: false,
      includeNotes: false,
      includeHistoryStats: false,
    },
  });
}

export function ReportProfilesSection() {
  const { staffEmails, reportProfiles, setReportProfiles } = useSettings();
  const [editing, setEditing] = useState<ReportSendProfile | null>(null);
  const [emailsDraft, setEmailsDraft] = useState("");
  const [timesDraft, setTimesDraft] = useState("18:00");
  const [formError, setFormError] = useState("");

  const sorted = useMemo(
    () => [...reportProfiles].sort((a, b) => a.name.localeCompare(b.name, "it")),
    [reportProfiles],
  );

  function openCreate(preset?: ReportSendProfile) {
    const base = preset ?? createEmptyProfile();
    const p: ReportSendProfile = {
      ...base,
      emails: base.emails.length ? base.emails : [...staffEmails],
    };
    setEditing(p);
    setEmailsDraft(formatStaffEmails(p.emails));
    setTimesDraft(formatTimes(p.times));
    setFormError("");
  }

  function openEdit(p: ReportSendProfile) {
    setEditing({ ...p, content: { ...p.content }, emails: [...p.emails], times: [...p.times], weekdays: [...p.weekdays] });
    setEmailsDraft(formatStaffEmails(p.emails));
    setTimesDraft(formatTimes(p.times));
    setFormError("");
  }

  function closeEdit() {
    setEditing(null);
    setFormError("");
  }

  function saveEdit() {
    if (!editing) return;
    const next: ReportSendProfile = {
      ...editing,
      name: editing.name.trim(),
      emails: parseStaffEmails(emailsDraft),
      times: parseTimesInput(timesDraft),
    };
    const err = validateProfile(next);
    if (err) {
      setFormError(err);
      return;
    }
    const exists = reportProfiles.some((p) => p.id === next.id);
    setReportProfiles(
      exists ? reportProfiles.map((p) => (p.id === next.id ? next : p)) : [...reportProfiles, next],
    );
    closeEdit();
  }

  function removeProfile(id: string) {
    if (!window.confirm("Eliminare questo profilo di invio?")) return;
    setReportProfiles(reportProfiles.filter((p) => p.id !== id));
    if (editing?.id === id) closeEdit();
  }

  function toggleEnabled(id: string) {
    setReportProfiles(
      reportProfiles.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  }

  function setPeriodKind(kind: ProfilePeriodKind) {
    if (!editing) return;
    setEditing({
      ...editing,
      periodKind: kind,
      dayCount: kind === "days" ? Math.max(2, editing.dayCount || 2) : editing.dayCount,
      content: {
        ...editing.content,
        includeHistoryStats:
          kind === "week" || kind === "days" ? editing.content.includeHistoryStats : false,
      },
    });
  }

  function toggleWeekday(id: number) {
    if (!editing) return;
    const has = editing.weekdays.includes(id);
    setEditing({
      ...editing,
      weekdays: has ? editing.weekdays.filter((d) => d !== id) : [...editing.weekdays, id].sort(),
    });
  }

  function toggleContent(key: keyof ReportContentFlags) {
    if (!editing) return;
    setEditing({
      ...editing,
      content: { ...editing.content, [key]: !editing.content[key] },
    });
  }

  return (
    <div className="card inset report-profiles-section">
      <div className="report-profiles-head">
        <h3>Invii automatici</h3>
        <p className="muted">
          Profili con orari e contenuti dedicati. Con l&apos;app aperta, all&apos;orario viene chiesto
          di generare il PDF e inviarlo (invio Gmail autonomo in una fase successiva).
        </p>
      </div>

      {sorted.length === 0 && !editing && (
        <p className="muted report-profiles-empty">Nessun profilo. Crea «Pulizie» o «Cucina» per iniziare.</p>
      )}

      {sorted.length > 0 && (
        <ul className="report-profile-list">
          {sorted.map((p) => (
            <li key={p.id} className={`report-profile-row${p.enabled ? "" : " off"}`}>
              <label className="report-profile-enable">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => toggleEnabled(p.id)}
                  aria-label={`Attiva ${p.name}`}
                />
              </label>
              <div className="report-profile-main">
                <strong>{p.name}</strong>
                <span className="muted">
                  {formatTimes(p.times)} · {describeProfilePeriod(p)} · {p.emails.length} email
                </span>
              </div>
              <div className="report-profile-actions">
                <button type="button" className="btn ghost" onClick={() => openEdit(p)}>
                  Modifica
                </button>
                <button type="button" className="btn ghost" onClick={() => removeProfile(p.id)}>
                  Elimina
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!editing && (
        <div className="actions report-profiles-create">
          <button type="button" className="btn ghost" onClick={() => openCreate(presetPulizie())}>
            + Pulizie
          </button>
          <button type="button" className="btn ghost" onClick={() => openCreate(presetCucina())}>
            + Cucina
          </button>
          <button type="button" className="btn primary" onClick={() => openCreate()}>
            Nuovo profilo…
          </button>
        </div>
      )}

      {editing && (
        <div className="report-profile-editor">
          <h4>{reportProfiles.some((p) => p.id === editing.id) ? "Modifica profilo" : "Nuovo profilo"}</h4>

          <label className="settings-field">
            Nome
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="es. Pulizie"
            />
          </label>

          <label className="settings-field">
            Destinatari (una email per riga)
            <textarea
              rows={3}
              value={emailsDraft}
              onChange={(e) => setEmailsDraft(e.target.value)}
              placeholder={staffEmails[0] ?? "pulizie@esempio.it"}
            />
          </label>

          <label className="settings-field">
            Orari (più orari: 10:00, 18:00)
            <input
              type="text"
              value={timesDraft}
              onChange={(e) => setTimesDraft(e.target.value)}
              placeholder="18:00"
            />
          </label>

          <fieldset className="report-profile-weekdays">
            <legend>Giorni</legend>
            <p className="muted small-hint">Nessuna selezione = tutti i giorni</p>
            <div className="report-weekday-grid">
              {WEEKDAYS.map((d) => (
                <label key={d.id} className="report-weekday">
                  <input
                    type="checkbox"
                    checked={editing.weekdays.includes(d.id)}
                    onChange={() => toggleWeekday(d.id)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="segmented report-period-kind">
            <legend>Periodo report</legend>
            {(
              [
                { id: "day" as const, label: "Un giorno" },
                { id: "days" as const, label: "Più giorni" },
                { id: "week" as const, label: "Settimana" },
              ] as const
            ).map((p) => (
              <label key={p.id} className={editing.periodKind === p.id ? "seg active" : "seg"}>
                <input
                  type="radio"
                  name={`profile-period-${editing.id}`}
                  checked={editing.periodKind === p.id}
                  onChange={() => setPeriodKind(p.id)}
                />
                {p.label}
              </label>
            ))}
          </fieldset>

          <label className="settings-field">
            Inizio dal
            <select
              value={editing.startOffsetDays}
              onChange={(e) =>
                setEditing({ ...editing, startOffsetDays: Number(e.target.value) })
              }
            >
              {OFFSET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {editing.periodKind === "days" && (
            <label className="settings-field">
              Numero di giorni
              <input
                type="number"
                min={2}
                max={14}
                value={editing.dayCount}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    dayCount: Math.max(2, Math.min(14, Number(e.target.value) || 2)),
                  })
                }
              />
            </label>
          )}

          <p className="muted small-hint">Anteprima periodo: {describeProfilePeriod(editing)}</p>

          <div className="print-toggles">
            <h4 className="print-toggle-group-title">Contenuti del PDF</h4>
            <div className="print-toggle-grid">
              {CONTENT_TOGGLES.map((t) => (
                <label key={t.key} className="print-toggle">
                  <input
                    type="checkbox"
                    checked={!!editing.content[t.key]}
                    disabled={
                      t.key === "includeHistoryStats" && editing.periodKind === "day"
                    }
                    onChange={() => toggleContent(t.key)}
                  />
                  <span className="print-toggle-label">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {formError && <p className="settings-status warn">{formError}</p>}

          <div className="actions">
            <button type="button" className="btn ghost" onClick={closeEdit}>
              Annulla
            </button>
            <button type="button" className="btn primary" onClick={saveEdit}>
              Salva profilo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
