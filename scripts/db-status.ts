/**
 * Read-only diagnostic: what is actually in the database this shell points at?
 *
 * Exists because a migration reporting "0 users" has two very different causes
 * — an empty database, or the right script aimed at the wrong database — and
 * guessing between them risks running a backfill against the wrong target.
 *
 * Writes nothing.
 *
 * Usage:
 *   npm run db:status
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Expected it in .env.local.");
  process.exit(1);
}

const prisma = new PrismaClient();

/** Host and database name only — never the password. */
function describeTarget(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  console.log(`\nConnected to: ${describeTarget(process.env.DATABASE_URL!)}\n`);

  const [users, accounts, progress, collections, items, itemProgress, studyProgress] =
    await Promise.all([
      prisma.user.count(),
      prisma.account.count().catch(() => -1),
      prisma.progress.count(),
      prisma.collection.count(),
      prisma.item.count(),
      prisma.itemProgress.count(),
      prisma.studyProgress.count().catch(() => -1),
    ]);

  console.table({
    User: users,
    Account: accounts,
    Progress: progress,
    StudyProgress: studyProgress,
    Collection: collections,
    Item: items,
    ItemProgress: itemProgress,
  });

  // Per-collection breakdown: the totals alone cannot distinguish "the backfill
  // already ran" from "these numbers happen to coincide".
  const byCollection = await prisma.collection.findMany({
    select: {
      name: true,
      templateKey: true,
      _count: { select: { items: true } },
    },
    orderBy: { position: "asc" },
  });

  if (byCollection.length > 0) {
    console.log("Collections:");
    for (const c of byCollection) {
      const seeded = c.templateKey ? `  [seeded: ${c.templateKey}]` : "";
      console.log(`   ${c.name} — ${c._count.items} items${seeded}`);
    }
    console.log("");
  }

  const alreadyBackfilled = await prisma.itemProgress.count({
    where: { item: { collection: { templateKey: "neetcode-150" } } },
  });
  if (alreadyBackfilled > 0) {
    console.log(
      `${alreadyBackfilled} ItemProgress row(s) already sit under the seeded\n` +
        `neetcode-150 collection, so the backfill has run before. Re-running is\n` +
        `safe — every write is skipped if already present.\n`
    );
  }

  if (users === 0 && progress === 0) {
    console.log(
      "This database is empty.\n" +
        "If you have been using the deployed app, your data is in the database\n" +
        "Vercel points at — compare DATABASE_URL here against the one in your\n" +
        "Vercel project settings. Do not run the backfill until they match."
    );
  } else if (users === 0 && progress > 0) {
    // Should be impossible: Progress.userId has a foreign key to User.
    console.log(
      "Progress rows exist with no User rows, which the foreign key should\n" +
        "prevent. Worth investigating before migrating anything."
    );
  } else {
    console.log(`${users} user(s) with ${progress} progress row(s). Safe to dry-run the backfill.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
