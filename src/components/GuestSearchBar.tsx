type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GuestSearchBar({
  value,
  onChange,
  placeholder = "Cerca ospite, gruppo, camera…",
}: Props) {
  return (
    <label className="guest-search">
      <span className="guest-search-icon" aria-hidden>
        <SearchIcon />
      </span>
      <input
        type="search"
        className="guest-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Cerca ospiti"
      />
      {value && (
        <button
          type="button"
          className="guest-search-clear"
          onClick={() => onChange("")}
          aria-label="Cancella ricerca"
        >
          ✕
        </button>
      )}
    </label>
  );
}
