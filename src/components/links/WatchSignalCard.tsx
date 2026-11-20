"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import { v1Get, v1Post } from "../InboxComposer";
import { episodeLabel } from "./linksApi";
import { LINK_WORDS } from "./linkWords";
import { flashError, toast } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { backdropUrl } from "@/core/media";
import { timeAgo } from "@/core/when";
import { getDict, type Locale } from "@/core/i18n";
import { SIGNAL_SOURCE_NAME, signalSourceOf, type StremioAnswerBody, type StremioSignal, type StremioState } from "@/core/contracts/stremio";
import type { EpisodeRateBody, RateBody } from "@/core/contracts/track";
import { StarRatingRow } from "../ListReviewForm";

/**
 * ====== 🆕 «من تطبيقاتك — شفتها؟» في رئيسيّة الويب (T409، التصميم المعتمد `a_home`) ======
 *
 * ما شغّلتَه على تطبيقٍ مربوط (Stremio · Plex · Jellyfin · Emby · Kodi) يسألك عنه Loopz: ✓ تعلّمه (وكلَّ ما قبله للحلقة)،
 * ✕ تتجاهله — البابان نفساهما في التطبيق (`GET /api/v1/me/stremio` · `POST …/answer`). **سؤالٌ واحدٌ في كلِّ مرّة**: الأحدث،
 * وتحته كم ينتظر. والبطاقةُ لا تُرسم أصلاً لمن لا ينتظره شيء — لا صندوقٌ فارغٌ في الرئيسيّة.
 * والمسجَّلُ تلقائياً («سجّل بلا سؤال») لا يُطلب هنا: الويبُ يسأل عمّا يحتاج جواباً فقط.
 */
/* البطاقةُ مرسومةٌ مرّتين في الرئيسيّة (أعلى الرفوف دون الحاسوب، وأعلى العمود الجانبيّ فيه — واحدةٌ مخفيّةٌ بـCSS دائماً)،
   فالسؤالُ يُجلب مرّةً واحدةً للصفحة ويُشارَك، والجوابُ يُسقطه من الاثنتين معاً */
type Shared = { items: StremioSignal[]; count: number };
let shared: Shared | null = null;
let pending: Promise<Shared | null> | null = null;
const listeners = new Set<(s: Shared) => void>();
function load(): Promise<Shared | null> {
  if (shared) return Promise.resolve(shared);
  pending ??= v1Get<StremioState>("/api/v1/me/stremio").then((s) => {
    pending = null;
    if (!s) return null;
    shared = { items: s.items.filter((x) => !x.auto), count: s.count };
    /* تنتهي صلاحيّةُ النسخة المشتركة بعد دقيقة: العودةُ إلى الرئيسيّة لاحقاً تسأل من جديد */
    setTimeout(() => {
      shared = null;
    }, 60_000);
    return shared;
  });
  return pending;
}
function drop(id: number) {
  if (!shared) return;
  shared = { items: shared.items.filter((x) => x.id !== id), count: Math.max(0, shared.count - 1) };
  for (const f of listeners) f(shared);
}

