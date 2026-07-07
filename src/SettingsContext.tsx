import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AutoBackupIntervalHours } from "./backup";

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
