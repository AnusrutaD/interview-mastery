"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SOURCE_CONFIG } from "@/core/domain/collection";
import { summariseTarget, toTarget } from "@/core/domain/target";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import type { CollectionSummary } from "@/server/services/collection.service";
import { createCollection, fetchCollections } from "@/features/collections/api/collection.client";
import { cn } from "@/lib/cn";

export default function CollectionsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetchCollections()
      .then(setCollections)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    if (status === "loading") return;
    load();
  }, [status, load]);

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const collection = await createCollection({ name });
      // Straight into the new list — an empty collection with no obvious next
      // step is where this kind of tool usually loses people.
      router.push(`/collections/${collection.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list");
      setCreating(false);
    }
  }, [newName, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/"
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"
          >
            ← Back to tracks
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">My Lists</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Bring any problem set, playlist or reading list. Track progress, set a daily target
            and let spaced repetition bring things back.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-xs text-red-700 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <Card className="mb-5">
          <label
            htmlFor="new-list"
            className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2"
          >
            New list
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              id="new-list"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void create()}
              placeholder="Striver's SDE Sheet, Neetcode Blind 75, DP playlist…"
              disabled={status !== "authenticated"}
              className="flex-1 min-w-52 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={!newName.trim() || creating || status !== "authenticated"}
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </Card>

        {status !== "authenticated" && status !== "loading" ? (
          <Card padded={false}>
            <EmptyState
              icon="🔒"
              title="Sign in to create lists"
              action={
                <Link href="/login" className="text-sm text-blue-500 hover:underline">
                  Sign in →
                </Link>
              }
            />
          </Card>
        ) : loading ? (
          <Spinner label="Loading your lists" />
        ) : collections.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="📚"
              title="No lists yet"
              hint="Create one above, then paste in links from anywhere."
            />
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionCard({ collection }: { collection: CollectionSummary }) {
  const source = SOURCE_CONFIG[collection.source];
  // Read through to the legacy column so lists created before periods existed
  // still show their target on the card.
  const target = toTarget({
    period: collection.targetPeriod,
    unit: collection.targetUnit,
    value: collection.targetValue ?? collection.dailyTarget,
  });
  const percent = collection.itemCount
    ? Math.round((collection.completedCount / collection.itemCount) * 100)
    : 0;

  return (
    <Link href={`/collections/${collection.id}`} className="block group">
      <Card className="h-full group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-colors">
        <div className="flex items-start gap-2.5 mb-3">
          <span className="text-xl shrink-0" aria-hidden>
            {collection.icon || source.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {collection.name}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {collection.itemCount} item{collection.itemCount === 1 ? "" : "s"}
              {target ? ` · ${summariseTarget(target)}` : ""}
            </p>
          </div>
          {percent === 100 && collection.itemCount > 0 && (
            <span className="text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full shrink-0">
              ✓ Done
            </span>
          )}
        </div>

        {collection.itemCount > 0 ? (
          <>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500 dark:text-gray-400">
                {collection.completedCount} / {collection.itemCount}
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{percent}%</span>
            </div>
            <ProgressBar value={collection.completedCount} max={collection.itemCount} />
          </>
        ) : (
          <p className={cn("text-xs text-gray-400 dark:text-gray-600")}>
            Empty — open to add items
          </p>
        )}
      </Card>
    </Link>
  );
}
