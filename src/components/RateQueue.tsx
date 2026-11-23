"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { StarRatingRow } from "@/components/ListReviewForm";
import { chipClass } from "@/components/ui/controls";
import { Dropdown, DropdownRow } from "@/components/ui/Dropdown";
import { toast as showToast } from "@/lib/toast";
import { posterUrl } from "@/core/media";
import { getDict, num, type Locale } from "@/core/i18n";
import { rateKey, type RateQueueItem } from "@/core/rateQueue";

/**
 * ====== 🆕 T530 — «بانتظار تقييمك» في الويب (توأمُ `RateQueueScreen` في التطبيق) ======
 *
 * أحمد ٢٣ نوفمبر «١أ»: قائمةٌ طويلة، كلُّ عملٍ بطاقةٌ تحتها النجومُ العشر (`StarRatingRow`، وجهُ إدخال الرتبة الواحد في الويب
 * D-701). **اختيارُ النجمة هو الحفظ** (`saveRating` بلا كتابة) ثمّ «انحفظ تقييمك · ٨/١٠» ويخرج الصفّ. «⋯» فيه «تخطَّ» (في
 * الحساب) و«لم أشاهده» للفيلم. ما فُعل يُخفى بحالةٍ هنا.
 *
 * 🔴 **الكتابةُ بمسارات `/api/v1` لا بالأفعال** (مراجعةُ الوكيل، البند ٣): `saveRating` يُبطل مساراتٍ بـ`revalidatePath`، وفعلٌ يُبطل
 * يعيد رسمَ الصفحة الحاليّة في ردّه — فكانت كلُّ نجمةٍ تعيد حسابَ القائمة كلِّها وتسقط الصفَّ قبل «انحفظ». المسارُ لا يفعل ذلك.
 * والقائمةُ تُنسخ إلى الحالة مرّةً (`useState(() => items)`) فلا يبدّلها رسمٌ جديدٌ تحت المؤشّر.
 * 🔴 **ولا نجمةَ تُقبل في الـ٤٥٠ ملّيثانية بعد خروج صفّ** (البند ٢): ما تحته يصعد، وضغطةٌ قُصد بها صفٌّ قد تقع على الذي بعده.
 */
type Filter = "all" | "movie" | "tv";
const SAVED_MS = 1100;
const SETTLE_MS = 450;

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (!res.ok || !json || "error" in json) throw new Error("write");
}

