import { useEffect, useMemo, useRef, useState } from "react";
import { buildPrintReport } from "../printReport";
import { generateReportPdf, pdfFilename, sharePdfByEmail } from "../printPdf";
import {
  describeProfilePeriod,
  findDueSlots,
  type DueReportSlot,
} from "../reportProfiles";
import { useSettings } from "../SettingsContext";
import type { GuestStay } from "../types";
import { PrintPreviewContent } from "./PrintReportPanel";

type Props = {
  stays: GuestStay[];
};

export function ScheduledReportDueHost({ stays }: Props) {
  const { reportProfiles, reportProfileLastSent, markReportProfileSent } = useSettings();
  const [queue, setQueue] = useState<DueReportSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const current = queue[0] ?? null;
  const report = useMemo(
    () => (current ? buildPrintReport(stays, current.options) : null),
    [stays, current],
  );

  useEffect(() => {
    function scan() {
      const due = findDueSlots(reportProfiles, reportProfileLastSent);
      setQueue((prev) => {
        const prevKeys = new Set(prev.map((s) => s.slotKey));
        const merged = [...prev];
        for (const slot of due) {
          if (!prevKeys.has(slot.slotKey)) merged.push(slot);
        }
        // drop slots no longer due / already marked
        const still = new Set(due.map((s) => s.slotKey));
        return merged.filter((s) => still.has(s.slotKey) || s.slotKey === prev[0]?.slotKey);
      });
    }
    scan();
    const id = window.setInterval(scan, 30_000);
    function onVisible() {
      if (document.visibilityState === "visible") scan();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reportProfiles, reportProfileLastSent]);

  function dismissCurrent() {
    if (!current) return;
    markReportProfileSent(current.slotKey);
    setQueue((q) => q.slice(1));
    setStatus("");
  }

  async function sendCurrent() {
    if (!current || !report || !printRef.current) {
      setStatus("Anteprima non pronta: riprova tra un momento.");
      return;
    }
    setBusy(true);
    setStatus("Generazione PDF…");
    try {
      // wait a tick so offscreen content is painted
      await new Promise((r) => window.setTimeout(r, 80));
      const filename = pdfFilename(`${current.profile.name}-${report.title}`);
      const blob = await generateReportPdf(printRef.current, filename);
      const res = await sharePdfByEmail(
        blob,
        filename,
        current.profile.emails,
        `[Priorato] ${current.profile.name} — ${report.title}`,
        `Invio automatico «${current.profile.name}» (${current.time})\n${describeProfilePeriod(current.profile)}\n${report.title}`,
      );
      setStatus(res.message);
      if (res.ok) {
        markReportProfileSent(current.slotKey);
        window.setTimeout(() => {
          setQueue((q) => q.slice(1));
          setStatus("");
        }, 1200);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Invio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  if (!current || !report) return null;

  return (
    <>
      <div className="scheduled-report-offscreen" aria-hidden="true">
        <div ref={printRef} className="print-preview">
          <PrintPreviewContent report={report} />
        </div>
      </div>

      <div className="modal-backdrop no-print" role="presentation">
        <div
          className="modal confirm-dialog print-email-dialog"
          role="dialog"
          aria-labelledby="scheduled-report-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="scheduled-report-title">Invio programmato</h3>
          <p>
            È l&apos;orario di <strong>{current.profile.name}</strong> ({current.time}).
          </p>
          <p className="muted">
            {describeProfilePeriod(current.profile)} · {current.profile.emails.join(", ")}
          </p>
          <p className="muted">{report.title}</p>
          {status && <p className="settings-status">{status}</p>}
          <div className="actions">
            <button type="button" className="btn ghost" disabled={busy} onClick={dismissCurrent}>
              Salta oggi
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={sendCurrent}>
              {busy ? "Invio…" : "Genera PDF e invia"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