export function WatchSignalCard({ locale, className = "" }: { locale: Locale; className?: string }) {
  const t = getDict(locale);
  const router = useRouter();
  const w = LINK_WORDS[locale === "en" ? "en" : "ar"];
  const [items, setItems] = useState<StremioSignal[] | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  /* 🆕 T415 — ما أُجيب عنه بـ✓ وينتظر نجومه (فيلمٌ أو نهايةُ مسلسلٍ أو آخرُ موسمٍ اكتمل) — كالتطبيق، في البطاقة نفسِها */
  const [rateFor, setRateFor] = useState<StremioSignal | null>(null);
  const [stars, setStars] = useState(0);
  /* 🆕 T485 — المرحلةُ الجارية: نجومُ الحلقة أوّلاً (كلُّ حلقة)، ثمّ نجومُ العمل عند نهاية الموسم أو المسلسل — كالتطبيق (`rateStages`) */
  const [stage, setStage] = useState<"ep" | "work">("work");

  useEffect(() => {
    const on = (s: Shared) => {
      setItems(s.items);
      setCount(s.count);
    };
    listeners.add(on);
    void load().then((s) => s && on(s));
    return () => {
      listeners.delete(on);
    };
  }, []);

  const it = rateFor ?? items?.[0];
  if (!it) return null;
  const source = SIGNAL_SOURCE_NAME[signalSourceOf(it.source)];
  const ep = episodeLabel(it);
  const img = backdropUrl(it.image_path, "w300");

  const answer = async (watched: boolean) => {
    setBusy(true);
    try {
      await v1Post("/api/v1/me/stremio/answer", { id: it.id, watched } satisfies StremioAnswerBody, t);
      toast(watched ? (ep ? t.stremioMarkedUpTo(ep) : t.stremioMarkedMovie) : t.stremioDismissed);
      /* T415 — الجوابُ هنا يُحفظ في الحال (لا «تراجع» في الويب)، فالنجومُ تأتي بعده مباشرةً */
      const hasEp = it.kind === "tv" && it.season != null && it.episode != null;
      if (watched && (hasEp || it.rate)) {
        setStage(hasEp ? "ep" : "work");
        setRateFor(it);
      }
      drop(it.id);
      if (watched) coalescedRefresh(router);
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const finishRate = () => {
    setRateFor(null);
    setStars(0);
  };
  /* «بدون تقييم» أو بعد الحفظ: من نجوم الحلقة إلى نجوم العمل إن كان نهايةً، وإلّا تخرج البطاقة */
  const nextStage = () => {
    if (stage === "ep" && it.rate) {
      setStage("work");
      setStars(0);
    } else finishRate();
  };
  const rate = async (n: number) => {
    if (stars || n < 1) return;
    setStars(n);
    try {
      if (stage === "ep" && it.season != null && it.episode != null) {
        await v1Post("/api/v1/track/episode-rate", { showTmdbId: it.tmdb_id, season: it.season, episode: it.episode, rating: n } satisfies EpisodeRateBody, t);
      } else {
        await v1Post(
          "/api/v1/track/rate",
          { tmdbId: it.tmdb_id, mediaType: it.kind, rating: n, review: "", title: it.title, posterPath: it.poster_path ?? null } satisfies RateBody,
          t,
        );
      }
      toast(t.ratedThanks);
      nextStage();
      coalescedRefresh(router);
    } catch (e) {
      setStars(0);
      flashError(e instanceof Error ? e.message : String(e));
    }
  };
  const rating = rateFor !== null;
  const done = stage === "ep" ? t.signalEpisodeDone : it.kind === "movie" ? t.stremioMarkedMovie : it.rate === "show" ? t.signalShowDone : t.signalSeasonDone;
  const rateLabel = stage === "ep" ? t.signalRateEpisode : it.kind === "movie" ? t.autoRate : t.signalRateShow;

  return (
    <div className={`rounded-2xl border border-[#7b5cff]/50 bg-gradient-to-b from-[#7b5cff]/15 to-surface p-4 ${className}`}>
      <p className="flex items-center gap-2 text-12 font-bold text-[#b9acff]">
        <Icon name="tv" size={15} />
        {w.fromApps(source)}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative block h-[54px] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {img ? <Image src={img} alt="" fill sizes="96px" className="object-cover" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold" dir="auto">
            {it.title}
          </span>
          <span className="block text-12 text-muted">
            {[ep || t.stremioMovie, `${t.stremioOpened} ${timeAgo(it.seen_at, t)}`].join(" · ")}
          </span>
          {rating ? (
            <span className="mt-1 block text-sm font-bold text-[color:var(--success)]">✓ {done}</span>
          ) : (
            <span className="mt-1 block text-sm font-bold">{t.stremioAsk}</span>
          )}
        </span>
      </div>
      {rating ? (
        /* 🆕 T415 — صفُّ النجوم الواحد في الويب (`StarRatingRow`، D-701)، و«بدون تقييم» في طرف سطر الاسم كالتطبيق (T365) */
        <div className="mt-3">
          <div className="flex items-center justify-between text-13 font-bold text-muted">
            <span>{rateLabel}</span>
            {stars ? null : (
              <button type="button" className="active:opacity-60" onClick={nextStage}>
                {t.autoSkipRate}
              </button>
            )}
          </div>
          <div className="mt-1.5">
            <StarRatingRow key={stage} rating={stars} onPick={(n) => void rate(n)} locale={locale} label={rateLabel} />
          </div>
        </div>
      ) : (
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} className={buttonClass({ size: "sm", className: "flex-1" })} onClick={() => void answer(true)}>
          {t.stremioYes}
        </button>
        <button type="button" disabled={busy} className={buttonClass({ variant: "surface", size: "sm", className: "flex-1" })} onClick={() => void answer(false)}>
          {t.stremioNo}
        </button>
      </div>
      )}
      {!rating && count > 1 && <p className="mt-2 text-center text-12 text-muted">{w.waiting(count)}</p>}
    </div>
  );
}
