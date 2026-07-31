// CLI entrypoint: `npm run db:seed`. Seeds a fresh dev database directly,
// without going through the first-run setup wizard (which also creates the
// admin account and venue settings). Useful when iterating on migrations
// locally.
import { db } from "./index";
import { seedInitialData } from "./seed";

async function main() {
  await db.transaction((tx) => seedInitialData(tx));
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
