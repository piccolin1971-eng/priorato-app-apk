import { useRef, useState } from "react";
import type { GuestStay } from "../types";
import {
  BACKUP_INTERVALS,
  createBackupBundle,
  downloadBackupFile,
  importBackupStays,
  loadAutoBackupLocal,
  parseBackupBundle,
} from "../backup";
import { connectGoogleDrive, syncBackupToGoogleDrive } from "../googleDrive";
import { downloadStaysCsv } from "../exportCsv";
import { useSettings, type ThemeMode } from "../SettingsContext";
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
    googleDriveClientId,
    setGoogleDriveClientId,
    googleDriveFolderId,
    setGoogleDriveFolderId,
    googleDriveConnected,
    googleDriveAccountEmail,
    confirmBeforeDelete,
    setConfirmBeforeDelete,
  } = useSettings();

  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  const autoBackupInfo = loadAutoBackupLocal();

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

  async function handleDriveConnect() {
    setDriveBusy(true);
    const res = await connectGoogleDrive({
      clientId: googleDriveClientId,
      folderId: googleDriveFolderId,
      connected: googleDriveConnected,
      accountEmail: googleDriveAccountEmail,
    });
    showStatus(res.message);
    setDriveBusy(false);
  }

  async function handleDriveSync() {
    setDriveBusy(true);
    const bundle = createBackupBundle(stays);
    const res = await syncBackupToGoogleDrive(bundle, {
      clientId: googleDriveClientId,
      folderId: googleDriveFolderId,
      connected: googleDriveConnected,
      accountEmail: googleDriveAccountEmail,
    });
    showStatus(res.message);
    setDriveBusy(false);
  }

  return (
    <section className="panel settings-panel">
      <header className="settings-head">
        <button type="button" className="btn-back" onClick={onBack}>
          ← Indietro
        </button>
        <h2>Impostazioni</h2>
      </header>

      {status && <p className="settings-status">{status}</p>}

      <div className="settings-section">
        <h3>Tema</h3>
        <p className="muted settings-desc">
          Testo attuale: {fontSize}px — regola con A− / A+ in alto a destra.
        </p>
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
        <p className="muted settings-desc">
          Salva o ripristina tutte le registrazioni. Il backup automatico tiene una copia in locale sul
          dispositivo.
        </p>
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
        <h3>Google Drive (preparazione)</h3>
        <p className="muted settings-desc">
          Inserite qui i dati del progetto Google quando sarà pronto. La sincronizzazione cloud non è
          ancora attiva, ma le impostazioni verranno riutilizzate.
        </p>
        <label>
          Client ID OAuth
          <input
            type="text"
            value={googleDriveClientId}
            onChange={(e) => setGoogleDriveClientId(e.target.value)}
            placeholder="es. 123456.apps.googleusercontent.com"
            autoComplete="off"
          />
        </label>
        <label>
          ID cartella Drive (opzionale)
          <input
            type="text"
            value={googleDriveFolderId}
            onChange={(e) => setGoogleDriveFolderId(e.target.value)}
            placeholder="ID cartella condivisa"
            autoComplete="off"
          />
        </label>
        {googleDriveConnected && googleDriveAccountEmail && (
          <p className="muted settings-meta">Account collegato: {googleDriveAccountEmail}</p>
        )}
        <div className="settings-actions">
          <button type="button" className="btn ghost" disabled={driveBusy} onClick={handleDriveConnect}>
            Collega Google
          </button>
          <button type="button" className="btn ghost" disabled={driveBusy} onClick={handleDriveSync}>
            Sincronizza ora
          </button>
        </div>
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
