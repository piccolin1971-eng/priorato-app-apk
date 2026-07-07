import { ROOMS, ROOM_SECTIONS } from "./data/rooms";
import type { GuestStay, Room } from "./types";
import { getAvailableRooms } from "./roomAvailability";

export type PartyRoomPlan = {
  roomIds: string[];
  rooms: Room[];
  sectionTitle: string;
};

function sectionKey(r: Room): string {
  return `${r.zone}-${r.floor}`;
}

function sectionTitleFor(key: string): string {
  for (const sec of ROOM_SECTIONS) {
    if (ROOMS.some((r) => sectionKey(r) === key && sec.filter(r))) return sec.title;
  }
  return key;
}

function pickConsecutive(rooms: Room[], count: number): Room[] | null {
  if (count === 0) return [];
  const sorted = [...rooms].sort((a, b) => a.number - b.number);
  for (let i = 0; i <= sorted.length - count; i++) {
    let consecutive = true;
    for (let j = 1; j < count; j++) {
      if (sorted[i + j]!.number !== sorted[i + j - 1]!.number + 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) return sorted.slice(i, i + count);
  }
  return null;
}

function scoreCluster(rooms: Room[]): number {
  if (rooms.length <= 1) return 0;
  const nums = rooms.map((r) => r.number).sort((a, b) => a - b);
  return nums[nums.length - 1]! - nums[0]!;
}

function planInSection(
  doubles: Room[],
  singles: Room[],
  couplesCount: number,
  singlesCount: number,
): Room[] | null {
  if (doubles.length < couplesCount || singles.length < singlesCount) return null;

  const pickedDoubles =
    couplesCount > 0
      ? pickConsecutive(doubles, couplesCount) ??
        [...doubles].sort((a, b) => a.number - b.number).slice(0, couplesCount)
      : [];

  const usedIds = new Set(pickedDoubles.map((r) => r.id));
  const singlesLeft = singles.filter((r) => !usedIds.has(r.id));

  const pickedSingles =
    singlesCount > 0
      ? pickConsecutive(singlesLeft, singlesCount) ??
        [...singlesLeft].sort((a, b) => a.number - b.number).slice(0, singlesCount)
      : [];

  return [...pickedDoubles, ...pickedSingles];
}

export function assignNearbyPartyRooms(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  couplesCount: number,
  singlesCount: number,
  excludeStayId?: string,
): PartyRoomPlan | null {
  const available = getAvailableRooms(stays, checkIn, checkOut, excludeStayId);

  const bySection = new Map<string, { doubles: Room[]; singles: Room[] }>();
  for (const r of available) {
    const key = sectionKey(r);
    const entry = bySection.get(key) ?? { doubles: [], singles: [] };
    if (r.bedType === "double") entry.doubles.push(r);
    else entry.singles.push(r);
    bySection.set(key, entry);
  }

  let best: { rooms: Room[]; key: string; spread: number } | null = null;

  for (const [key, { doubles, singles }] of bySection) {
    const planned = planInSection(doubles, singles, couplesCount, singlesCount);
    if (!planned) continue;
    const spread = scoreCluster(planned);
    if (!best || spread < best.spread) {
      best = { rooms: planned, key, spread };
    }
  }

  if (!best) return null;

  return {
    roomIds: best.rooms.map((r) => r.id),
    rooms: best.rooms,
    sectionTitle: sectionTitleFor(best.key),
  };
}

export function partyPeopleAndRooms(totalPeople: number, couplesCount: number): {
  couplesCount: number;
  singlesCount: number;
  roomsNeeded: number;
  valid: boolean;
} {
  const couples = Math.max(0, Math.min(couplesCount, Math.floor(totalPeople / 2)));
  const peopleInDoubles = couples * 2;
  const singlesCount = totalPeople - peopleInDoubles;
  const roomsNeeded = couples + singlesCount;
  return {
    couplesCount: couples,
    singlesCount,
    roomsNeeded,
    valid: peopleInDoubles + singlesCount === totalPeople,
  };
}
