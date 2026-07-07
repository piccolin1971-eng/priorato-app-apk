import { useSettings, type ThemeMode } from "../SettingsContext";

type Props = {
  onBack: () => void;
};

const THEMES: { id: ThemeMode; label: string; desc: string }[] = [
  { id: "light", label: "Chiaro", desc: "Bianco e grigio, leggibile in ufficio" },
  { id: "parchment", label: "Pergamena", desc: "Tono caldo, meno affaticante" },
  { id: "dark", label: "Scuro", desc: "Per ambienti poco illuminati" },
];

export function SettingsView({ onBack }: Props) {
  const { theme, setTheme, fontSize } = useSettings();

  return (
    <section className="panel settings-panel">
      <header className="settings-head">
        <button type="button" className="btn-back" onClick={onBack}>
          ← Indietro
        </button>
        <h2>Impostazioni</h2>
      </header>

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
      </div>

      <p className="footer-note">Priorato · accoglienza · dati in locale (demo)</p>
    </section>
  );
}
