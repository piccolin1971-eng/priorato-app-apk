import { useState } from "react";
import { checkAppPassword, setSessionUnlocked } from "../appLock";
import { useSettings } from "../SettingsContext";

export function AppLockScreen() {
  const { appLockPassword } = useSettings();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkAppPassword(password, appLockPassword)) {
      setError("Password non corretta.");
      return;
    }
    setSessionUnlocked(true);
    setError("");
    setPassword("");
    window.location.reload();
  }

  return (
    <div className="app-lock-screen">
      <form className="app-lock-card panel" onSubmit={handleSubmit}>
        <h1>Priorato</h1>
        <p className="muted">Inserisci la password per accedere.</p>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <p className="warn-text">{error}</p>}
        <button type="submit" className="btn primary">
          Accedi
        </button>
      </form>
    </div>
  );
}
