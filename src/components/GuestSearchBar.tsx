type Props = {
  value: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function GuestSearchBar({
  value,
  draft,
  onDraftChange,
  onSearch,
  onClear,
  placeholder = "Cerca ospite, gruppo, camera…",
  autoFocus = false,
}: Props) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch();
  }

  return (
    <form className="guest-search" onSubmit={handleSubmit}>
      <span className="guest-search-icon" aria-hidden>
        <SearchIcon />
      </span>
      <input
        type="search"
        className="guest-search-input"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Cerca ospiti"
        autoFocus={autoFocus}
      />
      <button type="submit" className="btn primary small guest-search-submit">
        Cerca
      </button>
      {(value || draft) && (
        <button
          type="button"
          className="guest-search-clear"
          onClick={onClear}
          aria-label="Cancella ricerca"
        >
          ✕
        </button>
      )}
    </form>
  );
}

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
