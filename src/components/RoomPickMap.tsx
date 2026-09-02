import { ROOMS, ROOM_SECTIONS } from "../data/rooms";
import type { GuestStay, Room } from "../types";
import { stayDisplayName } from "../stayUtils";

type Props = {
  selectedId: string;
  suggestedId: string;
  availableIds: Set<string>;
  stayByRoom: Map<string, GuestStay>;
  bedType?: Room["bedType"];
  onSelect: (roomId: string) => void;
};

export function RoomPickMap({
  selectedId,
  suggestedId,
  availableIds,
  stayByRoom,
  bedType,
  onSelect,
}: Props) {
  const suggestedSection = ROOM_SECTIONS.find((sec) =>
    ROOMS.some((r) => sec.filter(r) && r.id === suggestedId),
  );
  const emptyHouse = stayByRoom.size === 0;

  return (
    <div className="room-pick-map">
      {suggestedId && (
        <p className="room-pick-hint">
          Consigliata: camera <strong>{suggestedId}</strong>
          {emptyHouse
            ? ` (casa vuota: ${suggestedSection?.title ?? "parte vecchia"}).`
            : " (piano già occupato, per non accendere un’ala vuota)."}
        </p>
      )}
      <div className="plan-blocks">
        {ROOM_SECTIONS.map((sec) => {
          const sectionRooms = ROOMS.filter(sec.filter);
          const occupied = sectionRooms.filter((r) => stayByRoom.has(r.id)).length;
          const suggestedHere = sectionRooms.some((r) => r.id === suggestedId);
          return (
            <div
              key={sec.id}
              className={`plan-block plan-block-${sec.id}${suggestedHere ? " room-pick-block-suggested" : ""}`}
            >
              <div className="plan-block-head">
                <h4>{sec.title}</h4>
                <span className="plan-block-range">{sec.range}</span>
                <span className="plan-block-stat">
                  {occupied}/{sectionRooms.length} occupate
                </span>
              </div>
              <div className="plan-block-rooms">
                {sectionRooms.map((room) => {
                  const stay = stayByRoom.get(room.id);
                  const selectable = availableIds.has(room.id);
                  const wrongType = bedType != null && room.bedType !== bedType;
                  const selected = room.id === selectedId;
                  const suggested = room.id === suggestedId;
                  const markerCount = room.bedType === "double" ? 2 : 1;
                  const className = [
                    "plan-room",
                    stay ? "occupied" : selectable ? "free" : "blocked",
                    selected ? "room-pick-selected" : "",
                    suggested ? "room-pick-suggested" : "",
                    wrongType ? "room-pick-wrong-type" : "",
                    room.large ? "plan-room-large" : "",
                    selectable && !wrongType ? "plan-room-clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const title = stay
                    ? stayDisplayName(stay)
                    : selectable
                      ? suggested
                        ? "Libera · consigliata"
                        : "Libera"
                      : wrongType
                        ? room.bedType === "double"
                          ? "Doppia (non per singolo)"
                          : "Singola (non per coppia)"
                        : "Non libera in queste date";
                  const body = (
                    <>
                      <div
                        className={`plan-room-markers ${
                          markerCount === 2 ? "plan-room-markers-double" : "plan-room-markers-single"
                        }`}
                        aria-hidden
                      >
                        {Array.from({ length: markerCount }).map((_, i) => (
                          <span
                            key={`${room.id}-m-${i}`}
                            className={`plan-room-marker ${stay ? "occupied" : "free"}`}
                          />
                        ))}
                      </div>
                      <span className="plan-room-n">
                        {room.number}
                        {room.large && <span className="room-extra-badge">extra</span>}
                        {room.bedType === "double" && <span className="room-extra-badge">doppia</span>}
                      </span>
                      {stay ? (
                        <span className="plan-room-guest">{stayDisplayName(stay)}</span>
                      ) : suggested ? (
                        <span className="plan-room-free">Consigliata</span>
                      ) : selectable && !wrongType ? (
                        <span className="plan-room-free">Libera</span>
                      ) : (
                        <span className="plan-room-free">{wrongType ? "Altro tipo" : "Occupata"}</span>
                      )}
                    </>
                  );
                  if (selectable && !wrongType) {
                    return (
                      <button
                        key={room.id}
                        type="button"
                        className={className}
                        title={title}
                        onClick={() => onSelect(room.id)}
                      >
                        {body}
                      </button>
                    );
                  }
                  return (
                    <div key={room.id} className={className} title={title}>
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
