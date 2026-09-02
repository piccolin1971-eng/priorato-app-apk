import { useEffect, useRef, useState } from "react";
import type { GuestStay } from "../types";
import {
  BACKUP_INTERVALS,
  downloadBackupFile,
  importBackupStays,
  loadAutoBackupLocal,
  parseBackupBundle,
} from "../backup";
import { pullStations, pushStations, isSyncConfigured, loadSyncStatus } from "../stationSync";
import { formatDbChangeSummary, loadDbMeta } from "../dbMeta";
import { DEVICE_PRESETS } from "../device";
import { downloadStaysCsv } from "../exportCsv";
import { useSettings, type ThemeMode } from "../SettingsContext";
import { formatStaffEmails, parseStaffEmails } from "../staffEmails";
import { formatDateIt } from "../utils";

type Props = {
  stays: GuestStay[];
  onStaysChange: (stays: GuestStay[]) => void;
  onBack: () => void;
};

const THEMES: { id: ThemeMode; label: string; desc: string }[] = [
  { id: "light", label: "Chiaro", desc: "Bianco e grigio, leggibile in ufficio" },
  { id: "parchment", label: "Pergamena", desc: "Tono caldo, meno affaticante" },
  { id: "dark", label: "Scuro", desc: "Per ambienti poco illuminati" },
];

