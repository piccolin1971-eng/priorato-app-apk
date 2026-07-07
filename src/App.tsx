import { useRef, useState } from "react";
import type { GuestStay, TabId } from "./types";
import { loadStays } from "./storage";
import { RegistrationForm } from "./components/RegistrationForm";
import { TodayReport } from "./components/TodayReport";
import { RoomOverview } from "./components/RoomOverview";
import { PlanningView } from "./components/PlanningView";
import { PrintReportPanel } from "./components/PrintReportPanel";
import { FontZoomButtons } from "./components/FontZoomButtons";
import { SettingsView } from "./components/SettingsView";
import { DateInput } from "./components/DateInput";
import { todayIso } from "./utils";
import "./App.css";

const TABS: { id: TabId; label: string }[] = [
  { id: "oggi", label: "Oggi" },
  { id: "registra", label: "Registra" },
  { id: "camere", label: "Camere" },
  { id: "pianificazione", label: "Piano" },
  { id: "stampa", label: "Stampa" },
];

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13a7.7 7.7 0 0 0 .1-2l2-1.2-2-3.5-2.3 1a7.9 7.9 0 0 0-1.7-1L15 3h-4l-.5 2.3a7.9 7.9 0 0 0-1.7 1l-2.3-1-2 3.5 2 1.2a7.7 7.7 0 0 0 .1 2l-2 1.2 2 3.5 2.3-1a7.9 7.9 0 0 0 1.7 1L11 21h4l.5-2.3a7.9 7.9 0 0 0 1.7-1l2.3 1 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabId>("oggi");
  const returnTabRef = useRef<TabId>("oggi");
  const [stays, setStays] = useState<GuestStay[]>(() => loadStays());
  const [reportDay, setReportDay] = useState(todayIso());

  function openSettings() {
    if (tab !== "impostazioni") returnTabRef.current = tab;
    setTab("impostazioni");
  }

  function closeSettings() {
    setTab(returnTabRef.current);
  }

  const inSettings = tab === "impostazioni";

  return (
    <div className="app">
      <header className="topbar no-print">
        <h1 className="app-title">Priorato</h1>
        <div className="topbar-actions">
          {!inSettings && tab !== "stampa" && (
            <DateInput label="Giorno report" value={reportDay} onChange={setReportDay} />
          )}
          <div className="topbar-icon-group">
            <FontZoomButtons />
            <button
              type="button"
              className={`topbar-icon-btn topbar-settings-btn${inSettings ? " active" : ""}`}
              onClick={inSettings ? closeSettings : openSettings}
              title={inSettings ? "Chiudi impostazioni" : "Impostazioni"}
              aria-label={inSettings ? "Chiudi impostazioni" : "Impostazioni"}
            >
              <GearIcon />
            </button>
          </div>
        </div>
      </header>

      {!inSettings && (
        <nav className="tabs no-print" aria-label="Sezioni">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <main className="main">
        {inSettings && <SettingsView onBack={closeSettings} />}
        {!inSettings && tab === "oggi" && (
          <TodayReport
            stays={stays}
            day={reportDay}
            onChange={setStays}
            onOpenRooms={() => setTab("camere")}
          />
        )}
        {!inSettings && tab === "registra" && (
          <RegistrationForm stays={stays} onSaved={setStays} />
        )}
        {!inSettings && tab === "camere" && (
          <RoomOverview stays={stays} day={reportDay} />
        )}
        {!inSettings && tab === "pianificazione" && (
          <PlanningView stays={stays} day={reportDay} />
        )}
        {!inSettings && tab === "stampa" && (
          <PrintReportPanel stays={stays} defaultDate={reportDay} />
        )}
      </main>

      {!inSettings && (
        <footer className="footer no-print">
          Vecchia 13 camere · Nuova 38 camere · Dati in locale (demo)
        </footer>
      )}
    </div>
  );
}
