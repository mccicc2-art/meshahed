export default function Loading() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="skeleton h-8 w-32 rounded" />
      <div className="skeleton h-12 w-full rounded-xl" />
      <div className="skeleton h-5 w-40 rounded" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton w-14 h-14 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="skeleton h-32 rounded-xl" />
      ))}
    </div>
  );
}
