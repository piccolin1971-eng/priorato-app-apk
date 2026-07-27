export async function generateReportPdf(element: HTMLElement, filename: string): Promise<Blob> {
  const { default: html2pdf } = await import("html2pdf.js");
  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename,
    image: { type: "jpeg" as const, quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
  };

  const worker = html2pdf().set(opt).from(element);
  const blob = await worker.outputPdf("blob");
  return blob as Blob;
}

export function pdfFilename(title: string): string {
  const safe = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `priorato-${safe || "report"}.pdf`;
}

export async function sharePdfByEmail(
  blob: Blob,
  filename: string,
  recipients: string[],
  subject: string,
  body: string,
): Promise<{ ok: boolean; message: string }> {
  if (!recipients.length) {
    return { ok: false, message: "Nessuna email selezionata. Aggiungi i contatti in Impostazioni." };
  }

  const file = new File([blob], filename, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: subject,
        text: body,
      });
      return { ok: true, message: "Condivisione avviata." };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, message: "Invio annullato." };
      }
    }
  }

  downloadBlob(blob, filename);
  const bcc = recipients.join(",");
  const mailto = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\nIl PDF è stato scaricato: allegalo a questa email.`)}`;
  window.location.href = mailto;
  return {
    ok: true,
    message: "PDF scaricato. Si apre il programma email: allega il file e invia.",
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
