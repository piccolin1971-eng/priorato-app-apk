import type { GuestStay } from "./types";
import { ROOMS } from "./data/rooms";
import { getPersonCount, getStayRoomIds } from "./stayUtils";

/** Party unificato o vecchia registrazione «gruppo». */
export function isPartyLikeStay(stay: GuestStay): boolean {
  if (stay.kind === "party" || stay.kind === "group") return true;
  if (stay.secondGuestName?.trim()) return false;
  const people = getPersonCount(stay);
  if (people <= 1) return false;
  return getStayRoomIds(stay).length > 1 || stay.group != null;
}

export function countCouplesInRoomIds(roomIds: string[]): number {
  return roomIds.filter((id) => ROOMS.find((r) => r.id === id)?.bedType === "double").length;
}

export type PartyGroupForm = {
  guestName: string;
  guestPhone: string;
  groupName: string;
  leaderName: string;
  leaderPhone: string;
};

export function buildPartyGroupInfo(form: PartyGroupForm) {
  const groupName = form.groupName.trim();
  const leaderName = form.leaderName.trim();
  const leaderPhone = form.leaderPhone.trim() || form.guestPhone.trim();
  if (!groupName && !leaderName && !leaderPhone) return undefined;
  return {
    name: groupName || "Gruppo",
    leaderName: leaderName || form.guestName.trim(),
    leaderPhone: leaderPhone || undefined,
  };
}
