import type { Room } from "./types";

/** Prima camera libera per default, escludendo la 106 (assegnazione manuale). */
export function pickDefaultRoom(rooms: Room[]): string {
  return rooms.find((r) => r.id !== "106")?.id ?? rooms[0]?.id ?? "";
}

/** Ordina camere con la 106 in fondo ma selezionabile. */
export function sortRoomsForSelect(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (a.id === "106") return 1;
    if (b.id === "106") return -1;
    return a.number - b.number;
  });
}

export function roomOptionLabel(room: Room): string {
  return room.id === "106" ? `${room.label} (extra, manuale)` : room.label;
}
