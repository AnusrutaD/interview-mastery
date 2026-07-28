import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Spinner />
    </div>
  );
}
