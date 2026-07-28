export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div className="w-6 h-6 border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