export function SettingsView({ stays, onStaysChange, onBack }: Props) {
  const {
    theme,
    setTheme,
    fontSize,
    parchmentShade,
    setParchmentShade,
    autoBackupEnabled,
    setAutoBackupEnabled,
    autoBackupIntervalHours,
    setAutoBackupIntervalHours,
    lastAutoBackupAt,
    syncScriptUrl,
    setSyncScriptUrl,
    syncPassword,
    setSyncPassword,
    lastStationSyncAt,
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    appLockEnabled,
    setAppLockEnabled,
    appLockPassword,
    setAppLockPassword,
    deviceName,
    setDeviceName,
    changeNotifyEnabled,
    setChangeNotifyEnabled,
    changeNotifyOnStart,
    setChangeNotifyOnStart,
    changeNotifyWhileUsing,
    setChangeNotifyWhileUsing,
    staffEmails,
    setStaffEmails,
  } = useSettings();

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [staffEmailsDraft, setStaffEmailsDraft] = useState(() => formatStaffEmails(staffEmails));

  useEffect(() => {
    setStaffEmailsDraft(formatStaffEmails(staffEmails));
  }, [staffEmails]);

  const autoBackupInfo = loadAutoBackupLocal();
  const dbMeta = loadDbMeta();

  function showStatus(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 5000);
  }

  function handleExportJson() {
    downloadBackupFile(stays);
    showStatus("Backup JSON scaricato.");
  }

  function handleExportCsv() {
    downloadStaysCsv(stays);
    showStatus("Elenco ospiti esportato in CSV.");
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      try {
        parseBackupBundle(raw);
        setPendingImport(raw);
      } catch (err) {
        showStatus(err instanceof Error ? err.message : "File non valido.");
      }
    };
    reader.readAsText(file);
  }

  function finishImport(mode: "replace" | "merge") {
    if (!pendingImport) return;
    try {
      const bundle = parseBackupBundle(pendingImport);
      const next = importBackupStays(bundle, mode);
      onStaysChange(next);
      showStatus(
        mode === "replace"
          ? `Ripristinati ${next.length} soggiorni (sostituzione completa).`
          : `Importati ${bundle.stays.length} soggiorni (unione).`,
      );
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Importazione fallita.");
    } finally {
      setPendingImport(null);
    }
  }

  async function handleSyncTest() {
    if (!isSyncConfigured(syncScriptUrl, syncPassword)) {
      showStatus("Inserisci URL dello script e password.");
      return;
    }
    setDriveBusy(true);
    const res = await pullStations(syncScriptUrl, syncPassword);
    showStatus(
      res.ok
        ? `Collegato. ${res.payload?.stays.length ?? 0} soggiorni sul file condiviso.`
        : res.message,
    );
    setDriveBusy(false);
  }

  async function handleSyncNow() {
    if (!isSyncConfigured(syncScriptUrl, syncPassword)) {
      showStatus("Inserisci URL dello script e password.");
      return;
    }
    setDriveBusy(true);
    const res = await pushStations(syncScriptUrl, syncPassword, stays, true);
    showStatus(res.ok ? "Dati di questa postazione inviati." : res.message);
    setDriveBusy(false);
  }

  return (
    <section className="panel settings-panel">
      <header className="settings-head">
        <button type="button" className="btn-back" onClick={onBack}>
          ← Indietro
        </button>
        <h2>Impostazioni</h2>
        <button
          type="button"
          className="btn ghost small settings-details-toggle"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Nascondi dettagli" : "Mostra dettagli"}
        </button>
      </header>

      {status && <p className="settings-status">{status}</p>}

      <div className="settings-section">
        <h3>Tema</h3>
        <p className="muted settings-summary">Testo attuale: {fontSize}px.</p>
        {showDetails && (
          <p className="muted settings-desc">
            Regola la dimensione con A− / A+ in alto a destra.
          </p>
        )}
        <div className="theme-row">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card theme-card-${t.id}${theme === t.id ? " active" : ""}`}
              onClick={() => setTheme(t.id)}
            >
              <span className="theme-card-swatch" aria-hidden />
              <span className="theme-card-label">{t.label}</span>
              <span className="theme-card-desc">{t.desc}</span>
            </button>
          ))}
        </div>
        {theme === "parchment" && (
          <div className="settings-subsection">
            <h4>Pergamena: chiaro/scuro</h4>
            <label>
              Intensità: {parchmentShade}%
              <input
                type="range"
                min={85}
                max={115}
                step={1}
                value={parchmentShade}
                onChange={(e) => setParchmentShade(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>

      <div className="settings-section card inset">
        <h3>Backup dati</h3>
        <p className="muted settings-summary">Esporta/importa dati e gestisci backup automatico.</p>
        {showDetails && (
          <p className="muted settings-desc">
            Salva o ripristina tutte le registrazioni. Il backup automatico tiene una copia in locale
            sul dispositivo.
          </p>
        )}
        <div className="settings-actions">
          <button type="button" className="btn primary" onClick={handleExportJson}>
            Esporta backup JSON
          </button>
          <button type="button" className="btn ghost" onClick={handleExportCsv}>
            Esporta ospiti CSV
          </button>
          <button type="button" className="btn ghost" onClick={handleImportClick}>
            Importa backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleFileSelected}
          />
        </div>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={autoBackupEnabled}
            onChange={(e) => setAutoBackupEnabled(e.target.checked)}
          />
          Backup automatico
        </label>
        {autoBackupEnabled && (
          <label>
            Frequenza
            <select
              value={autoBackupIntervalHours}
              onChange={(e) =>
                setAutoBackupIntervalHours(Number(e.target.value) as typeof autoBackupIntervalHours)
              }
            >
              {BACKUP_INTERVALS.map((opt) => (
                <option key={opt.hours} value={opt.hours}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="muted settings-meta">
          {lastAutoBackupAt
            ? `Ultimo backup automatico: ${formatDateIt(lastAutoBackupAt.slice(0, 10))} alle ${new Date(lastAutoBackupAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
            : "Nessun backup automatico ancora eseguito."}
          {autoBackupInfo && ` · Copia locale: ${autoBackupInfo.stays.length} soggiorni.`}
        </p>
      </div>

      <div className="settings-section card inset">
        <h3>Sincronizzazione postazioni</h3>
        <p className="muted settings-summary">
          Stesso URL e stessa password su PC, telefono e tablet. Il nome postazione sta più sotto.
        </p>
        {showDetails && (
          <p className="muted settings-desc">
            Lo script Google sta in apps-script/PrioratoSync.gs: incollalo su script.google.com, cambia
            la password, distribuiscilo come App web (esegui come te, accesso Chiunque) e incolla qui
            l’URL. Su Drive si crea la cartella «Priorato Accoglienza».
          </p>
        )}
        <label>
          URL script
          <input
            type="url"
            value={syncScriptUrl}
            onChange={(e) => setSyncScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Password sync
          <input
            type="password"
            value={syncPassword}
            onChange={(e) => setSyncPassword(e.target.value)}
            placeholder="la stessa scritta nello script"
            autoComplete="off"
          />
        </label>
        <p className="muted settings-meta">
          {lastStationSyncAt
            ? `Ultimo allineamento: ${formatDateIt(lastStationSyncAt.slice(0, 10))} alle ${new Date(lastStationSyncAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`
            : "Non ancora allineata."}
          {loadSyncStatus()?.ok === false ? ` · ${loadSyncStatus()?.message}` : ""}
        </p>
        <div className="settings-actions">
          <button type="button" className="btn ghost" disabled={driveBusy} onClick={handleSyncTest}>
            Prova collegamento
          </button>
          <button type="button" className="btn ghost" disabled={driveBusy} onClick={handleSyncNow}>
            Invia dati di questa postazione
          </button>
        </div>
      </div>

      <div className="settings-section card inset">
        <h3>Email dipendenti</h3>
        <p className="muted settings-summary">
          Contatti per inviare i report PDF dalla sezione Stampa (pulizie, cucina, ecc.).
        </p>
        {showDetails && (
          <p className="muted settings-desc">
            Una email per riga. Verranno proposte quando premi «Invia PDF per email».
          </p>
        )}
        <label>
          Indirizzi email
          <textarea
            rows={5}
            value={staffEmailsDraft}
            onChange={(e) => setStaffEmailsDraft(e.target.value)}
            placeholder={"pulizie@priorato.it\nmario.rossi@email.it"}
            spellCheck={false}
          />
        </label>
        <div className="settings-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const parsed = parseStaffEmails(staffEmailsDraft);
              setStaffEmails(parsed);
              setStaffEmailsDraft(formatStaffEmails(parsed));
              showStatus(
                parsed.length
                  ? `Salvati ${parsed.length} contatti dipendenti.`
                  : "Elenco email dipendenti svuotato.",
              );
            }}
          >
            Salva email
          </button>
        </div>
        {staffEmails.length > 0 && (
          <p className="muted settings-meta">{staffEmails.length} contatti salvati.</p>
        )}
      </div>

      <div className="settings-section card inset">
        <h3>Dispositivo e aggiornamenti</h3>
        <p className="muted settings-summary">Nome postazione e avvisi modifiche database.</p>
        {showDetails && (
          <p className="muted settings-desc">
            Indica come si chiama questa postazione: verrà registrata su ogni nuova prenotazione o
            modifica. L&apos;avviso di aggiornamenti funziona tra schede/finestre dello stesso
            dispositivo e dopo importazione backup da un altro PC o tablet.
          </p>
        )}
        <label>
          Nome di questo dispositivo
          <input
            list="device-name-presets"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="es. Portineria, PC Priorato, Tablet cucina"
          />
        </label>
        <datalist id="device-name-presets">
          {DEVICE_PRESETS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="settings-device-presets">
          {DEVICE_PRESETS.map((name) => (
            <button
              key={name}
              type="button"
              className={`btn ghost small${deviceName === name ? " active" : ""}`}
              onClick={() => setDeviceName(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="settings-check-row">
          <input
            type="checkbox"
            checked={changeNotifyEnabled}
            onChange={(e) => setChangeNotifyEnabled(e.target.checked)}
          />
          <span>Avvisa se ci sono modifiche al database dall&apos;ultima volta</span>
        </label>
        {changeNotifyEnabled && (
          <div className="settings-subchecks">
            <label className="settings-check">
              <input
                type="checkbox"
                checked={changeNotifyOnStart}
                onChange={(e) => setChangeNotifyOnStart(e.target.checked)}
              />
              All&apos;avvio dell&apos;app
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={changeNotifyWhileUsing}
                onChange={(e) => setChangeNotifyWhileUsing(e.target.checked)}
              />
              Mentre usi l&apos;app (quando torni alla finestra)
            </label>
          </div>
        )}
        {dbMeta.revision > 0 && dbMeta.lastModifiedAt && (
          <p className="muted settings-meta">
            Ultima attività registrata: {formatDbChangeSummary(dbMeta)}
          </p>
        )}
      </div>

      <div className="settings-section card inset">
        <h3>Sicurezza</h3>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={confirmBeforeDelete}
            onChange={(e) => setConfirmBeforeDelete(e.target.checked)}
          />
          Chiedi conferma prima di eliminare un ospite
        </label>
        <label className="settings-check-row">
          <input
            type="checkbox"
            checked={appLockEnabled}
            onChange={(e) => {
              if (e.target.checked && !appLockPassword) {
                showStatus("Scrivi la password sotto e premi «Salva password», poi riattiva.");
                return;
              }
              setAppLockEnabled(e.target.checked);
              showStatus(
                e.target.checked ? "Password richiesta all'apertura." : "Password disattivata.",
              );
            }}
          />
          <span>Richiedi password per aprire l&apos;app</span>
        </label>
        {showDetails && (
          <p className="muted settings-desc">
            1) Scrivi e salva la password · 2) Attiva la spunta sopra. Protezione leggera in locale.
          </p>
        )}
        <div className="grid two settings-password-grid">
          <div className="settings-field">
            <label htmlFor="settings-new-password">Nuova password</label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="settings-confirm-password">Conferma password</label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (newPassword.length < 4) {
                showStatus("La password deve avere almeno 4 caratteri.");
                return;
              }
              if (newPassword !== confirmPassword) {
                showStatus("Le password non coincidono.");
                return;
              }
              setAppLockPassword(newPassword);
              setNewPassword("");
              setConfirmPassword("");
              showStatus("Password salvata. Ora puoi attivare la spunta sopra.");
            }}
          >
            Salva password
          </button>
        </div>
        {appLockPassword && (
          <p className="muted settings-meta">Password impostata ({appLockPassword.length} caratteri).</p>
        )}
      </div>

      <p className="footer-note">Priorato · accoglienza · dati in locale</p>

      {pendingImport && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal confirm-dialog">
            <h3>Importa backup</h3>
            <p className="confirm-message">
              Come vuoi importare i dati? «Sostituisci» cancella i dati attuali; «Unisci» aggiunge o
              aggiorna per id.
            </p>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setPendingImport(null)}>
                Annulla
              </button>
              <button type="button" className="btn ghost" onClick={() => finishImport("merge")}>
                Unisci
              </button>
              <button type="button" className="btn danger" onClick={() => finishImport("replace")}>
                Sostituisci tutto
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
