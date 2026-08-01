"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox({ big = false }: { big?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="w-full"
    >
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن مسلسل أو فيلم…"
          className={`w-full rounded-xl bg-surface border border-border outline-none focus:border-accent transition ${
            big ? "px-5 py-4 text-lg" : "px-4 py-2 text-sm"
          } pr-10`}
        />
        <span className={`absolute top-1/2 -translate-y-1/2 right-3 text-muted ${big ? "text-xl" : ""}`}>
          🔍
        </span>
      </div>
    </form>
  );
}
