export type BoardType = "bb" | "half_lunch" | "half_dinner" | "full";

export type Zone = "vecchia" | "nuova";

export type BedType = "single" | "double";

export type IntoleranceTypeId =
  | "glutine"
  | "lattosio"
  | "uova"
  | "frutta_secca"
  | "pesce"
  | "altro";

export type IntoleranceCounts = Partial<Record<IntoleranceTypeId, number>>;

/** Arrivo: per pranzo o per cena. */
export type ArrivalMeal = "lunch" | "dinner";

/** Partenza: dopo colazione, pranzo o cena. */
export type DepartureMeal = "after_breakfast" | "after_lunch" | "after_dinner";

export interface Room {
  id: string;
  label: string;
  zone: Zone;
  floor: 1 | 2;
  number: number;
  bedType: BedType;
  /** Camera fuori schema standard (es. 106, più ampia). */
  large?: boolean;
}

export interface GroupInfo {
  name: string;
  leaderName: string;
  leaderPhone?: string;
  participants?: {
    name: string;
    roomId: string;
    roomType?: "single" | "double";
    inRoomWith?: string;
    intolerances?: string;
  }[];
}

export type RegistrationKind = "single" | "double" | "party" | "group";

export interface GuestStay {
  id: string;
  guestName: string;
  /** Secondo ospite in camera doppia (2 persone, 1 camera). */
  secondGuestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  /** Camera principale (compatibilità) — prima di roomIds. */
  roomId: string;
  /** Tutte le camere occupate da questa registrazione. */
  roomIds?: string[];
  /** Persone totali per pasti e conteggi (default 1). */
  personCount?: number;
  kind?: RegistrationKind;
  checkIn: string;
  checkOut: string;
  board: BoardType;
  lunch: boolean;
  dinner: boolean;
  /** Testo libero (singoli/doppie o note aggiuntive). */
  intolerances: string;
  /** Conteggi per tipo (party/gruppi). */
  intoleranceCounts?: IntoleranceCounts;
  arrivalMeal?: ArrivalMeal;
  departureMeal?: DepartureMeal;
  notes: string;
  group?: GroupInfo;
  createdAt: string;
  /** Nome postazione alla registrazione (es. Portineria). */
  registeredByDevice?: string;
  updatedAt?: string;
  lastModifiedByDevice?: string;
}

export type TabId =
  | "home"
  | "oggi"
  | "registra"
  | "camere"
  | "pianificazione"
  | "stampa"
  | "impostazioni";
