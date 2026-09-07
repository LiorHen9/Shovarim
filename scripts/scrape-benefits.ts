// Manual runner for the club-benefit scrapers (docs/ROADMAP.md Phase 10.2,
// docs/DECISIONS.md #62). Same shape as scripts/sweep-account-deletions.ts:
// it imports the real functions/src code rather than a copy, since tsx ignores
// functions/tsconfig.json's rootDir (a tsc-emit-only constraint), so this
// exercises exactly what the scheduler runs.
//
//   npm run scrape:benefits            all scrapeable clubs
//   npm run scrape:benefits -- hot     one club
//
// Point it at the emulator (the .env.local defaults) before pointing it at
// production: a run deletes every benefit it did not just write.
import { runAllScrapes, runScrapeForClub } from "../functions/src/benefits/runner";
import { SCRAPEABLE_CLUB_IDS } from "../functions/src/benefits/registry";
import { db } from "../functions/src/firebaseAdmin";

async function main() {
  const [, , clubId] = process.argv;

  const outcomes = clubId
    ? [await runScrapeForClub(db, clubId, "script")]
    : await runAllScrapes(db, "script");

  if (clubId && !SCRAPEABLE_CLUB_IDS.includes(clubId)) {
    console.warn(`Note: "${clubId}" has no adapter. Scrapeable: ${SCRAPEABLE_CLUB_IDS.join(", ")}`);
  }

  for (const outcome of outcomes) {
    console.log(
      `${outcome.clubId}: ${outcome.status} — ${outcome.written} written, ${outcome.deleted} swept` +
        (outcome.abortReason ? `\n  ${outcome.abortReason}` : "")
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
