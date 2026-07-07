import type { Room, Zone } from "../types";

const DOUBLE_NUMBERS = new Set([
  112, 212, 213, 214, 215, 216, 217, 118, 136, 218, 236,
]);

function bedTypeFor(number: number): "single" | "double" {
  return DOUBLE_NUMBERS.has(number) ? "double" : "single";
}

function rangeRooms(
  from: number,
  to: number,
  zone: Zone,
  floor: 1 | 2,
  zoneLabel: string,
): Room[] {
  const rooms: Room[] = [];
  for (let num = from; num <= to; num++) {
    const bedType = bedTypeFor(num);
    rooms.push({
      id: String(num),
      label: `${zoneLabel} · P${floor} · ${num}${bedType === "double" ? " (doppia)" : ""}`,
      zone,
      floor,
      number: num,
      bedType,
    });
  }
  return rooms;
}

/** 106: extra (camera ampia), fisicamente in Vecchia P1 — singola */
const EXTRA_ROOM: Room = {
  id: "106",
  label: "Vecchia · P1 · Extra 106",
  zone: "vecchia",
  floor: 1,
  number: 106,
  bedType: "single",
  large: true,
};

/** Vecchia P1: 106 + 112–117 · P2: 212–217 · Nuova P1: 118–136 · P2: 218–236 */
export const ROOMS: Room[] = [
  EXTRA_ROOM,
  ...rangeRooms(112, 117, "vecchia", 1, "Vecchia"),
  ...rangeRooms(212, 217, "vecchia", 2, "Vecchia"),
  ...rangeRooms(118, 136, "nuova", 1, "Nuova"),
  ...rangeRooms(218, 236, "nuova", 2, "Nuova"),
];

export const DOUBLE_ROOM_IDS = new Set(
  ROOMS.filter((r) => r.bedType === "double").map((r) => r.id),
);

/** Migrazione ID camere del prototipo iniziale → numerazione reale */
export const LEGACY_ROOM_ID_MAP: Record<string, string> = {
  "v1-1": "112",
  "v1-2": "113",
  "v1-3": "114",
  "v1-4": "115",
  "v1-5": "116",
  "v1-6": "117",
  "v2-1": "212",
  "v2-2": "213",
  "v2-3": "214",
  "v2-4": "215",
  "v2-5": "216",
  "v2-6": "217",
  "n1-1": "118",
  "n1-2": "119",
  "n1-3": "120",
  "n1-4": "121",
  "n1-5": "122",
  "n1-6": "123",
  "n1-7": "124",
  "n1-8": "125",
  "n1-9": "126",
  "n1-10": "127",
  "n1-11": "128",
  "n1-12": "129",
  "n1-13": "130",
  "n1-14": "131",
  "n1-15": "132",
  "n1-16": "133",
  "n1-17": "134",
  "n1-18": "135",
  "n1-19": "136",
  "n2-1": "218",
  "n2-2": "219",
  "n2-3": "220",
  "n2-4": "221",
  "n2-5": "222",
  "n2-6": "223",
  "n2-7": "224",
  "n2-8": "225",
  "n2-9": "226",
  "n2-10": "227",
  "n2-11": "228",
  "n2-12": "229",
  "n2-13": "230",
  "n2-14": "231",
  "n2-15": "232",
  "n2-16": "233",
  "n2-17": "234",
  "n2-18": "235",
  "n2-19": "236",
  extra: "106",
};

export function normalizeRoomId(roomId: string): string {
  return LEGACY_ROOM_ID_MAP[roomId] ?? roomId;
}

export type RoomSectionId = "vecchia-p1" | "vecchia-p2" | "nuova-p1" | "nuova-p2";

export const ROOM_SECTIONS: {
  id: RoomSectionId;
  title: string;
  range: string;
  filter: (r: Room) => boolean;
}[] = [
  {
    id: "vecchia-p1",
    title: "Vecchia · P1",
    range: "106 (extra), 112–117",
    filter: (r) => r.zone === "vecchia" && r.floor === 1,
  },
  {
    id: "vecchia-p2",
    title: "Vecchia · P2",
    range: "212–217",
    filter: (r) => r.zone === "vecchia" && r.floor === 2,
  },
  {
    id: "nuova-p1",
    title: "Nuova · P1",
    range: "118–136",
    filter: (r) => r.zone === "nuova" && r.floor === 1,
  },
  {
    id: "nuova-p2",
    title: "Nuova · P2",
    range: "218–236",
    filter: (r) => r.zone === "nuova" && r.floor === 2,
  },
];
