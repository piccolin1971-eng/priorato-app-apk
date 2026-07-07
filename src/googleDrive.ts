import type { BackupBundle } from "./backup";

export type GoogleDriveSettings = {
  clientId: string;
  folderId: string;
  connected: boolean;
  accountEmail?: string;
};

export type GoogleDriveSyncResult = {
  ok: boolean;
  message: string;
};

/** Stub: OAuth e upload Drive verranno collegati quando avrete un progetto Google Cloud. */
export async function syncBackupToGoogleDrive(
  _bundle: BackupBundle,
  settings: GoogleDriveSettings,
): Promise<GoogleDriveSyncResult> {
  if (!settings.clientId.trim()) {
    return {
      ok: false,
      message: "Inserisci il Client ID Google OAuth nelle impostazioni.",
    };
  }
  if (!settings.connected) {
    return {
      ok: false,
      message:
        "Account Google non ancora collegato. Premi «Collega Google» quando il progetto Drive sarà configurato.",
    };
  }
  return {
    ok: false,
    message: "Sincronizzazione Google Drive in preparazione (upload non ancora attivo).",
  };
}

export async function connectGoogleDrive(
  settings: GoogleDriveSettings,
): Promise<GoogleDriveSyncResult> {
  if (!settings.clientId.trim()) {
    return { ok: false, message: "Inserisci prima il Client ID OAuth." };
  }
  return {
    ok: false,
    message:
      "Collegamento Google in preparazione. Salva il Client ID: sarà usato quando attiveremo OAuth.",
  };
}