export function RateQueue({ items: initial, locale }: { items: RateQueueItem[]; locale: Locale }) {
  const t = getDict(locale);
  const [items] = useState(() => initial);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skips = useRef<Promise<unknown>>(Promise.resolve());
  const [filter, setFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [busy, setBusy] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [menu, setMenu] = useState<string | null>(null);

  const left = useMemo(() => items.filter((r) => !gone.has(rateKey(r.kind, r.id))), [items, gone]);
  const counts = useMemo(() => {
    const open = left.filter((r) => !saved.has(rateKey(r.kind, r.id)));
    const tv = open.filter((r) => r.kind === "tv").length;
    return { all: open.length, tv, movie: open.length - tv };
  }, [left, saved]);
  const rows = filter === "all" ? left : left.filter((r) => r.kind === filter);

  const drop = (k: string) => {
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => (settling.current = null), SETTLE_MS);
    setGone((g) => new Set(g).add(k));
  };
  const undrop = (k: string) =>
    setGone((g) => {
      const n = new Set(g);
      n.delete(k);
      return n;
    });

  async function rate(r: RateQueueItem, stars: number) {
    const k = rateKey(r.kind, r.id);
    if (busy.has(k) || saved.has(k) || settling.current) return;
    setBusy((b) => new Map(b).set(k, stars));
    try {
      await post("/api/v1/track/rate", { tmdbId: r.id, mediaType: r.kind, rating: stars, review: "", title: r.title, posterPath: r.poster_path });
      setSaved((s) => new Map(s).set(k, stars));
      setTimeout(() => drop(k), SAVED_MS);
    } catch {
      showToast(t.apiInternal, { tone: "error" });
    } finally {
      setBusy((b) => {
        const n = new Map(b);
        n.delete(k);
        return n;
      });
    }
  }

  function skip(r: RateQueueItem) {
    const k = rateKey(r.kind, r.id);
    setMenu(null);
    drop(k);
    /* واحدةٌ بعد الأخرى (الخادمُ يقرأ الحالةَ ويكتبها، فطلبان متوازيان قد يُضيع أحدُهما الآخر — كالتطبيق) */
    const next = skips.current.then(() => post("/api/v1/me/rate-queue/skip", { kind: r.kind, id: r.id }));
    skips.current = next.catch(() => undefined);
    next.catch(() => {
        undrop(k);
        showToast(t.apiInternal, { tone: "error" });
      });
  }

  function unwatch(r: RateQueueItem) {
    const k = rateKey(r.kind, r.id);
    setMenu(null);
    if (r.kind !== "movie") return;
    drop(k);
    post("/api/v1/track/movie", { movieTmdbId: r.id, runtime: null, watched: false }).then(
      () => showToast(t.rateQueueUnwatched, { tone: "success" }),
      () => {
        undrop(k);
        showToast(t.apiInternal, { tone: "error" });
      },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button type="button" onClick={() => setFilter("all")} className={chipClass(filter === "all", "sm")}>
          {t.rateQueueAll(num(counts.all, locale))}
        </button>
        {counts.movie ? (
          <button type="button" onClick={() => setFilter("movie")} className={chipClass(filter === "movie", "sm")}>
            {t.rateQueueMovies(num(counts.movie, locale))}
          </button>
        ) : null}
        {counts.tv ? (
          <button type="button" onClick={() => setFilter("tv")} className={chipClass(filter === "tv", "sm")}>
            {t.rateQueueShows(num(counts.tv, locale))}
          </button>
        ) : null}
      </div>
      {rows.length ? <p className="text-12 text-muted mb-3">{t.rateQueueHint}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.rateQueueEmpty}</p>
      ) : (
        <ul className="grid gap-2 desk:grid-cols-2">
          {rows.map((r) => {
            const k = rateKey(r.kind, r.id);
            const done = saved.get(k);
            const pending = busy.get(k);
            const href = r.kind === "movie" ? `/movie/${r.id}` : `/show/${r.id}`;
            const src = posterUrl(r.poster_path, "w185");
            const meta = [r.kind === "tv" ? t.rateQueueShow : t.rateQueueMovie, r.year ? String(r.year) : null].filter(Boolean).join(" · ");
            return (
              <li key={k} className={`flex gap-3 rounded-2xl border border-border bg-surface p-2.5 ${done ? "opacity-55" : ""}`}>
                <Link href={href} className="relative block w-[54px] shrink-0 aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-2">
                  {src ? <Image src={src} alt="" fill sizes="54px" className="object-cover" /> : null}
                </Link>
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <Link href={href} className="min-w-0 flex-1">
                      <b className="block truncate text-15 font-bold">{r.title}</b>
                      <span className="block truncate text-12 text-muted mt-0.5">{meta}</span>
                    </Link>
                    {done ? null : (
                      <span className="relative">
                        <button
                          type="button"
                          onClick={() => setMenu(menu === k ? null : k)}
                          aria-label={t.rateQueueMore}
                          aria-haspopup="menu"
                          aria-expanded={menu === k}
                          className="grid place-items-center w-8 h-8 -m-1 rounded-full text-muted hover:bg-surface-2"
                        >
                          <Icon name="dots" size={18} />
                        </button>
                        {/* القائمةُ المنسدلةُ الواحدة (`Dropdown`): نقرةٌ خارجها أو Escape تغلقها (مراجعةُ الوكيل، البند ٦) */}
                        <Dropdown open={menu === k} onClose={() => setMenu(null)} align="end" className="text-base font-normal">
                          <DropdownRow icon="clock" label={t.rateQueueSkip} onClick={() => skip(r)} />
                          {r.kind === "movie" ? <DropdownRow icon="eye-off" label={t.rateQueueNotWatched} onClick={() => unwatch(r)} /> : null}
                        </Dropdown>
                      </span>
                    )}
                  </div>
                  <div className={pending || done ? "pointer-events-none opacity-60" : ""}>
                    <StarRatingRow rating={done ?? pending ?? 0} onPick={(n) => void rate(r, n)} locale={locale} label={t.rateQuestion} />
                  </div>
                  {done ? <p className="text-[calc(13px*var(--fs))] font-bold text-success">{`✓ ${t.rateQueueSaved(num(done, locale))}`}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
