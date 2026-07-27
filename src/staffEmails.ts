const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Una email per riga o separate da virgola/punto e virgola. */
export function parseStaffEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (!EMAIL_RE.test(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function formatStaffEmails(emails: string[]): string {
  return emails.join("\n");
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}
