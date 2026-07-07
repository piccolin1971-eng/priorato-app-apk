import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "parchment";

const STORAGE_KEY = "priorato-settings-v1";

export const FONT_MIN = 14;
export const FONT_MAX = 24;
export const FONT_STEP = 1;
export const FONT_DEFAULT = 16;

type StoredSettings = {
  theme?: ThemeMode;
  fontSize?: number;
};

type SettingsState = {
  theme: ThemeMode;
  fontSize: number;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  decreaseFont: () => void;
  increaseFont: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

function clampFont(n: number): number {
  return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));
}

function loadSettings(): StoredSettings {
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

function applyDocument(theme: ThemeMode, fontSize: number) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  document.documentElement.style.fontSize = `${fontSize}px`;
}

export function initThemeDocument(): void {
  const s = loadSettings();
  const theme =
    s.theme === "light" || s.theme === "dark" || s.theme === "parchment"
      ? s.theme
      : "light";
  const fontSize = clampFont(s.fontSize ?? FONT_DEFAULT);
  applyDocument(theme, fontSize);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = loadSettings();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = initial.theme;
    return t === "light" || t === "dark" || t === "parchment" ? t : "light";
  });
  const [fontSize, setFontSizeState] = useState(() =>
    clampFont(initial.fontSize ?? FONT_DEFAULT),
  );

  useEffect(() => {
    applyDocument(theme, fontSize);
    saveSettings({ theme, fontSize });
  }, [theme, fontSize]);

  const setTheme = (next: ThemeMode) => setThemeState(next);
  const setFontSize = (n: number) => setFontSizeState(clampFont(n));
  const decreaseFont = () => setFontSizeState((f) => clampFont(f - FONT_STEP));
  const increaseFont = () => setFontSizeState((f) => clampFont(f + FONT_STEP));

  return (
    <SettingsContext.Provider
      value={{ theme, fontSize, setTheme, setFontSize, decreaseFont, increaseFont }}
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
