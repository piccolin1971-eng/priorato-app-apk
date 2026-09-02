import type { DepartureMeal, GuestStay, Room } from "./types";
import { ROOMS, ROOM_SECTIONS, normalizeRoomId, sectionPreferenceRank } from "./data/rooms";
import { pickDefaultRoom } from "./roomSelect";
import { departureMealLabel } from "./mealTiming";
import { getStayRoomIds, stayDisplayName } from "./stayUtils";
import {
  dateToIso,
  isoToDate,
  stayKeepsRoomOnCheckout,
  stayOccupiesDay,
  staysOverlap,
} from "./utils";

export const TOTAL_ROOMS = ROOMS.length;

export function getOccupiedRoomIds(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  excludeStayId?: string,
  newDepartureMeal?: DepartureMeal,
): Set<string> {
  const ids = new Set<string>();
  if (!checkIn || !checkOut || checkOut <= checkIn) return ids;
  for (const stay of stays) {
    if (staysOverlap(checkIn, checkOut, stay, excludeStayId, newDepartureMeal)) {
      for (const roomId of getStayRoomIds(stay)) ids.add(roomId);
    }
  }
  return ids;
}

export function getAvailableRooms(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  excludeStayId?: string,
  bedType?: Room["bedType"],
  newDepartureMeal?: DepartureMeal,
): Room[] {
  const occupied = getOccupiedRoomIds(stays, checkIn, checkOut, excludeStayId, newDepartureMeal);
  return ROOMS.filter(
    (r) => !occupied.has(r.id) && (bedType == null || r.bedType === bedType),
  );
}

export function pickFirstFreeRoom(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  bedType?: Room["bedType"],
): string {
  const rooms = getAvailableRooms(stays, checkIn, checkOut, undefined, bedType);
  return pickDefaultRoom(rooms);
}

function rankSection(id: string): number {
  const sec = ROOM_SECTIONS.find((s) => s.id === id);
  const sample = sec ? ROOMS.find(sec.filter) : undefined;
  if (!sample) return 9;
  return sectionPreferenceRank(sample.zone, sample.floor);
}

/** Camera libera nel piano già occupato (riscaldamento). A parità, predilige la parte vecchia (zone più piccole). */
export function suggestHeatedRoom(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  bedType?: Room["bedType"],
  departureMeal?: DepartureMeal,
): string {
  const available = getAvailableRooms(
    stays,
    checkIn,
    checkOut,
    undefined,
    bedType,
    departureMeal,
  );
  if (available.length === 0) return "";
  if (!checkIn) return pickDefaultRoom(available);

  const occ = getDayOccupancy(stays, checkIn);
  const scored = ROOM_SECTIONS.map((sec) => {
    const sectionRooms = ROOMS.filter(sec.filter);
    const occupied = sectionRooms.filter((r) => occ.stayByRoom.has(r.id)).length;
    const free = available.filter((r) => sec.filter(r) && r.id !== "106");
    return { id: sec.id, occupied, free };
  }).filter((s) => s.free.length > 0);

  scored.sort((a, b) => {
    if (b.occupied !== a.occupied) return b.occupied - a.occupied;
    return rankSection(a.id) - rankSection(b.id);
  });

  return scored[0]?.free[0]?.id ?? pickDefaultRoom(available);
}

export function countOccupiedOnDay(stays: GuestStay[], day: string): number {
  return getDayOccupancy(stays, day).occupiedCount;
}

export function getStaysOnDay(stays: GuestStay[], day: string): GuestStay[] {
  return stays.filter((s) => stayOccupiesDay(s, day));
}

export type DayOccupancyDetail = {
  day: string;
  occupiedCount: number;
  freeCount: number;
  stayByRoom: Map<string, GuestStay>;
  conflicts: { roomId: string; stays: GuestStay[] }[];
  unknownRoomStays: GuestStay[];
};

const CATALOG_ROOM_IDS = new Set(ROOMS.map((r) => r.id));

