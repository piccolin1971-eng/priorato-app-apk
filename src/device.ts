const SETTINGS_KEY = "priorato-settings-v1";

export const DEVICE_PRESETS = [
  "Portineria",
  "PC Priorato",
  "Tablet cucina",
  "Tablet accoglienza",
] as const;

export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Tablet / telefono";
  if (/iPad|iPhone/i.test(ua)) return "Tablet / telefono";
  return "PC";
}

export function getDeviceName(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { deviceName?: string };
      const name = parsed.deviceName?.trim();
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return guessDeviceName();
}
