import { NewsSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <header className="mb-6" aria-hidden>
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-3 w-72 max-w-full rounded mt-2" />
      </header>
      <NewsSkeleton count={6} />
    </div>
  );
}
