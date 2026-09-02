import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { it } from "react-day-picker/locale";
import type { GuestStay, TabId } from "./types";
import { isSessionUnlocked } from "./appLock";
import { loadStays } from "./storage";
import { RegistrationForm } from "./components/RegistrationForm";
import { TodayReport } from "./components/TodayReport";
import { RoomOverview } from "./components/RoomOverview";
import { PlanningView } from "./components/PlanningView";
import { PrintReportPanel } from "./components/PrintReportPanel";
import { RoomStatusStrip } from "./components/RoomStatusStrip";
import { ScheduledReportDueHost } from "./components/ScheduledReportDueHost";
import { FontZoomButtons } from "./components/FontZoomButtons";
import { HomeHub, HomeIdentity } from "./components/HomeHub";
import { SettingsView } from "./components/SettingsView";
import { GuestSearchBar, SearchIcon } from "./components/GuestSearchBar";
import { GuestSearchResults } from "./components/GuestSearchResults";
import { EditStayModal } from "./components/EditStayModal";
import { AppLockScreen } from "./components/AppLockScreen";
import { DbChangeBanner } from "./components/DbChangeBanner";
import { useAutoBackup } from "./useAutoBackup";
import { useStationSync } from "./useStationSync";
import { useDbChangeNotify } from "./useDbChangeNotify";
import { useSettings } from "./SettingsContext";
import { filterStaysByQuery } from "./stayUtils";
import { dateToIso, formatDateIt, formatWeekdayIt, isoToDate, todayIso } from "./utils";
import prioratoIcon from "./assets/priorato-icon.png";
import "./App.css";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "oggi", label: "Oggi" },
  { id: "registra", label: "Registra" },
  { id: "camere", label: "Camere" },
  { id: "pianificazione", label: "Occupazione" },
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
  const options = useMemo(() => {
    const dayAfterTomorrow = addDays(today, 2);
    return [
      { id: "oggi", label: "Oggi", iso: today },
      { id: "domani", label: "Domani", iso: addDays(today, 1) },
      { id: "terzo", label: formatWeekdayIt(dayAfterTomorrow), iso: dayAfterTomorrow },
    ];
  }, [today]);

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
  const { appLockEnabled, appLockPassword } = useSettings();

  if (appLockEnabled && appLockPassword && !isSessionUnlocked()) {
    return <AppLockScreen />;
  }

  return <AppMain />;
}

