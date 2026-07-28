import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-4xl mb-3" aria-hidden>🧭</p>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Page not found</h1>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