export function getDayOccupancy(stays: GuestStay[], day: string): DayOccupancyDetail {
  const active = getStaysOnDay(stays, day);
  const listsByRoom = new Map<string, GuestStay[]>();
  const unknownRoomStays: GuestStay[] = [];

  for (const stay of active) {
    const roomIds = getStayRoomIds(stay);
    if (roomIds.length === 0) {
      unknownRoomStays.push(stay);
      continue;
    }
    for (const rawId of roomIds) {
      const roomId = normalizeRoomId(rawId);
      if (!CATALOG_ROOM_IDS.has(roomId)) {
        unknownRoomStays.push(stay);
        continue;
      }
      const list = listsByRoom.get(roomId) ?? [];
      list.push(stay);
      listsByRoom.set(roomId, list);
    }
  }

  const stayByRoom = new Map<string, GuestStay>();
  const conflicts: { roomId: string; stays: GuestStay[] }[] = [];
  for (const [roomId, list] of listsByRoom) {
    stayByRoom.set(roomId, list[0]!);
    if (list.length > 1) conflicts.push({ roomId, stays: list });
  }

  const occupiedCount = stayByRoom.size;
  return {
    day,
    occupiedCount,
    freeCount: TOTAL_ROOMS - occupiedCount,
    stayByRoom,
    conflicts,
    unknownRoomStays,
  };
}

export type DayBedStats = {
  occSingle: number;
  occDouble: number;
  freeSingle: number;
  freeDouble: number;
};

/** Occupate/libere suddivise in singole e doppie, per la data scelta. */
export function getDayBedStats(stays: GuestStay[], day: string): DayBedStats {
  const { stayByRoom } = getDayOccupancy(stays, day);
  let occSingle = 0;
  let occDouble = 0;
  let freeSingle = 0;
  let freeDouble = 0;
  for (const room of ROOMS) {
    const occupied = stayByRoom.has(room.id);
    if (room.bedType === "double") {
      if (occupied) occDouble += 1;
      else freeDouble += 1;
    } else if (occupied) occSingle += 1;
    else freeSingle += 1;
  }
  return { occSingle, occDouble, freeSingle, freeDouble };
}

export function getFreeRoomsOnDay(stays: GuestStay[], day: string): Room[] {
  const { stayByRoom } = getDayOccupancy(stays, day);
  return ROOMS.filter((r) => !stayByRoom.has(r.id));
}

export function daysInRange(checkIn: string, checkOut: string): string[] {
  const start = isoToDate(checkIn);
  const end = isoToDate(checkOut);
  if (!start || !end || checkOut <= checkIn) return [];
  const days: string[] = [];
  const cur = new Date(start);
  while (cur < end) {
    days.push(dateToIso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export type DayOccupancy = { day: string; occupied: number; free: number };

export type AvailabilityCheck = {
  ok: boolean;
  roomsNeeded: number;
  minFree: number;
  minFreeDay: string;
  days: DayOccupancy[];
};

export function verifyAvailability(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  roomsNeeded: number,
): AvailabilityCheck | null {
  const days = daysInRange(checkIn, checkOut);
  if (!days.length || roomsNeeded < 1) return null;

  const perDay: DayOccupancy[] = days.map((day) => {
    const occupied = countOccupiedOnDay(stays, day);
    return { day, occupied, free: TOTAL_ROOMS - occupied };
  });

  let minFree = TOTAL_ROOMS;
  let minFreeDay = days[0];
  for (const d of perDay) {
    if (d.free < minFree) {
      minFree = d.free;
      minFreeDay = d.day;
    }
  }

  return {
    ok: minFree >= roomsNeeded,
    roomsNeeded,
    minFree,
    minFreeDay,
    days: perDay,
  };
}

export type RoomOverlap = {
  roomId: string;
  stays: GuestStay[];
};

export function findRoomOverlaps(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  roomIds: string[],
  excludeStayId?: string,
  newDepartureMeal?: DepartureMeal,
): RoomOverlap[] {
  if (!checkIn || !checkOut || checkOut <= checkIn || roomIds.length === 0) return [];
  const occupied = getOccupiedRoomIds(stays, checkIn, checkOut, excludeStayId, newDepartureMeal);
  const overlaps: RoomOverlap[] = [];
  for (const roomId of roomIds) {
    if (!occupied.has(roomId)) continue;
    const conflicting = stays.filter(
      (s) =>
        s.id !== excludeStayId &&
        staysOverlap(checkIn, checkOut, s, undefined, newDepartureMeal) &&
        getStayRoomIds(s).includes(roomId),
    );
    if (conflicting.length) overlaps.push({ roomId, stays: conflicting });
  }
  return overlaps;
}

export function formatOverlapMessage(overlaps: RoomOverlap[]): string {
  return overlaps
    .map(({ roomId, stays: list }) => {
      const room = ROOMS.find((r) => r.id === roomId);
      const names = list
        .map((s) => {
          const extra = stayKeepsRoomOnCheckout(s)
            ? ` (in casa fino a ${departureMealLabel(s.departureMeal).toLowerCase()})`
            : "";
          return `${stayDisplayName(s)}${extra}`;
        })
        .join(", ");
      return `Camera ${room?.number ?? roomId} già occupata da ${names}`;
    })
    .join(". ");
}
