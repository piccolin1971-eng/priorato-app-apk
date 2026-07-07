import type { GuestStay } from "./types";
import { ROOMS, normalizeRoomId } from "./data/rooms";

/** Tutte le camere occupate da una registrazione (anche multi-camera). */
export function getStayRoomIds(stay: GuestStay): string[] {
  const ids = stay.roomIds?.length
    ? stay.roomIds
  : stay.roomId
    ? [stay.roomId]
    : [];
  return [...new Set(ids.map(normalizeRoomId).filter(Boolean))];
}

/** Persone totali per pasti / conteggi. */
export function getPersonCount(stay: GuestStay): number {
  if (stay.personCount != null && stay.personCount > 0) return stay.personCount;
  if (stay.secondGuestName?.trim()) return 2;
  if ((stay.roomIds?.length ?? 0) > 1) return stay.roomIds!.length;
  return 1;
}

export function stayDisplayName(stay: GuestStay): string {
  if (stay.secondGuestName?.trim()) {
    return `${stay.guestName} + ${stay.secondGuestName.trim()}`;
  }
  const n = getPersonCount(stay);
  if (n > 1) return `${stay.guestName} (${n} persone)`;
  return stay.guestName;
}

export function stayRoomsLabel(stay: GuestStay): string {
  const ids = getStayRoomIds(stay);
  if (ids.length === 0) return "—";

  const roomParts = ids.map((id) => {
    const room = ROOMS.find((r) => String(r.id) === String(id));
    if (!room) return String(id);
    return `${room.number}${room.bedType === "double" ? " (doppia)" : ""}`;
  });

  if (ids.length === 1) return roomParts[0] ?? "—";
  return `Camere ${roomParts.join(", ")}`;
}

export function mealPersonCount(stay: GuestStay, meal: "lunch" | "dinner"): number {
  const included = meal === "lunch" ? stay.lunch : stay.dinner;
  if (!included) return 0;
  return getPersonCount(stay);
}

/** Normalizza campi multi-camera su registrazioni salvate prima dell'aggiornamento. */
export function normalizeStay(stay: GuestStay): GuestStay {
  const roomIds = getStayRoomIds(stay);
  const primary = roomIds[0] ?? normalizeRoomId(stay.roomId);
  const personCount = getPersonCount(stay);
  return {
    ...stay,
    roomId: primary,
    roomIds: roomIds.length ? roomIds : primary ? [primary] : [],
    personCount,
  };
}
