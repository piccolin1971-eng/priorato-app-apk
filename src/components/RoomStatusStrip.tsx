import { useMemo } from "react";
import type { GuestStay } from "../types";
import { getDayBedStats } from "../roomAvailability";
import { formatDateIt } from "../utils";

type Props = {
  stays: GuestStay[];
  day: string;
};

export function RoomStatusStrip({ stays, day }: Props) {
  const stats = useMemo(() => getDayBedStats(stays, day), [stays, day]);
  const label = `Camere al ${formatDateIt(day)}`;

  return (
    <div className="room-status" aria-label={label} title={label}>
      <span className="room-status-occ">
        Occupate {stats.occSingle} singole / {stats.occDouble} doppie
      </span>
      <span className="room-status-free">
        Libere {stats.freeSingle} singole / {stats.freeDouble} doppie
      </span>
    </div>
  );
}
