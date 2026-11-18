"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import type { SearchPayload } from "@/core/searchTypes";
import { Icon } from "../Icon";
import { readRecentRooms, type RecentRoom } from "./recentRooms";

export type ActiveRoom = { kind: "tv" | "movie"; id: number; title: string; poster: string | null; week: number };

/* «زرتها مؤخراً» تُقرأ من المتصفّح — والخادمُ لا يعرفها، فيرسم فراغاً ثمّ يملؤها الترطيب بلا اختلاف (نمطُ HomeGreeting) */
const subscribeNever = () => () => {};
const EMPTY: RecentRoom[] = [];
let cache: { at: number; list: RecentRoom[] } | null = null;
const recentSnapshot = () => {
  /* لقطةٌ ثابتةُ المرجع ما دامت الصفحةُ مفتوحة — وإلّا أعاد useSyncExternalStore الرسمَ بلا نهاية */
  if (!cache) cache = { at: Date.now(), list: readRecentRooms() };
  return cache.list;
};
const serverEmpty = () => EMPTY;

const MIN = 2;

/**
 * 🆕 R264 — **عمودُ تبويب «نقاش» على الحاسوب** (أحمد ١٨ نوفمبر — «ب»).
 *
 * في التطبيق هذه الثلاثةُ خلف أيقونة البحث (`TalkSearch`): صندوقٌ يبحث عن عملٍ ويفتح نقاشه، ثمّ «زرتها مؤخراً» ثمّ
 * «الأنشط هذا الأسبوع». **والحاسوبُ يملك المساحةَ فتبقى ظاهرةً ثابتة** — نفسُ الكلمات من القاموس ونفسُ الترتيب.
 * البحثُ هو `/api/search?type=titles` نفسُه الذي تقرؤه صفحةُ البحث (لا نداءٌ جديد)، والنتيجةُ رابطٌ إلى الغرفة لا إلى العمل.
 */
export function TalkDeskAside({ active, locale }: { active: ActiveRoom[]; locale: Locale }) {
  const t = getDict(locale);
  const recent = useSyncExternalStore(subscribeNever, recentSnapshot, serverEmpty);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchPayload["titles"] | null>(null);
  const term = q.trim();

  useEffect(() => {
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&type=titles`, { signal: ctrl.signal });
        setHits(((await res.json()) as SearchPayload).titles.slice(0, 6));
      } catch {
        /* أُلغي أو فشل — البحثُ الحيُّ يصمت كما في صفحة البحث */
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [term]);

  const row = (key: string, href: string, title: string, poster: string | null, sub: string, end?: React.ReactNode) => {
    const img = posterUrl(poster, "w185");
    return (
      <li key={key}>
        <Link href={href} prefetch={false} className="group flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 hover:bg-surface-2 transition">
          <span className="relative block h-[50px] w-[34px] shrink-0 overflow-hidden rounded-md bg-surface-2">
            {img ? <Image src={img} alt="" fill sizes="34px" className="object-cover" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <bdi className="block truncate text-14 font-bold group-hover:text-accent transition">{title}</bdi>
            <span className="block truncate text-12 text-muted">{sub}</span>
          </span>
          {end}
        </Link>
      </li>
    );
  };
  const kindLabel = (k: "tv" | "movie") => (k === "tv" ? t.typeSeries : t.typeMovie);

  return (
    <aside aria-label={t.talkSearchTitle} className="hidden desk:flex flex-col gap-3 sticky top-6 self-start">
      <label className="flex items-center gap-2 h-11 rounded-full border border-border bg-surface px-4 focus-within:border-accent transition">
        <Icon name="search" size={16} className="text-muted shrink-0" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < MIN) setHits(null);
          }}
          type="search"
          autoComplete="off"
          placeholder={t.talkSearchPlaceholder}
          aria-label={t.talkSearchTitle}
          className="no-focus-ring min-w-0 flex-1 bg-transparent text-14 outline-none"
        />
      </label>

      {term.length >= MIN ? (
        <section className="rounded-2xl border border-border bg-surface p-3.5">
          {hits === null ? (
            <p className="py-3 text-center text-12 text-muted">…</p>
          ) : hits.length ? (
            <ul className="space-y-0.5">
              {hits.map((h) => row(`s-${h.mediaType}-${h.id}`, `/talk/${h.mediaType}/${h.id}`, h.title, h.posterPath ?? null, [kindLabel(h.mediaType), h.year].filter(Boolean).join(" · ")))}
            </ul>
          ) : (
            <p className="py-3 text-center text-12 text-muted">{t.searchNoResults}</p>
          )}
        </section>
      ) : (
        <>
          {recent.length ? (
            <section className="rounded-2xl border border-border bg-surface p-3.5">
              <h2 className="mb-1.5 flex items-center gap-1.5 text-12 font-bold text-muted">
                <Icon name="clock" size={14} className="shrink-0" />
                {t.talkSearchRecent}
              </h2>
              <ul className="space-y-0.5">{recent.map((r) => row(`r-${r.kind}-${r.id}`, `/talk/${r.kind}/${r.id}`, r.title, r.poster, kindLabel(r.kind)))}</ul>
            </section>
          ) : null}
          {active.length ? (
            <section className="rounded-2xl border border-border bg-surface p-3.5">
              <h2 className="mb-1.5 flex items-center gap-1.5 text-12 font-bold text-muted">
                <Icon name="trending" size={14} className="shrink-0" />
                {t.talkSearchActive}
              </h2>
              <ul className="space-y-0.5">
                {active.map((r) =>
                  row(
                    `a-${r.kind}-${r.id}`,
                    `/talk/${r.kind}/${r.id}`,
                    r.title,
                    r.poster,
                    kindLabel(r.kind),
                    <span className="flex shrink-0 items-center gap-1 text-12 font-bold tabular-nums text-accent">
                      <Icon name="comment" size={13} />
                      {r.week}
                    </span>,
                  ),
                )}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}
