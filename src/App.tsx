import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { it } from "react-day-picker/locale";
import type { GuestStay, TabId } from "./types";
import { loadStays } from "./storage";
import { RegistrationForm } from "./components/RegistrationForm";
import { TodayReport } from "./components/TodayReport";
import { RoomOverview } from "./components/RoomOverview";
import { PlanningView } from "./components/PlanningView";
import { PrintReportPanel } from "./components/PrintReportPanel";
import { FontZoomButtons } from "./components/FontZoomButtons";
import { SettingsView } from "./components/SettingsView";
import { dateToIso, formatDateIt, isoToDate, todayIso } from "./utils";
import "./App.css";

const TABS: { id: TabId; label: string }[] = [
  { id: "oggi", label: "Oggi" },
  { id: "registra", label: "Registra" },
  { id: "camere", label: "Camere" },
  { id: "pianificazione", label: "Occupazione/Disponibilità" },
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

function addDays(iso: string, delta: number): string {
  const base = isoToDate(iso) ?? new Date();
  base.setDate(base.getDate() + delta);
  return dateToIso(base);
}

function QuickReportDayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const options = useMemo(
    () => [
      { id: "oggi", label: "Oggi", iso: today },
      { id: "domani", label: "Domani", iso: addDays(today, 1) },
      { id: "dopodomani", label: "Dopodomani", iso: addDays(today, 2) },
    ],
    [today],
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="quick-report-day" ref={wrapRef}>
      <div className="quick-report-day-row">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={value === opt.iso ? "quick-day-btn active" : "quick-day-btn"}
            onClick={() => onChange(opt.iso)}
          >
            <span className="quick-day-main">{opt.label}</span>
            <span className="quick-day-date">{formatDateIt(opt.iso)}</span>
          </button>
        ))}
        <button
          type="button"
          className={`btn quick-day-cal-btn${open ? " active" : ""}`}
          title="Apri calendario"
          aria-label="Apri calendario giorno report"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          📅
        </button>
      </div>
      {open && (
        <div className="date-popover" role="dialog" aria-label="Calendario giorno report">
          <DayPicker
            mode="single"
            locale={it}
            weekStartsOn={1}
            selected={isoToDate(value)}
            onSelect={(d) => {
              if (!d) return;
              onChange(dateToIso(d));
              setOpen(false);
            }}
            defaultMonth={isoToDate(value)}
          />
        </div>
      )}
    </div>
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
            <QuickReportDayPicker value={reportDay} onChange={setReportDay} />
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
