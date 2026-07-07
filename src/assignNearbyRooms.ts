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

function orderedSectionKeys(bySection: Map<string, { doubles: Room[]; singles: Room[] }>): string[] {
  const keys = [...bySection.keys()];
  const known = ROOM_SECTIONS.map((sec) => {
    const sample = ROOMS.find(sec.filter);
    return sample ? sectionKey(sample) : null;
  }).filter(Boolean) as string[];
  const inOrder = known.filter((k) => bySection.has(k));
  const extra = keys.filter((k) => !inOrder.includes(k)).sort();
  return [...inOrder, ...extra];
}

function planAcrossSections(
  bySection: Map<string, { doubles: Room[]; singles: Room[] }>,
  couplesCount: number,
  singlesCount: number,
): { rooms: Room[]; keysUsed: string[] } | null {
  let couplesLeft = couplesCount;
  let singlesLeft = singlesCount;
  const chosen: Room[] = [];
  const keysUsed: string[] = [];

  for (const key of orderedSectionKeys(bySection)) {
    if (couplesLeft <= 0 && singlesLeft <= 0) break;
    const section = bySection.get(key);
    if (!section) continue;

    const doubles = [...section.doubles].sort((a, b) => a.number - b.number);
    const singles = [...section.singles].sort((a, b) => a.number - b.number);

    const useDoubles = Math.min(couplesLeft, doubles.length);
    const useSingles = Math.min(singlesLeft, singles.length);
    if (useDoubles === 0 && useSingles === 0) continue;

    chosen.push(...doubles.slice(0, useDoubles), ...singles.slice(0, useSingles));
    keysUsed.push(key);
    couplesLeft -= useDoubles;
    singlesLeft -= useSingles;
  }

  if (couplesLeft > 0 || singlesLeft > 0) return null;
  return { rooms: chosen, keysUsed };
}

export function assignNearbyPartyRooms(
  stays: GuestStay[],
  checkIn: string,
  checkOut: string,
  couplesCount: number,
  singlesCount: number,
  excludeStayId?: string,
): PartyRoomPlan | null {
  const available = getAvailableRooms(stays, checkIn, checkOut, excludeStayId).filter(
    (r) => r.id !== "106",
  );

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

  if (best) {
    return {
      roomIds: best.rooms.map((r) => r.id),
      rooms: best.rooms,
      sectionTitle: sectionTitleFor(best.key),
    };
  }

  const crossSection = planAcrossSections(bySection, couplesCount, singlesCount);
  if (!crossSection) return null;

  return {
    roomIds: crossSection.rooms.map((r) => r.id),
    rooms: crossSection.rooms,
    sectionTitle: crossSection.keysUsed.map(sectionTitleFor).join(" + "),
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
