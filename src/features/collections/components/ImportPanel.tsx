"use client";
import { useMemo, useState } from "react";
import { parseItemList } from "@/core/domain/itemImport";
import { ITEM_KIND_CONFIG } from "@/core/domain/collection";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ImportResponse } from "../api/collection.client";
import { cn } from "@/lib/cn";

const PLACEHOLDER = `Paste one per line — any of these work:

https://leetcode.com/problems/two-sum/
Valid Anagram, https://leetcode.com/problems/valid-anagram/
3Sum | https://leetcode.com/problems/3sum/ | Medium
https://youtu.be/dQw4w9WgXcQ
Design a rate limiter`;

/**
 * Paste-to-import.
 *
 * Parsing runs live on the client purely for preview — the server re-parses the
 * same raw text with the same function, so the two can never disagree about
 * what a paste produces. The preview exists so the user sees what they will get
 * before committing, which is what makes a bulk import feel safe.
 */
export function ImportPanel({
  onImport,
  saving,
}: {
  onImport: (text: string) => Promise<ImportResponse>;
  saving?: boolean;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (text.trim() ? parseItemList(text) : null), [text]);

  const submit = async () => {
    if (!preview || preview.items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await onImport(text));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader title="Add items" className="mb-1" />
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Paste links or titles. Re-importing the same list is safe — anything already here is
        skipped.
      </p>

      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setResult(null);
        }}
        placeholder={PLACEHOLDER}
        rows={7}
        className="w-full text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-700"
      />

      {preview && preview.items.length > 0 && (
        <div className="mt-3 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {preview.items.length} item{preview.items.length === 1 ? "" : "s"} ready
            </span>
            {preview.duplicates > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {preview.duplicates} duplicate{preview.duplicates === 1 ? "" : "s"} collapsed
              </span>
            )}
            {preview.issues.length > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                {preview.issues.length} line{preview.issues.length === 1 ? "" : "s"} skipped
              </span>
            )}
          </div>

          <ul className="max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {preview.items.slice(0, 30).map((item, index) => (
              <li key={`${item.dedupeKey ?? item.title}-${index}`} className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs shrink-0" aria-hidden>
                  {ITEM_KIND_CONFIG[item.kind].icon}
                </span>
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
                  {item.title}
                </span>
                {item.difficulty && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
                    {item.difficulty}
                  </span>
                )}
                {!item.url && (
                  <span className="text-[10px] text-gray-300 dark:text-gray-700 shrink-0">
                    no link
                  </span>
                )}
              </li>
            ))}
            {preview.items.length > 30 && (
              <li className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-600">
                …and {preview.items.length - 30} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Issues carry line numbers so a bad paste is fixable rather than opaque. */}
      {preview && preview.issues.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
            {preview.issues.length} line{preview.issues.length === 1 ? "" : "s"} could not be read
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {preview.issues.slice(0, 10).map((issue) => (
              <li key={issue.line} className="text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-mono text-gray-400 dark:text-gray-600">
                  line {issue.line}
                </span>{" "}
                — {issue.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">
          {error}
        </p>
      )}

      {result && (
        <div
          className={cn(
            "mt-3 px-3 py-2 rounded-xl border text-xs",
            result.added > 0
              ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
          )}
        >
          <strong>{result.added}</strong> added
          {result.skipped > 0 && ` · ${result.skipped} already in this list`}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || saving || !preview || preview.items.length === 0}
        className="mt-3 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg transition-colors"
      >
        {busy
          ? "Importing…"
          : preview && preview.items.length > 0
            ? `Import ${preview.items.length} item${preview.items.length === 1 ? "" : "s"}`
            : "Paste something to import"}
      </button>
    </Card>
  );
}
