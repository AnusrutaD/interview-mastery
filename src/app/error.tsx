"use client";
import { useEffect } from "react";

/** Route-level error boundary — the app previously had none. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-3" aria-hidden>⚠️</p>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
