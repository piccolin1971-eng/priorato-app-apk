import { useEffect } from "react";
import type { GuestStay } from "./types";
import {
  createBackupBundle,
  saveAutoBackupLocal,
  shouldRunAutoBackup,
} from "./backup";
import { syncBackupToGoogleDrive } from "./googleDrive";
import { useSettings } from "./SettingsContext";

export function useAutoBackup(stays: GuestStay[]) {
  const {
    autoBackupEnabled,
    autoBackupIntervalHours,
    lastAutoBackupAt,
    setLastAutoBackupAt,
    googleDriveClientId,
    googleDriveFolderId,
    googleDriveConnected,
    googleDriveAccountEmail,
  } = useSettings();

  useEffect(() => {
    function runIfDue() {
      if (
        !shouldRunAutoBackup(autoBackupEnabled, autoBackupIntervalHours, lastAutoBackupAt || undefined)
      ) {
        return;
      }
      saveAutoBackupLocal(stays);
      const now = new Date().toISOString();
      setLastAutoBackupAt(now);
      if (googleDriveClientId.trim()) {
        void syncBackupToGoogleDrive(createBackupBundle(stays), {
          clientId: googleDriveClientId,
          folderId: googleDriveFolderId,
          connected: googleDriveConnected,
          accountEmail: googleDriveAccountEmail,
        });
      }
    }

    runIfDue();
    const timer = window.setInterval(runIfDue, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") runIfDue();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    stays,
    autoBackupEnabled,
    autoBackupIntervalHours,
    lastAutoBackupAt,
    setLastAutoBackupAt,
    googleDriveClientId,
    googleDriveFolderId,
    googleDriveConnected,
    googleDriveAccountEmail,
  ]);
}
