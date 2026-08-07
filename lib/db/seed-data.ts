// Seed data per spec §4.3. Pure data — kept separate from the transactional
// insert logic in seed.ts so it can be reused by the first-run setup wizard
// and by the standalone `npm run db:seed` script.

export interface SeedServiceInput {
  name: string;
  category: string;
  pricingType: "fixed" | "per_head" | "per_hour" | "per_unit";
  ratePaisa: number;
  /** System services configure the venue rather than being picked per booking. */
  isSystem?: boolean;
  menuItems?: { name: string; type: string }[];
}

const rs = (rupees: number) => rupees * 100;

/** The venue-rental service. Its rate is the default hall rent on a new booking. */
export const HALL_RENT_SERVICE_NAME = "Hall Rent";
export const HALL_RENT_SERVICE_CATEGORY = "venue";

export const SEED_SERVICES: SeedServiceInput[] = [
  {
    // First in the list because it is the first line of every booking. Rate is
    // a starting point — the venue edits it under Services, and it stays
    // editable per booking for negotiated deals.
    name: HALL_RENT_SERVICE_NAME,
    category: HALL_RENT_SERVICE_CATEGORY,
    pricingType: "fixed",
    ratePaisa: rs(100000),
    isSystem: true,
  },
  {
    name: "Catering (per head)",
    category: "catering",
    pricingType: "per_head",
    ratePaisa: rs(1800),
    menuItems: [
      { name: "Chicken Boti", type: "starter" },
      { name: "Malai Boti", type: "starter" },
      { name: "Seekh Kebab", type: "starter" },
      { name: "Chapli Kebab", type: "starter" },
      { name: "Fish Tikka", type: "starter" },
      { name: "Dahi Bhalla", type: "starter" },

      { name: "Chicken Karahi", type: "main" },
      { name: "Mutton Karahi", type: "main" },
      { name: "Chicken Handi", type: "main" },
      { name: "Nihari", type: "main" },
      { name: "Haleem", type: "main" },
      { name: "Mutton Qorma", type: "main" },
      { name: "Chicken Ginger", type: "main" },
      { name: "Daal Makhani", type: "main" },

      { name: "Chicken Biryani", type: "rice" },
      { name: "Mutton Biryani", type: "rice" },
      { name: "Beef Pulao", type: "rice" },
      { name: "Kabuli Pulao", type: "rice" },
      { name: "Zarda", type: "rice" },

      { name: "Malai Tikka", type: "bbq" },
      { name: "Reshmi Kebab", type: "bbq" },
      { name: "Bihari Boti", type: "bbq" },
      { name: "Tandoori Chicken", type: "bbq" },
      { name: "Gola Kebab", type: "bbq" },

      { name: "Naan", type: "bread" },
      { name: "Roghni Naan", type: "bread" },
      { name: "Kulcha", type: "bread" },
      { name: "Sheermal", type: "bread" },
      { name: "Roti", type: "bread" },
      { name: "Taftan", type: "bread" },

      { name: "Raita", type: "side" },
      { name: "Salad", type: "side" },
      { name: "Mint Chutney", type: "side" },
      { name: "Achar", type: "side" },
      { name: "Kachumar", type: "side" },
      { name: "Papad", type: "side" },

      { name: "Gulab Jamun", type: "dessert" },
      { name: "Kheer", type: "dessert" },
      { name: "Ras Malai", type: "dessert" },
      { name: "Gajar Halwa", type: "dessert" },
      { name: "Firni", type: "dessert" },
      { name: "Ice Cream", type: "dessert" },
      { name: "Shahi Tukray", type: "dessert" },

      { name: "Soft Drinks", type: "drink" },
      { name: "Mineral Water", type: "drink" },
      { name: "Kashmiri Chai", type: "drink" },
      { name: "Sweet Lassi", type: "drink" },
      { name: "Fresh Lime", type: "drink" },
      { name: "Rooh Afza", type: "drink" },
      { name: "Green Tea", type: "drink" },
    ],
  },
  { name: "Basic Sound System", category: "sound", pricingType: "fixed", ratePaisa: rs(25000) },
  { name: "Premium Sound System", category: "sound", pricingType: "fixed", ratePaisa: rs(45000) },
  { name: "Entry Lights", category: "lighting", pricingType: "fixed", ratePaisa: rs(30000) },
  { name: "Complete Entry Setup", category: "entry", pricingType: "fixed", ratePaisa: rs(65000) },
  { name: "Stage Decor", category: "decor", pricingType: "fixed", ratePaisa: rs(55000) },
  { name: "Flower Decoration", category: "decor", pricingType: "fixed", ratePaisa: rs(35000) },
  { name: "Photography", category: "photography", pricingType: "fixed", ratePaisa: rs(60000) },
  { name: "Videography", category: "photography", pricingType: "fixed", ratePaisa: rs(80000) },
  { name: "Extra AC Units", category: "misc", pricingType: "per_unit", ratePaisa: rs(8000) },
  { name: "Generator Backup", category: "misc", pricingType: "fixed", ratePaisa: rs(20000) },
  { name: "Valet Parking", category: "misc", pricingType: "fixed", ratePaisa: rs(15000) },
];

export const SEED_DEFAULT_TAX = {
  name: "Punjab Sales Tax",
  type: "sales_tax" as const,
  rateBps: 1600,
  isDefault: true,
};

export const SEED_SETTINGS_DEFAULTS: Record<string, string> = {
  invoice_prefix: JSON.stringify("INV"),
  receipt_prefix: JSON.stringify("RCP"),
  quote_prefix: JSON.stringify("QTN"),
  due_date_offset_days: JSON.stringify(2),
  hold_default_days: JSON.stringify(7),
  quote_validity_days: JSON.stringify(14),
  idle_logout_minutes: JSON.stringify(30),
  recycle_retention_days: JSON.stringify(30),
  event_types: JSON.stringify([
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
  ]),
  slots: JSON.stringify({
    day: { label: "Day", start: "12:00", end: "17:00" },
    night: { label: "Night", start: "19:00", end: "00:00" },
  }),
  tax_on_discounted: JSON.stringify(true),
};
