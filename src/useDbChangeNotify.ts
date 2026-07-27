import { useCallback, useEffect, useState } from "react";
import { DB_META_KEY, formatDbChangeSummary, loadDbMeta, type DbMeta } from "./dbMeta";
import { useSettings } from "./SettingsContext";

const STAYS_KEY = "priorato-stays-v1";

type Options = {
  onReloadStays: () => void;
};

export function useDbChangeNotify({ onReloadStays }: Options) {
  const {
    changeNotifyEnabled,
    changeNotifyOnStart,
    changeNotifyWhileUsing,
    lastSeenDbRevision,
    setLastSeenDbRevision,
  } = useSettings();
  const [pendingMeta, setPendingMeta] = useState<DbMeta | null>(null);

  const checkForExternalChanges = useCallback(() => {
    if (!changeNotifyEnabled) {
      setPendingMeta(null);
      return;
    }
    const meta = loadDbMeta();
    if (meta.revision > lastSeenDbRevision) {
      setPendingMeta(meta);
      return;
    }
    setPendingMeta(null);
  }, [changeNotifyEnabled, lastSeenDbRevision]);

  useEffect(() => {
    if (!changeNotifyEnabled || !changeNotifyOnStart) return;
    checkForExternalChanges();
  }, [changeNotifyEnabled, changeNotifyOnStart, checkForExternalChanges]);

  useEffect(() => {
    function onLocalChange(e: Event) {
      const detail = (e as CustomEvent<{ meta: DbMeta; local: boolean }>).detail;
      if (!detail?.local) return;
      setLastSeenDbRevision(detail.meta.revision);
      setPendingMeta(null);
    }
    window.addEventListener("priorato-db-changed", onLocalChange);
    return () => window.removeEventListener("priorato-db-changed", onLocalChange);
  }, [setLastSeenDbRevision]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== DB_META_KEY && e.key !== STAYS_KEY) return;
      checkForExternalChanges();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [checkForExternalChanges]);

  useEffect(() => {
    if (!changeNotifyEnabled || !changeNotifyWhileUsing) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      checkForExternalChanges();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [changeNotifyEnabled, changeNotifyWhileUsing, checkForExternalChanges]);

  function acknowledge() {
    const meta = loadDbMeta();
    setLastSeenDbRevision(meta.revision);
    setPendingMeta(null);
  }

  function reloadAndAcknowledge() {
    onReloadStays();
    acknowledge();
  }

  return {
    showBanner: Boolean(pendingMeta),
    bannerSummary: pendingMeta ? formatDbChangeSummary(pendingMeta) : "",
    acknowledge,
    reloadAndAcknowledge,
  };
}
