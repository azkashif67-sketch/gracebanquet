import "server-only";
import { db } from "../index";

export interface SlotConfig {
  label: string;
  start: string;
  end: string;
}

export interface VenueSettings {
  venueName: string;
  address: string;
  phone: string;
  invoicePrefix: string;
  halls: string[];
  slots: { day: SlotConfig; night: SlotConfig };
  eventTypes: string[];
  dueDateOffsetDays: number;
  holdDefaultDays: number;
  taxOnDiscounted: boolean;
}

const DEFAULTS: VenueSettings = {
  venueName: "",
  address: "",
  phone: "",
  invoicePrefix: "INV",
  halls: ["Main Hall", "Full Venue"],
  slots: {
    day: { label: "Day", start: "12:00", end: "17:00" },
    night: { label: "Night", start: "19:00", end: "00:00" },
  },
  eventTypes: [
    "wedding",
    "mehndi",
    "walima",
    "barat",
    "engagement",
    "birthday",
    "aqiqah",
    "corporate",
    "seminar",
    "other",
  ],
  dueDateOffsetDays: 2,
  holdDefaultDays: 7,
  taxOnDiscounted: true,
};

export async function getVenueSettings(): Promise<VenueSettings> {
  const rows = await db.query.settings.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parse = <T,>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    venueName: parse("venue_name", DEFAULTS.venueName),
    address: parse("address", DEFAULTS.address),
    phone: parse("phone", DEFAULTS.phone),
    invoicePrefix: parse("invoice_prefix", DEFAULTS.invoicePrefix),
    halls: parse("halls", DEFAULTS.halls),
    slots: parse("slots", DEFAULTS.slots),
    eventTypes: parse("event_types", DEFAULTS.eventTypes),
    dueDateOffsetDays: parse("due_date_offset_days", DEFAULTS.dueDateOffsetDays),
    holdDefaultDays: parse("hold_default_days", DEFAULTS.holdDefaultDays),
    taxOnDiscounted: parse("tax_on_discounted", DEFAULTS.taxOnDiscounted),
  };
}
