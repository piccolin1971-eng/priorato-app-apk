type Props = {
  summary: string;
  onAcknowledge: () => void;
  onReload: () => void;
};

export function DbChangeBanner({ summary, onAcknowledge, onReload }: Props) {
  return (
    <div className="db-change-banner no-print" role="status" aria-live="polite">
      <div className="db-change-banner-body">
        <strong>Dati aggiornati</strong>
        <p>
          Dall&apos;ultima volta che hai controllato ci sono state modifiche nel database.
        </p>
        <p className="db-change-banner-detail">{summary}</p>
      </div>
      <div className="db-change-banner-actions">
        <button type="button" className="btn primary small" onClick={onReload}>
          Ricarica dati
        </button>
        <button type="button" className="btn ghost small" onClick={onAcknowledge}>
          Ho visto
        </button>
      </div>
    </div>
  );
}
