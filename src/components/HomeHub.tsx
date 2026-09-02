import type { ReactNode } from "react";
import type { GuestStay, TabId } from "../types";
import { getDeviceName } from "../device";
import { useSettings } from "../SettingsContext";
import { formatDateIt } from "../utils";
import { TodayReport } from "./TodayReport";
import prioratoIcon from "../assets/priorato-icon.png";

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.2 3.5h3.1l1.2 3.7-1.9 1.1a12.4 12.4 0 0 0 5.1 5.1l1.1-1.9 3.7 1.2v3.1c0 .9-.8 1.7-1.7 1.7C9.6 17.5 6.5 14.4 6.5 5.2c0-.9.8-1.7 1.7-1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7.2 12 13l8-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  stays: GuestStay[];
  day: string;
  dayPicker: ReactNode;
  searchQuery?: string;
  onChange: (stays: GuestStay[]) => void;
  onOpenTab: (tab: TabId) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
};

function formatAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h fa`;
  return formatDateIt(iso.slice(0, 10));
}

export function DriveSyncBadge() {
  const { syncScriptUrl, syncPassword, deviceName, lastStationSyncAt } = useSettings();
  const postazione = deviceName.trim() || getDeviceName();
  const ago = lastStationSyncAt ? formatAgo(lastStationSyncAt) : "";
  const configured = syncScriptUrl.trim().startsWith("http") && syncPassword.trim().length > 0;

  let label = "Solo su questo dispositivo";
  let state: "on" | "wait" | "off" = "off";
  if (configured && lastStationSyncAt) {
    label = postazione;
    state = "on";
  } else if (configured) {
    label = "Sync da collegare";
    state = "wait";
  }

  return (
    <span className={`home-sync home-sync-${state}`} title={label}>
      <span className="home-sync-dot" aria-hidden />
      <span className="home-sync-text">
        {label}
        {ago && state === "on" ? <span className="home-sync-ago">agg. {ago}</span> : null}
      </span>
    </span>
  );
}

export function HomeIdentity() {
  return (
    <div className="home-identity">
      <img className="home-id-photo" src={prioratoIcon} alt="Priorato di Saint-Pierre" width={140} height={140} />
      <div className="home-id-text">
        <h1 className="home-id-title">Priorato di Saint-Pierre</h1>
        <p className="home-id-addr">Località Priorato, 1 11010 Saint-Pierre (AO)</p>
        <a className="home-id-link" href="tel:+390165903823">
          <PhoneIcon />
          <span>Tel: 0165 903823</span>
        </a>
        <a className="home-id-link" href="mailto:priorato.saintpierre@gmail.com">
          <MailIcon />
          <span>priorato.saintpierre@gmail.com</span>
        </a>
        <DriveSyncBadge />
      </div>
    </div>
  );
}

export function HomeHub({
  stays,
  day,
  dayPicker,
  searchQuery = "",
  onChange,
  onOpenTab,
  onOpenSearch,
  onOpenSettings,
}: Props) {
  return (
    <div className="home-hub">
      <div className="home-day-picker">{dayPicker}</div>

      <TodayReport
        stays={stays}
        day={day}
        searchQuery={searchQuery}
        onChange={onChange}
        onOpenRooms={() => onOpenTab("camere")}
        embedded
      />

      <div className="home-tiles">
        <button type="button" className="home-tile home-tile-primary" onClick={() => onOpenTab("registra")}>
          <span className="home-tile-icon" aria-hidden>
            ➕
          </span>
          <span className="home-tile-title">Registra ospite</span>
          <span className="home-tile-desc">Nuovo arrivo o gruppo</span>
        </button>
        <button type="button" className="home-tile" onClick={() => onOpenTab("camere")}>
          <span className="home-tile-icon" aria-hidden>
            🛏️
          </span>
          <span className="home-tile-title">Camere libere</span>
          <span className="home-tile-desc">Per la data scelta sopra</span>
        </button>
        <button type="button" className="home-tile" onClick={() => onOpenTab("stampa")}>
          <span className="home-tile-icon" aria-hidden>
            🖨️
          </span>
          <span className="home-tile-title">Stampa report</span>
        </button>
        <div className="home-tile home-tile-placeholder" aria-hidden />
      </div>

      <nav className="home-footer-links" aria-label="Altre sezioni">
        <button type="button" onClick={() => onOpenTab("pianificazione")}>
          Occupazione
        </button>
        <button type="button" onClick={onOpenSearch}>
          Cerca ospite
        </button>
        <button type="button" onClick={onOpenSettings}>
          Impostazioni
        </button>
      </nav>
    </div>
  );
}
