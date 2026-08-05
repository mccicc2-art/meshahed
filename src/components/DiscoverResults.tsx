"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PosterGrid } from "./PosterGrid";
import { PosterCard } from "./PosterCard";
import { flashError } from "@/lib/toast";
import type { BrowseItem, BrowseSort, BrowseType } from "@/lib/browse";

/**
 * شبكة نتائج التصفّح مع تحميلٍ متدرّج.
 *
 * الصفحة الأولى تصل مرسومةً من الخادم — يراها القارئ بلا طلبٍ ثانٍ —
 * وما بعدها يُضاف هنا. المراقب يبدأ التحميل قبل الوصول إلى القاع بـ٦٠٠
 * بكسل فلا يرى المستخدم فراغاً ينتظر ملأه.
 *
 * والزرّ يبقى مرسوماً رغم التحميل التلقائي: من يتنقّل بلوحة المفاتيح لا
 * يُطلق مراقب التقاطع، وفشلُ الشبكة يحتاج طريقاً للإعادة. وعند الفشل
 * يتوقّف التحميل التلقائي حتى يطلبه المستخدم صراحةً — وإلا صار المراقب
 * يعيد نفس الطلب الفاشل كلّما تحرّكت الشاشة.
 */
export function DiscoverResults({
  initial,
  hasMore,
  query,
  labels,
}: {
  initial: BrowseItem[];
  hasMore: boolean;
  query: { type: BrowseType; g: string | null; sort: BrowseSort };
  labels: {
    movie: string;
    series: string;
    more: string;
    loading: string;
    end: string;
    failed: string;
  };
}) {
  const [items, setItems] = useState<BrowseItem[]>(initial);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(hasMore);
  const [busy, setBusy] = useState(false);
  const [autoOff, setAutoOff] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  /** سقف الصفحات التلقائية — بعده يقرّر المستخدم بنفسه */
  const autoLoads = useRef(0);

  const load = useCallback(async (auto = false) => {
    if (busy || !more) return;
    // العدّ هنا لا في المراقب: المراقب يُعاد إنشاؤه مع كل تغيّر حالة
    // فيطلق نداءً أوّلياً يردّه حارس busy — لو عددناه هناك لنفد السقف
    // بعد نصف الصفحات
    if (auto) autoLoads.current += 1;
    setBusy(true);
    try {
      const params = new URLSearchParams({ page: String(page + 1) });
      if (query.type !== "all") params.set("type", query.type);
      if (query.g) params.set("g", query.g);
      if (query.sort !== "trending") params.set("sort", query.sort);

      const res = await fetch(`/api/discover?${params.toString()}`);
      if (!res.ok) throw new Error(labels.failed);
      const data = (await res.json()) as { items: BrowseItem[]; hasMore: boolean };

      setItems((prev) => {
        const seen = new Set(prev.map((x) => `${x.mediaType}-${x.id}`));
        const fresh = data.items.filter((x) => !seen.has(`${x.mediaType}-${x.id}`));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setPage((p) => p + 1);
      setMore(Boolean(data.hasMore) && data.items.length > 0);
      setAutoOff(false);
    } catch {
      setAutoOff(true);
      flashError(labels.failed);
    } finally {
      setBusy(false);
    }
  }, [busy, more, page, query, labels.failed]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !more || autoOff) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        // ثمان صفحات تلقائية (١٦٠ عملاً) تكفي أطول جلسة تصفّح؛ بعدها
        // يبقى الزرّ وحده حتى لا يجرّ تمريرٌ منسيّ عشرات الطلبات
        if (autoLoads.current >= 8) {
          setAutoOff(true);
          return;
        }
        load(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, more, autoOff]);

  return (
    <div>
      <PosterGrid>
        {items.map((it) => (
          <PosterCard
            key={`${it.mediaType}-${it.id}`}
            href={`/${it.mediaType === "tv" ? "show" : "movie"}/${it.id}`}
            title={it.title}
            posterPath={it.poster}
            year={it.year}
            badge={it.mediaType === "tv" ? labels.series : labels.movie}
          />
        ))}
        {busy &&
          Array.from({ length: 5 }, (_, i) => (
            <div
              key={`sk-${i}`}
              className="skeleton aspect-[2/3] rounded-poster border border-border"
              aria-hidden
            />
          ))}
      </PosterGrid>

      <div ref={sentinel} className="pt-6 text-center">
        {more ? (
          <button
            type="button"
            onClick={() => load()}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-semibold bg-surface border border-border text-muted hover:text-foreground hover:border-accent/50 disabled:opacity-60 transition"
          >
            {busy ? labels.loading : labels.more}
          </button>
        ) : (
          items.length > 0 && <p className="text-xs text-muted">{labels.end}</p>
        )}
      </div>
    </div>
  );
}
