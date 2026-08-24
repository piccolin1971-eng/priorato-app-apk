import type { PartyPeopleLayout } from "../assignNearbyRooms";
import { formatPartyLayoutLabel } from "../assignNearbyRooms";
import type { OccupantMap } from "../partyStay";
import { groupRoomsBySection } from "../partyStay";
import { roomOptionLabel, sortRoomsForSelect } from "../roomSelect";
import type { Room } from "../types";

type Props = {
  selectedRoomIds: string[];
  occupants: OccupantMap;
  availableRooms: Room[];
  layout: PartyPeopleLayout;
  shortage: number;
  onReplaceRoom: (oldId: string, newId: string) => void;
  onOccupantsChange: (occupants: OccupantMap) => void;
  onReplan: () => void;
};

export function PartyRoomsEditor({
  selectedRoomIds,
  occupants,
  availableRooms,
  layout,
  shortage,
  onReplaceRoom,
  onOccupantsChange,
  onReplan,
}: Props) {
  const selectedSet = new Set(selectedRoomIds);
  const grouped = groupRoomsBySection(selectedRoomIds);

  function replacementsFor(room: Room): Room[] {
    return sortRoomsForSelect(
      availableRooms.filter(
        (r) => r.bedType === room.bedType && (r.id === room.id || !selectedSet.has(r.id)),
      ),
    );
  }

  function setName(roomId: string, field: "name1" | "name2", value: string) {
    const prev = occupants[roomId] ?? { name1: "", name2: "" };
    onOccupantsChange({ ...occupants, [roomId]: { ...prev, [field]: value } });
  }

  if (!layout.valid || layout.roomsNeeded === 0) return null;

  return (
    <div className="party-assign">
      <div className="party-assign-toolbar">
        <p className={shortage > 0 ? "warn-text" : "muted"}>
          {shortage > 0
            ? `Camere insufficienti nelle date scelte: ${layout.roomsNeeded - shortage} su ${layout.roomsNeeded} (${formatPartyLayoutLabel(layout)}).`
            : `${formatPartyLayoutLabel(layout)}. Nominativi opzionali, per stanza.`}
        </p>
        {shortage === 0 && selectedRoomIds.length > 0 && (
          <button type="button" className="btn ghost small" onClick={onReplan}>
            Riproponi camere
          </button>
        )}
      </div>

      {grouped.length > 0 && (
        <div className="plan-blocks party-assign-blocks">
          {grouped.map(({ section, rooms }) => (
            <div key={section.id} className={`plan-block plan-block-${section.id}`}>
              <div className="plan-block-head">
                <h4>{section.title}</h4>
                <span className="plan-block-range">{section.range}</span>
                <span className="plan-block-stat">
                  {rooms.length} camer{rooms.length === 1 ? "a" : "e"}
                </span>
              </div>
              <div className="party-assign-rooms">
                {rooms.map((room) => {
                  const occ = occupants[room.id] ?? { name1: "", name2: "" };
                  const options = replacementsFor(room);
                  return (
                    <div
                      key={room.id}
                      className={`party-assign-room${room.bedType === "double" ? " is-double" : ""}`}
                    >
                      <div className="party-assign-room-meta">
                        <span className="party-assign-num">
                          {room.number}
                          {room.large && <span className="room-extra-badge">extra</span>}
                          {room.bedType === "double" && (
                            <span className="room-extra-badge">doppia</span>
                          )}
                        </span>
                        <label className="party-assign-swap">
                          <span className="visually-hidden">Cambia camera {room.number}</span>
                          <select
                            value={room.id}
                            aria-label={`Cambia camera ${room.number}`}
                            onChange={(e) => onReplaceRoom(room.id, e.target.value)}
                          >
                            {options.map((r) => (
                              <option key={r.id} value={r.id}>
                                {roomOptionLabel(r).replace(/^.*· /, "")}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="party-assign-names">
                        <input
                          value={occ.name1}
                          onChange={(e) => setName(room.id, "name1", e.target.value)}
                          placeholder={room.bedType === "double" ? "Primo nominativo" : "Nominativo"}
                          autoComplete="off"
                        />
                        {room.bedType === "double" && (
                          <input
                            value={occ.name2}
                            onChange={(e) => setName(room.id, "name2", e.target.value)}
                            placeholder="Secondo nominativo"
                            autoComplete="off"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
