import type { GuestStay, GroupInfo, Room } from "./types";
import { ROOMS, ROOM_SECTIONS } from "./data/rooms";
import { getPersonCount, getStayRoomIds, stayDisplayName, stayGroupLabel } from "./stayUtils";

export type OccupantNames = { name1: string; name2: string };
export type OccupantMap = Record<string, OccupantNames>;

export function emptyOccupant(): OccupantNames {
  return { name1: "", name2: "" };
}

/** Party unificato o vecchia registrazione «gruppo». */
export function isPartyLikeStay(stay: GuestStay): boolean {
  if (stay.kind === "party" || stay.kind === "group") return true;
  if (stay.secondGuestName?.trim()) return false;
  const people = getPersonCount(stay);
  if (people <= 1) return false;
  return getStayRoomIds(stay).length > 1 || stay.group != null;
}

export type StayBookingKind = "group" | "couple" | "single";

/** Registrazione: gruppo, coppia (1 camera doppia) o singolo. */
export function stayBookingKind(stay: GuestStay): StayBookingKind {
  if (isPartyLikeStay(stay)) return "group";
  if (stay.kind === "double" || stay.secondGuestName?.trim() || getPersonCount(stay) >= 2) {
    return "couple";
  }
  return "single";
}

export function countCouplesInRoomIds(roomIds: string[]): number {
  return roomIds.filter((id) => ROOMS.find((r) => r.id === id)?.bedType === "double").length;
}

export type PartyGroupForm = {
  guestName: string;
  guestPhone: string;
  groupName: string;
  participants?: GroupInfo["participants"];
};

export function buildPartyGroupInfo(form: PartyGroupForm): GroupInfo | undefined {
  const groupName = form.groupName.trim();
  const leaderName = form.guestName.trim();
  const leaderPhone = form.guestPhone.trim();
  const participants = form.participants?.length ? form.participants : undefined;
  if (!groupName && !leaderName && !leaderPhone && !participants) return undefined;
  return {
    name: groupName || "Gruppo",
    leaderName,
    leaderPhone: leaderPhone || undefined,
    participants,
  };
}

export function occupantsFromStay(stay: GuestStay): OccupantMap {
  const map: OccupantMap = {};
  for (const p of stay.group?.participants ?? []) {
    if (!p.roomId) continue;
    const cur = map[p.roomId] ?? emptyOccupant();
    const name = p.name.trim();
    const other = p.inRoomWith?.trim() ?? "";
    if (name && !cur.name1) cur.name1 = name;
    else if (name && name !== cur.name1 && !cur.name2) cur.name2 = name;
    if (other && other !== cur.name1 && !cur.name2) cur.name2 = other;
    map[p.roomId] = cur;
  }
  return map;
}

export function namesForRoom(stay: GuestStay, roomId: string): string[] {
  const occ = occupantsFromStay(stay)[roomId];
  if (!occ) return [];
  return [occ.name1, occ.name2].map((n) => n.trim()).filter(Boolean);
}

export function roomGuestLabel(stay: GuestStay, roomId: string): string {
  const names = namesForRoom(stay, roomId);
  if (names.length) return names.join(" · ");
  const groupLabel = stayGroupLabel(stay);
  if (groupLabel && groupLabel !== stay.guestName.trim()) return groupLabel;
  return stayDisplayName(stay);
}

export function participantsFromOccupants(
  roomIds: string[],
  occupants: OccupantMap,
): GroupInfo["participants"] {
  const list: NonNullable<GroupInfo["participants"]> = [];
  for (const id of roomIds) {
    const room = ROOMS.find((r) => r.id === id);
    const occ = occupants[id];
    const name1 = occ?.name1.trim() ?? "";
    const name2 = room?.bedType === "double" ? occ?.name2.trim() ?? "" : "";
    if (name1) {
      list.push({
        name: name1,
        roomId: id,
        roomType: room?.bedType,
        inRoomWith: name2 || undefined,
      });
    }
    if (name2) {
      list.push({
        name: name2,
        roomId: id,
        roomType: "double",
        inRoomWith: name1 || undefined,
      });
    }
  }
  return list.length ? list : undefined;
}

export function pruneOccupants(prev: OccupantMap, roomIds: string[]): OccupantMap {
  const keep = new Set(roomIds);
  const next: OccupantMap = {};
  let dropped = false;
  for (const [id, val] of Object.entries(prev)) {
    if (keep.has(id)) next[id] = val;
    else dropped = true;
  }
  if (!dropped && Object.keys(next).length === Object.keys(prev).length) return prev;
  return next;
}

export function groupRoomsBySection(roomIds: string[]): { section: (typeof ROOM_SECTIONS)[number]; rooms: Room[] }[] {
  const selected = new Set(roomIds);
  return ROOM_SECTIONS.map((section) => ({
    section,
    rooms: ROOMS.filter((r) => section.filter(r) && selected.has(r.id)).sort(
      (a, b) => a.number - b.number,
    ),
  })).filter((g) => g.rooms.length > 0);
}
