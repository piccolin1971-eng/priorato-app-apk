import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AutoBackupIntervalHours } from "./backup";
import { loadDbMeta } from "./dbMeta";
import {
  pruneLastSentKeys,
  type ReportSendProfile,
} from "./reportProfiles";

export type ThemeMode = "light" | "dark" | "parchment";

const STORAGE_KEY = "priorato-settings-v1";

export const FONT_MIN = 14;
export const FONT_MAX = 24;
export const FONT_STEP = 1;
export const FONT_DEFAULT = 16;

export type StoredSettings = {
  theme?: ThemeMode;
  fontSize?: number;
  parchmentShade?: number;
  autoBackupEnabled?: boolean;
  autoBackupIntervalHours?: AutoBackupIntervalHours;
  lastAutoBackupAt?: string;
  googleDriveClientId?: string;
  googleDriveFolderId?: string;
  googleDriveConnected?: boolean;
  googleDriveAccountEmail?: string;
  confirmBeforeDelete?: boolean;
  appLockEnabled?: boolean;
  appLockPassword?: string;
  deviceName?: string;
  changeNotifyEnabled?: boolean;
  changeNotifyOnStart?: boolean;
  changeNotifyWhileUsing?: boolean;
  lastSeenDbRevision?: number;
  staffEmails?: string[];
  reportProfiles?: ReportSendProfile[];
  reportProfileLastSent?: string[];
};

type SettingsState = {
  theme: ThemeMode;
  fontSize: number;
  parchmentShade: number;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: AutoBackupIntervalHours;
  lastAutoBackupAt: string;
  googleDriveClientId: string;
  googleDriveFolderId: string;
  googleDriveConnected: boolean;
  googleDriveAccountEmail: string;
  confirmBeforeDelete: boolean;
  appLockEnabled: boolean;
  appLockPassword: string;
  deviceName: string;
  changeNotifyEnabled: boolean;
  changeNotifyOnStart: boolean;
  changeNotifyWhileUsing: boolean;
  lastSeenDbRevision: number;
  staffEmails: string[];
  reportProfiles: ReportSendProfile[];
  reportProfileLastSent: string[];
  setStaffEmails: (emails: string[]) => void;
  setReportProfiles: (profiles: ReportSendProfile[]) => void;
  markReportProfileSent: (slotKey: string) => void;
  setDeviceName: (name: string) => void;
  setChangeNotifyEnabled: (enabled: boolean) => void;
  setChangeNotifyOnStart: (enabled: boolean) => void;
  setChangeNotifyWhileUsing: (enabled: boolean) => void;
  setLastSeenDbRevision: (revision: number) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setAppLockPassword: (password: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  setParchmentShade: (value: number) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  setAutoBackupIntervalHours: (hours: AutoBackupIntervalHours) => void;
  setLastAutoBackupAt: (iso: string) => void;
  setGoogleDriveClientId: (value: string) => void;
  setGoogleDriveFolderId: (value: string) => void;
  setGoogleDriveConnected: (connected: boolean, email?: string) => void;
  setConfirmBeforeDelete: (value: boolean) => void;
  decreaseFont: () => void;
  increaseFont: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

function clampFont(n: number): number {
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));
}
function clampShade(n: number): number {
  return Math.max(85, Math.min(115, Math.round(n)));
}

export function loadStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return {};
  }
}

function saveSettings(data: StoredSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function applyDocument(theme: ThemeMode, fontSize: number, parchmentShade: number) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  document.documentElement.style.fontSize = `${fontSize}px`;
  document.documentElement.style.setProperty("--parchment-shade", `${parchmentShade}%`);
}

export function initThemeDocument(): void {
  const s = loadStoredSettings();
  const theme =
    s.theme === "light" || s.theme === "dark" || s.theme === "parchment"
      ? s.theme
      : "light";
  const fontSize = clampFont(s.fontSize ?? FONT_DEFAULT);
  const parchmentShade = clampShade(s.parchmentShade ?? 100);
  applyDocument(theme, fontSize, parchmentShade);
}

