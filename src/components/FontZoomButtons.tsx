import { useSettings } from "../SettingsContext";

export function FontZoomButtons() {
  const { fontSize, decreaseFont, increaseFont } = useSettings();

  return (
    <>
      <button
        type="button"
        className="topbar-icon-btn topbar-zoom-btn"
        onClick={decreaseFont}
        disabled={fontSize <= 14}
        title="Riduci testo"
        aria-label="Riduci dimensione testo"
      >
        A−
      </button>
      <button
        type="button"
        className="topbar-icon-btn topbar-zoom-btn"
        onClick={increaseFont}
        disabled={fontSize >= 24}
        title="Ingrandisci testo"
        aria-label="Aumenta dimensione testo"
      >
        A+
      </button>
    </>
  );
}
