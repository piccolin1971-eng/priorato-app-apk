import { useMemo } from "react";
import type { GuestStay } from "../types";
import { ROOMS, ROOM_SECTIONS } from "../data/rooms";
import { getDayOccupancy } from "../roomAvailability";
import { stayDisplayName, stayMatchesQuery } from "../stayUtils";
import { formatDateIt, todayIso } from "../utils";

type Props = {
  stays: GuestStay[];
  day?: string;
  searchQuery?: string;
};

export function RoomOverview({ stays, day = todayIso(), searchQuery = "" }: Props) {
  const byRoom = useMemo(() => getDayOccupancy(stays, day).stayByRoom, [stays, day]);
  const q = searchQuery.trim().toLowerCase();

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Camere</h2>
        <p className="muted">
          Situazione al {formatDateIt(day)} — verde libera, arancione occupata con periodo e ospite.
        </p>
      </header>

      {ROOM_SECTIONS.map((sec) => {
        const sectionRooms = ROOMS.filter(sec.filter);
        if (sectionRooms.length === 0) return null;
        return (
          <div key={sec.id} className="room-section">
            <h3>
              {sec.title}
              <span className="room-section-range"> · {sec.range}</span>
            </h3>
            <div className="room-grid">
              {sectionRooms.map((room) => {
                const guest = byRoom.get(room.id);
                const matches =
                  !q ||
                  room.number.toString().includes(q) ||
                  room.label.toLowerCase().includes(q) ||
                  (guest && stayMatchesQuery(guest, q));
                return (
                  <div
                    key={room.id}
                    className={`${guest ? "room occupied" : "room free room-free-compact"}${room.large ? " room-large" : ""}${q && !matches ? " room-search-dim" : ""}${q && matches ? " room-search-hit" : ""}`}
                    title={
                      guest
                        ? `${guest.guestName} · dal ${formatDateIt(guest.checkIn)} al ${formatDateIt(guest.checkOut)}`
                        : room.label
                    }
                  >
                    <span className="room-n">
                      {room.number}
                      {room.large && <span className="room-extra-badge">extra</span>}
                      {room.bedType === "double" && <span className="room-extra-badge">doppia</span>}
                    </span>
                    {guest ? (
                      <>
                        <span className="room-guest-name">{stayDisplayName(guest)}</span>
                        <span className="room-dates">
                          dal {formatDateIt(guest.checkIn)}
                          <br />
                          al {formatDateIt(guest.checkOut)}
                        </span>
                        {guest.group && (
                          <span className="room-group">{guest.group.name}</span>
                        )}
                      </>
                    ) : (
                      <span className="room-free-label">Libera</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
