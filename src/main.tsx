import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initThemeDocument, SettingsProvider } from "./SettingsContext";
import App from "./App.tsx";

initThemeDocument();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
);
