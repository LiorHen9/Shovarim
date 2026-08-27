// Manual verification for the account-deletion sweep (docs/DECISIONS.md #24,
// docs/ROADMAP.md Phase 4.2). Imports the actual functions/src code (not a
// copy) — tsx ignores functions/tsconfig.json's rootDir restriction (a
// tsc-emit-only constraint), so this exercises the same code that runs in
// production. Run with:
//   npm run sweep:account-deletions -- <uid>       (deletes uid immediately, ignoring the grace period)
//   npm run sweep:account-deletions                (real sweep: deletes anyone whose grace period has already elapsed)
import { deleteUserAccount, sweepExpiredAccountDeletions } from "../functions/src/accountDeletion";

async function main() {
  const [, , uid] = process.argv;

  if (uid) {
    await deleteUserAccount(uid);
    console.log(`Deleted account ${uid}.`);
    return;
  }

  const { processed, failed } = await sweepExpiredAccountDeletions(new Date());
  console.log(`Account deletion sweep: ${processed} deleted, ${failed} failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
