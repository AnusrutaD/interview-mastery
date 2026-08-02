/**
 * Backfill: move existing `Progress` rows into the Collection model.
 *
 * Strategy is expand → migrate → verify → contract, spread over releases:
 *
 *   1. (this release) Add the new tables. Write the backfill. Leave `Progress`
 *      completely untouched — it stays the source of truth until verified.
 *   2. Point the app at collections, keeping dual-writes if needed.
 *   3. Once confident, a later release drops `Progress`.
 *
 * Nothing here deletes or mutates existing data. Re-running is safe: every
 * write is keyed on a natural identity and skipped if already present, so a
 * partial run can simply be repeated.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-collections.ts --dry-run
 *   npx tsx scripts/migrate-to-collections.ts
 *   npx tsx scripts/migrate-to-collections.ts --user <userId>
 */
import { PrismaClient } from "@prisma/client";
import { PROBLEMS } from "../src/data/problems";
import { dedupeKeyFor } from "../src/core/domain/collection";

const prisma = new PrismaClient();

/** Identifies collections this script created, so re-runs find them again. */
const TEMPLATE_KEY = "neetcode-150";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_USER = args[args.indexOf("--user") + 1] ?? null;

interface Report {
  users: number;
  collectionsCreated: number;
  itemsCreated: number;
  progressCopied: number;
  progressSkipped: number;
  problemsMissing: number;
}

function log(...parts: unknown[]) {
  console.log(DRY_RUN ? "[dry-run]" : "[migrate]", ...parts);
}

async function migrateUser(userId: string, report: Report): Promise<void> {
  const progressRows = await prisma.progress.findMany({ where: { userId } });

  // A user with no DSA history needs no starter collection — creating an empty
  // one for every account would just be noise on their dashboard.
  if (progressRows.length === 0) {
    log(`user ${userId}: no existing progress, skipping`);
    return;
  }

  let collection = await prisma.collection.findFirst({
    where: { userId, templateKey: TEMPLATE_KEY },
  });

  if (!collection) {
    log(`user ${userId}: creating collection`);
    if (!DRY_RUN) {
      collection = await prisma.collection.create({
        data: {
          userId,
          name: "NeetCode 150",
          description: "Curated DSA problem set. Practice and judge on LeetCode.",
          source: "builtin",
          sourceUrl: "https://neetcode.io/practice",
          templateKey: TEMPLATE_KEY,
          // Carry the user's existing global daily goal onto the collection
          // that it actually described.
          dailyTarget:
            (await prisma.user.findUnique({ where: { id: userId }, select: { dailyGoal: true } }))
              ?.dailyGoal ?? 3,
          icon: "⚡",
          position: 0,
        },
      });
    }
    report.collectionsCreated += 1;
  }

  if (DRY_RUN && !collection) {
    // Nothing further can be simulated without a collection id; report and move on.
    report.itemsCreated += PROBLEMS.length;
    report.progressCopied += progressRows.length;
    return;
  }

  const collectionId = collection!.id;

  // ── Items ────────────────────────────────────────────────────────────────
  const existingItems = await prisma.item.findMany({
    where: { collectionId },
    select: { id: true, externalId: true },
  });
  const itemByExternalId = new Map(existingItems.map((i) => [i.externalId, i.id]));

  for (const problem of PROBLEMS) {
    const slug = problem.url.match(/\/problems\/([^/]+)/)?.[1] ?? String(problem.id);
    if (itemByExternalId.has(slug)) continue;

    if (!DRY_RUN) {
      const created = await prisma.item.create({
        data: {
          collectionId,
          title: problem.title,
          url: problem.url,
          kind: "problem",
          externalId: slug,
          dedupeKey: dedupeKeyFor({ externalId: slug, url: problem.url }),
          difficulty: problem.difficulty,
          topic: problem.category,
          position: problem.id,
          // Keep the original catalogue id so briefs and any legacy links can
          // still resolve after the cutover.
          metadata: { legacyProblemId: problem.id, leetcodeNumber: problem.leetcode },
        },
      });
      itemByExternalId.set(slug, created.id);
    }
    report.itemsCreated += 1;
  }

  // ── Progress ─────────────────────────────────────────────────────────────
  const problemById = new Map(PROBLEMS.map((p) => [p.id, p]));

  for (const row of progressRows) {
    const problem = problemById.get(row.problemId);
    if (!problem) {
      // Orphan from the old extension bug that posted LeetCode numbers as ids.
      report.problemsMissing += 1;
      continue;
    }

    const slug = problem.url.match(/\/problems\/([^/]+)/)?.[1] ?? String(problem.id);
    const itemId = itemByExternalId.get(slug);
    if (!itemId) {
      report.problemsMissing += 1;
      continue;
    }

    if (!DRY_RUN) {
      const existing = await prisma.itemProgress.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });
      if (existing) {
        report.progressSkipped += 1;
        continue;
      }

      await prisma.itemProgress.create({
        data: {
          userId,
          itemId,
          mastery: row.mastery,
          notes: row.notes,
          companies: row.companies ?? [],
          repeatCount: row.repeatCount ?? 0,
          totalTimeSeconds: row.totalTimeSeconds ?? 0,
          // `lastMasteryAt` is the old name for the same thing. Fall back to
          // updatedAt for rows written before that column existed, matching
          // what the read path already does.
          lastPracticedAt: row.lastMasteryAt ?? row.updatedAt,
        },
      });
    }
    report.progressCopied += 1;
  }
}

/** Confirms every source row landed, without trusting the counters above. */
async function verify(userId: string): Promise<string[]> {
  const problems = await prisma.progress.count({ where: { userId } });
  const migrated = await prisma.itemProgress.count({
    where: { userId, item: { collection: { templateKey: TEMPLATE_KEY } } },
  });

  const knownIds = new Set(PROBLEMS.map((p) => p.id));
  const orphans = await prisma.progress.findMany({
    where: { userId },
    select: { problemId: true },
  });
  const orphanCount = orphans.filter((o) => !knownIds.has(o.problemId)).length;

  const expected = problems - orphanCount;
  return migrated === expected
    ? []
    : [`user ${userId}: expected ${expected} migrated rows, found ${migrated}`];
}

async function main() {
  const report: Report = {
    users: 0,
    collectionsCreated: 0,
    itemsCreated: 0,
    progressCopied: 0,
    progressSkipped: 0,
    problemsMissing: 0,
  };

  const users = await prisma.user.findMany({
    where: ONLY_USER ? { id: ONLY_USER } : {},
    select: { id: true, email: true },
  });

  log(`found ${users.length} user(s)`);

  for (const user of users) {
    report.users += 1;
    await migrateUser(user.id, report);
  }

  console.log("\n── Summary ──");
  console.table(report);

  if (!DRY_RUN) {
    const problems: string[] = [];
    for (const user of users) problems.push(...(await verify(user.id)));

    if (problems.length > 0) {
      console.error("\n❌ Verification failed:");
      problems.forEach((p) => console.error("  " + p));
      process.exitCode = 1;
    } else {
      console.log("\n✅ Verified: every migratable row is present in ItemProgress.");
      console.log("   `Progress` is untouched and remains the source of truth.");
    }
  } else {
    console.log("\nDry run — nothing was written. Re-run without --dry-run to apply.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