function toPersist(state: {
  theme: ThemeMode;
  fontSize: number;
  parchmentShade: number;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: AutoBackupIntervalHours;
  lastAutoBackupAt: string;
  googleDriveClientId: string;
  googleDriveFolderId: string;
  googleDriveConnected: boolean;
  googleDriveAccountEmail: string;
  confirmBeforeDelete: boolean;
  appLockEnabled: boolean;
  appLockPassword: string;
  deviceName: string;
  changeNotifyEnabled: boolean;
  changeNotifyOnStart: boolean;
  changeNotifyWhileUsing: boolean;
  lastSeenDbRevision: number;
  staffEmails: string[];
  reportProfiles: ReportSendProfile[];
  reportProfileLastSent: string[];
}): StoredSettings {
  return { ...state };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = loadStoredSettings();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = initial.theme;
    return t === "light" || t === "dark" || t === "parchment" ? t : "light";
  });
  const [fontSize, setFontSizeState] = useState(() =>
    clampFont(initial.fontSize ?? FONT_DEFAULT),
  );
  const [parchmentShade, setParchmentShadeState] = useState(() =>
    clampShade(initial.parchmentShade ?? 100),
  );
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState(
    () => initial.autoBackupEnabled ?? false,
  );
  const [autoBackupIntervalHours, setAutoBackupIntervalHoursState] =
    useState<AutoBackupIntervalHours>(() => initial.autoBackupIntervalHours ?? 24);
  const [lastAutoBackupAt, setLastAutoBackupAtState] = useState(
    () => initial.lastAutoBackupAt ?? "",
  );
  const [googleDriveClientId, setGoogleDriveClientIdState] = useState(
    () => initial.googleDriveClientId ?? "",
  );
  const [googleDriveFolderId, setGoogleDriveFolderIdState] = useState(
    () => initial.googleDriveFolderId ?? "",
  );
  const [googleDriveConnected, setGoogleDriveConnectedState] = useState(
    () => initial.googleDriveConnected ?? false,
  );
  const [googleDriveAccountEmail, setGoogleDriveAccountEmailState] = useState(
    () => initial.googleDriveAccountEmail ?? "",
  );
  const [confirmBeforeDelete, setConfirmBeforeDeleteState] = useState(
    () => initial.confirmBeforeDelete ?? true,
  );
  const [appLockEnabled, setAppLockEnabledState] = useState(
    () => initial.appLockEnabled ?? false,
  );
  const [appLockPassword, setAppLockPasswordState] = useState(
    () => initial.appLockPassword ?? "",
  );
  const [deviceName, setDeviceNameState] = useState(() => initial.deviceName ?? "");
  const [changeNotifyEnabled, setChangeNotifyEnabledState] = useState(
    () => initial.changeNotifyEnabled ?? true,
  );
  const [changeNotifyOnStart, setChangeNotifyOnStartState] = useState(
    () => initial.changeNotifyOnStart ?? true,
  );
  const [changeNotifyWhileUsing, setChangeNotifyWhileUsingState] = useState(
    () => initial.changeNotifyWhileUsing ?? true,
  );
  const [lastSeenDbRevision, setLastSeenDbRevisionState] = useState(
    () => initial.lastSeenDbRevision ?? loadDbMeta().revision,
  );
  const [staffEmails, setStaffEmailsState] = useState<string[]>(
    () => initial.staffEmails ?? [],
  );
  const [reportProfiles, setReportProfilesState] = useState<ReportSendProfile[]>(
    () => initial.reportProfiles ?? [],
  );
  const [reportProfileLastSent, setReportProfileLastSentState] = useState<string[]>(
    () => pruneLastSentKeys(initial.reportProfileLastSent ?? []),
  );

  useEffect(() => {
    applyDocument(theme, fontSize, parchmentShade);
    saveSettings(
      toPersist({
        theme,
        fontSize,
        parchmentShade,
        autoBackupEnabled,
        autoBackupIntervalHours,
        lastAutoBackupAt,
        googleDriveClientId,
        googleDriveFolderId,
        googleDriveConnected,
        googleDriveAccountEmail,
        confirmBeforeDelete,
        appLockEnabled,
        appLockPassword,
        deviceName,
        changeNotifyEnabled,
        changeNotifyOnStart,
        changeNotifyWhileUsing,
        lastSeenDbRevision,
        staffEmails,
        reportProfiles,
        reportProfileLastSent,
      }),
    );
  }, [
    theme,
    fontSize,
    parchmentShade,
    autoBackupEnabled,
    autoBackupIntervalHours,
    lastAutoBackupAt,
    googleDriveClientId,
    googleDriveFolderId,
    googleDriveConnected,
    googleDriveAccountEmail,
    confirmBeforeDelete,
    appLockEnabled,
    appLockPassword,
    deviceName,
    changeNotifyEnabled,
    changeNotifyOnStart,
    changeNotifyWhileUsing,
    lastSeenDbRevision,
    staffEmails,
    reportProfiles,
    reportProfileLastSent,
  ]);

  const setTheme = (next: ThemeMode) => setThemeState(next);
  const setFontSize = (n: number) => setFontSizeState(clampFont(n));
  const setParchmentShade = (n: number) => setParchmentShadeState(clampShade(n));
  const setAutoBackupEnabled = (enabled: boolean) => setAutoBackupEnabledState(enabled);
  const setAutoBackupIntervalHours = (hours: AutoBackupIntervalHours) =>
    setAutoBackupIntervalHoursState(hours);
  const setLastAutoBackupAt = useCallback((iso: string) => setLastAutoBackupAtState(iso), []);
  const setGoogleDriveClientId = (value: string) => setGoogleDriveClientIdState(value);
  const setGoogleDriveFolderId = (value: string) => setGoogleDriveFolderIdState(value);
  const setGoogleDriveConnected = (connected: boolean, email?: string) => {
    setGoogleDriveConnectedState(connected);
    setGoogleDriveAccountEmailState(email ?? "");
  };
  const setConfirmBeforeDelete = (value: boolean) => setConfirmBeforeDeleteState(value);
  const setAppLockEnabled = (enabled: boolean) => setAppLockEnabledState(enabled);
  const setAppLockPassword = (password: string) => setAppLockPasswordState(password);
  const setDeviceName = (name: string) => setDeviceNameState(name);
  const setStaffEmails = (emails: string[]) => setStaffEmailsState(emails);
  const setReportProfiles = (profiles: ReportSendProfile[]) => setReportProfilesState(profiles);
  const markReportProfileSent = useCallback((key: string) => {
    setReportProfileLastSentState((prev) => pruneLastSentKeys([...prev.filter((k) => k !== key), key]));
  }, []);
  const setChangeNotifyEnabled = (enabled: boolean) => setChangeNotifyEnabledState(enabled);
  const setChangeNotifyOnStart = (enabled: boolean) => setChangeNotifyOnStartState(enabled);
  const setChangeNotifyWhileUsing = (enabled: boolean) => setChangeNotifyWhileUsingState(enabled);
  const setLastSeenDbRevision = useCallback(
    (revision: number) => setLastSeenDbRevisionState(revision),
    [],
  );
  const decreaseFont = () => setFontSizeState((f) => clampFont(f - FONT_STEP));
  const increaseFont = () => setFontSizeState((f) => clampFont(f + FONT_STEP));

  return (
    <SettingsContext.Provider
      value={{
        theme,
        fontSize,
        parchmentShade,
        autoBackupEnabled,
        autoBackupIntervalHours,
        lastAutoBackupAt,
        googleDriveClientId,
        googleDriveFolderId,
        googleDriveConnected,
        googleDriveAccountEmail,
        confirmBeforeDelete,
        appLockEnabled,
        appLockPassword,
        deviceName,
        changeNotifyEnabled,
        changeNotifyOnStart,
        changeNotifyWhileUsing,
        lastSeenDbRevision,
        staffEmails,
        reportProfiles,
        reportProfileLastSent,
        setStaffEmails,
        setReportProfiles,
        markReportProfileSent,
        setTheme,
        setFontSize,
        setParchmentShade,
        setAutoBackupEnabled,
        setAutoBackupIntervalHours,
        setLastAutoBackupAt,
        setGoogleDriveClientId,
        setGoogleDriveFolderId,
        setGoogleDriveConnected,
        setConfirmBeforeDelete,
        setAppLockEnabled,
        setAppLockPassword,
        setDeviceName,
        setChangeNotifyEnabled,
        setChangeNotifyOnStart,
        setChangeNotifyWhileUsing,
        setLastSeenDbRevision,
        decreaseFont,
        increaseFont,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