function AppMain() {
  const [tab, setTab] = useState<TabId>("home");
  const returnTabRef = useRef<TabId>("home");
  const [stays, setStays] = useState<GuestStay[]>(() => loadStays());
  const [reportDay, setReportDay] = useState(todayIso());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchEditing, setSearchEditing] = useState<GuestStay | null>(null);

  useAutoBackup(stays);
  const stationSync = useStationSync({ stays, setStays });

  const reloadStays = useCallback(() => setStays(loadStays()), []);
  const dbNotify = useDbChangeNotify({ onReloadStays: reloadStays });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filterStaysByQuery(stays, searchQuery).slice(0, 20);
  }, [stays, searchQuery]);

  function openSettings() {
    if (tab !== "impostazioni") returnTabRef.current = tab;
    setTab("impostazioni");
  }

  function closeSettings() {
    setTab(returnTabRef.current);
  }

  function runSearch() {
    setSearchQuery(searchDraft.trim());
    setSearchOpen(true);
    if (tab !== "home" && tab !== "oggi" && tab !== "camere") setTab("oggi");
  }

  function clearSearch() {
    setSearchDraft("");
    setSearchQuery("");
  }

  function handleSearchSelect(stay: GuestStay) {
    setSearchEditing(stay);
    if (tab !== "home") setTab("oggi");
  }

  const inSettings = tab === "impostazioni";
  const onHome = tab === "home";

  return (
    <div className="app">
      {searchEditing && (
        <EditStayModal
          stay={searchEditing}
          stays={stays}
          onClose={() => setSearchEditing(null)}
          onSaved={(next) => {
            setStays(next);
            setSearchEditing(null);
          }}
        />
      )}

      {stationSync.notice && (
        <div className="db-change-banner no-print" role="status" aria-live="polite">
          <div className="db-change-banner-body">
            <strong>
              {stationSync.notice.kind === "conflict"
                ? "Un’altra postazione ha salvato"
                : "Dati da un’altra postazione"}
            </strong>
            <p className="db-change-banner-detail">{stationSync.notice.summary}</p>
          </div>
          <div className="db-change-banner-actions">
            {stationSync.notice.kind === "conflict" ? (
              <>
                <button type="button" className="btn primary small" onClick={stationSync.takeTheirs}>
                  Prendi i suoi
                </button>
                <button type="button" className="btn ghost small" onClick={() => void stationSync.keepMine()}>
                  Tieni i tuoi
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost small" onClick={stationSync.dismissNotice}>
                Ho visto
              </button>
            )}
          </div>
        </div>
      )}

      {dbNotify.showBanner && (
        <DbChangeBanner
          summary={dbNotify.bannerSummary}
          onAcknowledge={dbNotify.acknowledge}
          onReload={dbNotify.reloadAndAcknowledge}
        />
      )}

      <header className={`topbar no-print${onHome && !inSettings ? " topbar-home-id" : ""}`}>
        {onHome && !inSettings ? (
          <HomeIdentity />
        ) : (
          <div className="topbar-brand">
            <img className="app-logo" src={prioratoIcon} alt="" width={36} height={36} />
            {inSettings ? (
              <h1 className="app-title">Priorato</h1>
            ) : (
              <>
                <button
                  type="button"
                  className="app-title app-title-home"
                  onClick={() => setTab("home")}
                  title="Torna alla home"
                >
                  Priorato
                </button>
                <RoomStatusStrip stays={stays} day={reportDay} />
              </>
            )}
          </div>
        )}
        <div className="topbar-actions">
          {!inSettings && !onHome && (
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
        <>
          {!onHome && (
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
              <button
                type="button"
                className={`tab tab-search${searchOpen ? " active" : ""}`}
                onClick={() => setSearchOpen((open) => !open)}
                title="Mostra o nascondi ricerca"
                aria-label="Ricerca ospiti"
                aria-expanded={searchOpen}
              >
                <SearchIcon />
              </button>
            </nav>
          )}
          {searchOpen && (
            <div className="tab-search-panel no-print">
              <GuestSearchBar
                value={searchQuery}
                draft={searchDraft}
                onDraftChange={setSearchDraft}
                onSearch={runSearch}
                onClear={clearSearch}
                autoFocus
              />
              {searchQuery && (
                <div className="search-results-panel">
                  <p className="muted small-hint">
                    {searchResults.length} risultat{searchResults.length === 1 ? "o" : "i"} — clicca
                    per modificare
                  </p>
                  <GuestSearchResults results={searchResults} onSelect={handleSearchSelect} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <main className="main">
        {inSettings && (
          <SettingsView stays={stays} onStaysChange={setStays} onBack={closeSettings} />
        )}
        {!inSettings && onHome && (
          <HomeHub
            stays={stays}
            day={reportDay}
            dayPicker={<QuickReportDayPicker value={reportDay} onChange={setReportDay} />}
            searchQuery={searchQuery}
            onChange={setStays}
            onOpenTab={setTab}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenSettings={openSettings}
          />
        )}
        {!inSettings && tab === "oggi" && (
          <TodayReport
            stays={stays}
            day={reportDay}
            searchQuery={searchQuery}
            onChange={setStays}
            onOpenRooms={() => setTab("camere")}
          />
        )}
        {!inSettings && tab === "registra" && (
          <RegistrationForm stays={stays} onSaved={setStays} />
        )}
        {!inSettings && tab === "camere" && (
          <RoomOverview
            stays={stays}
            day={reportDay}
            searchQuery={searchQuery}
            onEditStay={setSearchEditing}
          />
        )}
        {!inSettings && tab === "pianificazione" && (
          <PlanningView stays={stays} day={reportDay} onEditStay={setSearchEditing} />
        )}
        {!inSettings && tab === "stampa" && (
          <PrintReportPanel stays={stays} defaultDate={reportDay} />
        )}
      </main>

      <ScheduledReportDueHost stays={stays} />

      {!inSettings && !onHome && (
        <footer className="footer no-print">
          Parte vecchia 13 camere · Parte nuova 38 camere · Dati in locale (demo)
        </footer>
      )}
    </div>
  );
}
