/**
 * One-time seed from PRD §9. Run after applying the migration:
 *
 *   npm run seed
 *
 * Uses the service-role key from .env.local (never shipped to the client).
 * Refuses to run against a non-empty tasks table.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

type Seed = {
  kind: "recurring" | "project";
  name: string;
  category: string;
  steps?: string[];
  base_interval_days?: number;
  seasonal_overrides?: { months: number[]; interval_days: number }[];
  active_months?: number[];
  est_minutes?: number | null;
  last_completed_at?: string | null;
  priority?: "next" | "soon" | "someday";
  location?: string;
  materials?: string;
  notes?: string;
};

const r = (
  name: string,
  category: string,
  base_interval_days: number,
  est_minutes: number,
  steps: string[],
  extra: Partial<Seed> = {}
): Seed => ({
  kind: "recurring",
  name,
  category,
  base_interval_days,
  est_minutes,
  steps,
  ...extra,
});

// §9.8 — monthly tasks spread across 5, 12, 19, 26 days ago
const monthlyStagger = [5, 12, 19, 26];
let monthlyIdx = 0;
const monthly = (
  name: string,
  category: string,
  est: number,
  steps: string[]
) =>
  r(name, category, 30, est, steps, {
    last_completed_at: daysAgo(monthlyStagger[monthlyIdx++ % 4]),
  });

const quarterlyPlus = (
  name: string,
  category: string,
  interval: number,
  est: number,
  steps: string[],
  extra: Partial<Seed> = {}
) =>
  r(name, category, interval, est, steps, {
    last_completed_at: daysAgo(30),
    ...extra,
  });

const p = (
  name: string,
  priority: "next" | "soon" | "someday",
  est: number | null,
  extra: Partial<Seed> = {}
): Seed => ({
  kind: "project",
  name,
  category: "living",
  steps: [],
  priority,
  est_minutes: est,
  ...extra,
});

const tasks: Seed[] = [
  // §9.1 weekly
  r("Bathroom clean", "bathroom", 7, 30, [
    "Toilet (bowl, seat, exterior)",
    "Sink and faucet",
    "Mirror",
    "Mop floor",
    "Quick tub wipe",
  ], { last_completed_at: daysAgo(6) }),
  r("Kitchen reset", "kitchen", 7, 25, [
    "Cabinet fronts",
    "Microwave in/out",
    "Backsplash tile and grout check",
    "Range hood exterior",
    "Sink deep clean with BLANCOCLEAN",
  ], { last_completed_at: daysAgo(4) }),
  r("Floors", "living", 7, 20, [
    "Vacuum all rooms — living, kitchen, bedroom, office, hall",
  ], { last_completed_at: daysAgo(2) }),
  r("Front yard walk", "exterior", 7, 10, [
    "Rain garden spot check",
    "Walkway debris",
    "Raised bed glance",
  ], { last_completed_at: daysAgo(5) }),

  // §9.2 biweekly
  r("Bed and linens", "bedroom", 14, 15, [
    "Strip and change sheets",
    "Wash sheets and towels together",
  ], { last_completed_at: daysAgo(10) }),
  r("Dust circuit", "living", 14, 25, [
    "Bedroom surfaces",
    "Office surfaces",
    "Living room shelves and sills",
    "Couch vacuum every other pass",
  ], { last_completed_at: daysAgo(3) }),

  // §9.3 monthly (staggered 5 / 12 / 19 / 26 days ago)
  monthly("Deep floors", "living", 40, [
    "Damp mop hardwoods with Bona-safe cleaner only",
    "Wipe baseboards",
  ]),
  monthly("Kitchen deep", "kitchen", 45, [
    "Dishwasher filter and door seal",
    "Range hood grease filter degrease",
    "Fridge door seals and shelves",
    "Air fryer baskets",
    "Wipe countertop appliances",
  ]),
  monthly("Tub scrub", "bathroom", 20, [
    "Full bathtub scrub",
    "Grout and tile inspection",
  ]),
  monthly("Laundry room", "laundry", 15, [
    "Washer self-clean cycle",
    "Dryer lint trap housing",
    "Wipe exteriors",
  ]),

  // §9.4 seasonal
  r("Mow and yard", "exterior", 30, 60, [
    "Mow backyard",
    "Weed raised bed",
    "Rain garden walk for debris and invasives",
    "Gutter glance",
  ], {
    seasonal_overrides: [{ months: [4, 5, 6, 7, 8, 9], interval_days: 10 }],
    last_completed_at: daysAgo(8),
  }),
  r("Rain garden water", "exterior", 4, 15, [
    "Deep water native plantings — first full establishment summer, critical through 2026",
  ], {
    active_months: [6, 7, 8, 9],
    last_completed_at: daysAgo(3),
  }),
  r("Rain garden prune", "exterior", 180, 45, [
    "Deadhead, shape, remove crossing growth",
  ], {
    notes: "Feb and Sep passes",
    last_completed_at: daysAgo(30),
  }),

  // §9.5 quarterly and semi-annual (all 30 days ago)
  quarterlyPlus("Mini-split filter", "systems", 90, 15, [
    "Pull and rinse filters on Mitsubishi MUZ-GE12NA",
    "Tighten to 60 days during heavy cooling use",
  ]),
  quarterlyPlus("Baseboard heater dust", "systems", 180, 20, [
    "Vacuum fins on Cadet units, bedrooms",
  ]),
  quarterlyPlus("Fridge coils", "kitchen", 180, 30, [
    "Pull unit, vacuum condenser coils",
  ]),
  quarterlyPlus("Fridge water filter", "kitchen", 180, 10, [
    "Replace internal dispenser filter",
  ]),
  quarterlyPlus("Oven deep clean", "kitchen", 90, 45, [
    "Self-clean cycle on GE Profile wall oven",
    "Door glass",
  ]),
  quarterlyPlus("Crawl space check", "systems", 180, 20, [
    "Vapor barrier condition, pooling, tears, displacement",
  ]),
  quarterlyPlus("Detectors and extinguisher", "systems", 180, 20, [
    "Test all smoke and CO detectors",
    "Replace batteries",
    "Check kitchen extinguisher gauge",
  ]),
  quarterlyPlus("Water heater flush", "systems", 180, 60, [
    "Drain sediment — aging tank unit, sediment is the failure mode",
  ]),
  quarterlyPlus("Washer hoses", "laundry", 180, 10, [
    "Inspect for cracking or bulging",
  ]),
  quarterlyPlus("Roof and gutters", "exterior", 180, 30, [
    "Ground-level roof scan for lifted shingles and moss",
    "Clear debris around gutter brush guards",
    "Schedule the September pass before fall rains",
  ]),
  quarterlyPlus("Walkway inspect", "exterior", 90, 20, [
    "Flagstone shifting, sand erosion, weed intrusion",
  ]),

  // §9.6 annual (30 days ago)
  quarterlyPlus("Mini-split service", "systems", 365, 90, [
    "Professional service call, Mitsubishi",
  ]),
  quarterlyPlus("Exterior caulk audit", "exterior", 365, 60, [
    "Windows, penetrations, door frames — schedule September",
  ]),
  quarterlyPlus("Weatherstripping", "exterior", 365, 30, [
    "Doors and windows before wet season",
  ]),
  quarterlyPlus("Cedar inspection", "exterior", 365, 30, [
    "Western Red Cedar — deadwood, structural concerns",
  ]),
  quarterlyPlus("Insurance review", "admin", 365, 30, [
    "Connect / American Family — confirm dwelling coverage reflects post-renovation value",
  ]),
  quarterlyPlus("Property tax review", "admin", 365, 30, [
    "Review assessment notice",
  ]),
  quarterlyPlus("Records and receipts", "admin", 365, 60, [
    "Compile renovation receipts for cost basis",
  ]),

  // §9.7 projects
  p("Caulk back door frame bottom", "next", 60, {
    location: "Back door",
    materials: "Exterior paintable caulk",
    category: "exterior",
  }),
  p("Caulk front storm door upper edge", "next", 30, {
    location: "Front storm door",
    materials: "Exterior paintable caulk",
    category: "exterior",
  }),
  p("Fix rear exterior outlet", "next", 60, {
    location: "Rear exterior",
    materials: "Possible GFCI replacement, weatherproof in-use cover",
    category: "exterior",
  }),
  p("Fix baseboard, NE corner", "soon", 45, {
    location: "Office",
    materials:
      "Finish nails, wood filler, SW 6119 Antique White in Emerald Urethane semi-gloss",
    category: "living",
  }),
  p("Touch up paint above kitchen table", "soon", 30, {
    location: "Kitchen, between window and fir post",
    materials: "SW 6119 Antique White, SuperPaint velvet",
    category: "kitchen",
  }),
  p("Hang pictures in bedroom", "soon", 90, {
    location: "Bedroom",
    materials: "Picture hooks, level, stud finder",
    category: "bedroom",
  }),
  p("Hang pictures in office", "soon", 90, {
    location: "Office",
    materials: "Picture hooks, level, stud finder",
    category: "living",
  }),
  p("Finish macrame wall hanging", "someday", 120),
  p("Select living room rug", "someday", null, {
    location: "Living room",
  }),
];

async function main() {
  const { count, error: countErr } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });
  if (countErr) {
    console.error("Could not check tasks table:", countErr.message);
    console.error("Did you run supabase/migrations/0001_init.sql first?");
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error(
      `tasks table already has ${count} rows — refusing to seed twice.`
    );
    process.exit(1);
  }

  const { error } = await supabase.from("tasks").insert(tasks);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${tasks.length} tasks.`);
  console.log(
    "First open should show a manageable set: a few due, a couple coming up, the backlog visible."
  );
}

main();
