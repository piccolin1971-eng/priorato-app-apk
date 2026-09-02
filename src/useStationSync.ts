import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestStay } from "./types";
import { formatDbChangeSummary } from "./dbMeta";
import { useSettings } from "./SettingsContext";
import {
  applyRemotePayload,
  isSyncConfigured,
  loadSyncCursor,
  payloadToMeta,
  pullStations,
  pushStations,
  type SyncPayload,
} from "./stationSync";

const POLL_MS = 120_000;

export type StationNotice = {
  kind: "applied" | "conflict";
  summary: string;
  remote?: SyncPayload;
};

type Options = {
  stays: GuestStay[];
  setStays: (stays: GuestStay[]) => void;
};

export function useStationSync({ stays, setStays }: Options) {
  const { syncScriptUrl, syncPassword, setLastStationSyncAt } = useSettings();
  const configured = isSyncConfigured(syncScriptUrl, syncPassword);
  const skipPushRef = useRef(true);
  const dirtyRef = useRef(false);
  const [notice, setNotice] = useState<StationNotice | null>(null);
  const staysRef = useRef(stays);
  staysRef.current = stays;

  const markSynced = useCallback(() => {
    dirtyRef.current = false;
    setLastStationSyncAt(new Date().toISOString());
  }, [setLastStationSyncAt]);

  const applyRemote = useCallback(
    (payload: SyncPayload) => {
      skipPushRef.current = true;
      dirtyRef.current = false;
      const next = applyRemotePayload(payload);
      setStays(next);
      markSynced();
    },
    [markSynced, setStays],
  );

  const pull = useCallback(async () => {
    if (!configured) return;
    const res = await pullStations(syncScriptUrl, syncPassword);
    if (!res.ok) return;
    const remote = res.payload;
    if (!remote || !Array.isArray(remote.stays)) {
      if (staysRef.current.length > 0) {
        dirtyRef.current = true;
        const pushed = await pushStations(syncScriptUrl, syncPassword, staysRef.current);
        if (pushed.ok) markSynced();
      }
      return;
    }
    if (remote.serverRevision === loadSyncCursor()) {
      markSynced();
      return;
    }
    if (dirtyRef.current) {
      setNotice({
        kind: "conflict",
        summary: formatDbChangeSummary(payloadToMeta(remote)),
        remote,
      });
      return;
    }
    applyRemote(remote);
    setNotice({
      kind: "applied",
      summary: formatDbChangeSummary(payloadToMeta(remote)),
      remote,
    });
  }, [applyRemote, configured, markSynced, syncPassword, syncScriptUrl]);

  const push = useCallback(async () => {
    if (!configured) return;
    const res = await pushStations(syncScriptUrl, syncPassword, staysRef.current);
    if (res.conflict && res.payload) {
      setNotice({
        kind: "conflict",
        summary: formatDbChangeSummary(payloadToMeta(res.payload)),
        remote: res.payload,
      });
      return;
    }
    if (res.ok) markSynced();
  }, [configured, markSynced, syncPassword, syncScriptUrl]);

  useEffect(() => {
    if (!configured) return;
    skipPushRef.current = true;
    void pull();
  }, [configured, pull]);

  useEffect(() => {
    if (!configured) return;
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    dirtyRef.current = true;
    void push();
  }, [configured, stays, push]);

  useEffect(() => {
    if (!configured) return;
    const timer = window.setInterval(() => {
      void pull();
    }, POLL_MS);
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      void pull();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [configured, pull]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const takeTheirs = useCallback(() => {
    if (notice?.remote) applyRemote(notice.remote);
    setNotice(null);
  }, [applyRemote, notice]);

  const keepMine = useCallback(async () => {
    if (!configured) return;
    const res = await pushStations(syncScriptUrl, syncPassword, staysRef.current, true);
    if (res.ok) markSynced();
    setNotice(null);
  }, [configured, markSynced, syncPassword, syncScriptUrl]);

  return { notice, dismissNotice, takeTheirs, keepMine, configured };
}
