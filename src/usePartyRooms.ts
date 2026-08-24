import { useCallback, useEffect, useMemo, useState } from "react";
import { assignNearbyPartyRooms, partyPeopleAndRooms } from "./assignNearbyRooms";
import { getAvailableRooms } from "./roomAvailability";
import type { DepartureMeal, GuestStay, Room } from "./types";
import {
  emptyOccupant,
  pruneOccupants,
  type OccupantMap,
} from "./partyStay";

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function selectionFitsLayout(
  ids: string[],
  layout: ReturnType<typeof partyPeopleAndRooms>,
  available: Room[],
  shortage: number,
): boolean {
  if (!layout.valid || shortage > 0) return false;
  if (ids.length !== layout.roomsNeeded) return false;
  const byId = new Map(available.map((r) => [r.id, r]));
  const selected = ids.map((id) => byId.get(id)).filter(Boolean) as Room[];
  if (selected.length !== ids.length) return false;
  const doubles = selected.filter((r) => r.bedType === "double").length;
  return doubles >= layout.couplesCount;
}

export function usePartyRooms(opts: {
  enabled: boolean;
  stays: GuestStay[];
  excludeStayId?: string;
  checkIn: string;
  checkOut: string;
  totalPeople: number;
  couplesCount: number;
  initialRoomIds?: string[];
  initialOccupants?: OccupantMap;
  departureMeal?: DepartureMeal;
}) {
  const {
    enabled,
    stays,
    excludeStayId,
    checkIn,
    checkOut,
    totalPeople,
    couplesCount,
    initialRoomIds = [],
    initialOccupants = {},
    departureMeal,
  } = opts;

  const datesValid = checkOut > checkIn;
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(initialRoomIds);
  const [occupants, setOccupants] = useState<OccupantMap>(initialOccupants);

  const partyLayout = useMemo(
    () => partyPeopleAndRooms(Math.max(0, totalPeople), couplesCount),
    [totalPeople, couplesCount],
  );

  const partyAvailableRooms = useMemo(
    () =>
      enabled && datesValid
        ? getAvailableRooms(stays, checkIn, checkOut, excludeStayId, undefined, departureMeal)
        : [],
    [enabled, datesValid, stays, checkIn, checkOut, excludeStayId, departureMeal],
  );

  const partyPlan = useMemo(() => {
    if (!enabled || !datesValid || totalPeople < 2 || !partyLayout.valid) return null;
    return assignNearbyPartyRooms(
      stays,
      checkIn,
      checkOut,
      partyLayout.couplesCount,
      partyLayout.singlesCount,
      excludeStayId,
      departureMeal,
    );
  }, [
    enabled,
    datesValid,
    totalPeople,
    stays,
    checkIn,
    checkOut,
    partyLayout.valid,
    partyLayout.couplesCount,
    partyLayout.singlesCount,
    excludeStayId,
    departureMeal,
  ]);

  useEffect(() => {
    if (!enabled || totalPeople < 2 || !partyLayout.valid) {
      setSelectedRoomIds((prev) => (prev.length ? [] : prev));
      return;
    }
    const allowed = new Set(partyAvailableRooms.map((r) => r.id));
    const planIds = partyPlan?.roomIds ?? [];
    const shortage = partyPlan?.roomsShortage ?? 1;

    setSelectedRoomIds((prev) => {
      const kept = prev.filter((id) => allowed.has(id));
      if (selectionFitsLayout(kept, partyLayout, partyAvailableRooms, shortage)) {
        return sameIds(kept, prev) ? prev : kept;
      }
      const next = planIds.filter((id) => allowed.has(id));
      return sameIds(next, prev) ? prev : next;
    });
  }, [enabled, totalPeople, partyLayout, partyAvailableRooms, partyPlan]);

  useEffect(() => {
    setOccupants((prev) => pruneOccupants(prev, selectedRoomIds));
  }, [selectedRoomIds]);

  const replaceRoom = useCallback((oldId: string, newId: string) => {
    if (!newId || oldId === newId) return;
    setSelectedRoomIds((prev) => prev.map((id) => (id === oldId ? newId : id)));
    setOccupants((prev) => {
      const next = { ...prev };
      next[newId] = prev[oldId] ?? emptyOccupant();
      delete next[oldId];
      return next;
    });
  }, []);

  const replan = useCallback(() => {
    setSelectedRoomIds(partyPlan?.roomIds ?? []);
  }, [partyPlan]);

  const reset = useCallback(() => {
    setSelectedRoomIds([]);
    setOccupants({});
  }, []);

  const shortage =
    !enabled || totalPeople < 2
      ? 0
      : partyPlan == null
        ? partyLayout.roomsNeeded
        : partyPlan.roomsShortage;
  const partySelectionOk =
    enabled &&
    totalPeople >= 2 &&
    partyLayout.valid &&
    selectionFitsLayout(selectedRoomIds, partyLayout, partyAvailableRooms, shortage);

  return {
    datesValid,
    partyLayout,
    partyPlan,
    partyAvailableRooms,
    selectedRoomIds,
    occupants,
    setOccupants,
    partySelectionOk,
    shortage,
    replaceRoom,
    replan,
    reset,
  };
}
