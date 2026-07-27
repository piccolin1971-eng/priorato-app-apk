import type { GuestStay } from "../types";
import { stayDisplayName, stayRoomsLabel } from "../stayUtils";
import { formatDateIt } from "../utils";

type Props = {
  results: GuestStay[];
  onSelect: (stay: GuestStay) => void;
};

export function GuestSearchResults({ results, onSelect }: Props) {
  if (results.length === 0) {
    return <p className="muted search-results-empty">Nessun risultato.</p>;
  }

  return (
    <ul className="search-results-list">
      {results.map((stay) => (
        <li key={stay.id}>
          <button type="button" className="search-result-btn" onClick={() => onSelect(stay)}>
            <strong>{stayDisplayName(stay)}</strong>
            <span className="muted block">
              {stayRoomsLabel(stay)} · {formatDateIt(stay.checkIn)} – {formatDateIt(stay.checkOut)}
            </span>
            {stay.group && <span className="tag">{stay.group.name}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
