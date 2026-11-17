"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { StarRatingRow } from "./ListReviewForm";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";
import { v1Post } from "./InboxComposer";
import { getDict, type Locale } from "@/core/i18n";
import { coalescedRefresh } from "@/core/refresh";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import type { SearchTitle } from "@/core/searchTypes";
import type { TitlePayload } from "@/core/contracts/title";
import type { RateBody, ShowRefBody, ToggleMovieBody } from "@/core/contracts/track";
import type { ThreadReplyBody } from "@/core/contracts/thread";

/**
 * ====== 🆕 T405 — «منشورٌ جديد» في المجتمع على الويب (البند ١٤ في تقرير المقارنة · قرار أحمد «٣أ») ======
 *
 * 🔑 **مربّعٌ ثابتٌ أعلى خطّ النشاط** على الحاسوب لا زرُّ قلمٍ عائم: الشاشةُ العريضة فيها متّسعٌ للكتابة في مكانها.
 * 🔑 **الكاتبُ كاتبُ التطبيق** (`NewPostScreen`، D-1448 ثمّ R58) بقواعده ومساراته حرفاً — لا منطقَ ثانٍ:
 *   - بلا عمل ⇒ «النقاش العام» (`thread/reply` بـ`via: pen`).
 *   - عملٌ لم يُعلَّم مشاهَداً ⇒ «شاهدته؟» قبل النشر: نعم/كله ⇒ يُعلَّم (`track/movie` · `track/show-watched`) وتظهر النجوم؛
 *     لسه ⇒ بلا نجوم.
 *   - نجومٌ ⇒ تقييمٌ ورأيٌ (`track/rate`) يظهر في الخطّ وصفحة العمل والملفّ كأيّ رأي؛ بلا نجوم ⇒ «عام» غرفةِ العمل.
 *   - شاهدته وقيّمته من قبل ⇒ لا نجوم: المنشورُ نقاشٌ وتقييمُك يبقى.
 * ⚖️ **ما لم يدخل بعد**: «حلقة ›» (منشورٌ في غرفة حلقةٍ بعينها وتقييمُها) — يحتاج منتقي الحلقات؛ الجولةُ التالية.
 */

const BODY_MAX = 2000;
type Answer = "yes" | "all" | "not" | null;
type Dict = ReturnType<typeof getDict>;

async function v1Get<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store" }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  return json?.ok ? (json.data as T) : null;
}

export function NewPostBox({ locale, me }: { locale: Locale; me: { name: string; avatar: string | null } }) {
  const t = getDict(locale);
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pick, setPick] = useState<SearchTitle | null>(null);
  const [info, setInfo] = useState<TitlePayload | null>(null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [rating, setRating] = useState(0);
  const [spoiler, setSpoiler] = useState(false);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  /* النموُّ مع النصّ — بسقفٍ ثمّ تمريرٌ داخليّ (نهجُ خانة الرسائل) */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 200)}px`;
  }, [body]);

  /* حالتي من العمل المختار: شاهدتُه؟ قيّمتُه؟ — مسارُ صفحة العمل في التطبيق نفسُه */
  useEffect(() => {
    if (!pick) return;
    let alive = true;
    v1Get<TitlePayload>(`/api/v1/title/${pick.mediaType}/${pick.id}`).then((d) => {
      if (alive) setInfo(d && d.kind === pick.mediaType ? d : null);
    });
    return () => {
      alive = false;
    };
  }, [pick]);

  const tv = info && info.kind === "tv" ? info : null;
  const mv = info && info.kind === "movie" ? info : null;
  const myRating = info?.me.rating ?? null;
  const seriesDone = !!tv && tv.me.watched_count > 0 && tv.me.watched_count >= tv.aired_total;
  const movieWatched = !!mv && mv.me.watched === true;
  const asks = !!pick && !!info && (mv ? !movieWatched : !seriesDone);
  const watchedNow = movieWatched || seriesDone || answer === "yes" || answer === "all";
  const showStars = !!pick && watchedNow && myRating == null && answer !== "not";
  const stars = showStars && rating > 0 ? rating : null;
  const needsAnswer = asks && answer === null;
  const text = body.trim();
  const ready = !busy && (pick ? !!info && !needsAnswer && (!!text || !!stars) : !!text);

  function choose(r: SearchTitle) {
    setPick(r);
    setInfo(null);
    setAnswer(null);
    setRating(0);
    setFinding(false);
    setTimeout(() => box.current?.focus(), 30);
  }
  function clearPick() {
    setPick(null);
    setInfo(null);
    setAnswer(null);
    setRating(0);
  }

  async function post() {
    if (!ready) return;
    setBusy(true);
    tap([12, 30]);
    try {
      if (pick && answer === "yes" && mv && !movieWatched)
        await v1Post("/api/v1/track/movie", { movieTmdbId: pick.id, runtime: mv.runtime ?? null, watched: true } satisfies ToggleMovieBody, t);
      if (pick && answer === "all" && tv && !seriesDone) await v1Post("/api/v1/track/show-watched", { showTmdbId: pick.id } satisfies ShowRefBody, t);
      if (pick && stars) {
        await v1Post(
          "/api/v1/track/rate",
          {
            tmdbId: pick.id,
            mediaType: pick.mediaType,
            rating: stars,
            review: text,
            hasSpoiler: spoiler,
            title: pick.title,
            posterPath: pick.posterPath ?? null,
          } satisfies RateBody,
          t,
        );
      } else {
        await v1Post(
          "/api/v1/thread/reply",
          {
            target: pick ? { kind: "talk", tmdb_id: pick.id, media_type: pick.mediaType } : { kind: "talk", tmdb_id: 0, media_type: "general" },
            body: text,
            has_spoiler: spoiler,
            via: "pen",
          } satisfies ThreadReplyBody,
          t,
        );
      }
      setBody("");
      clearPick();
      setSpoiler(false);
      coalescedRefresh(router);
    } catch (e) {
      flashError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const to = (() => {
    if (!pick) return `${t.penTo} ${t.talkGeneralTitle}`;
    if (needsAnswer) return t.penAnswer;
    if (stars) return `${t.penTo} ${t.penToRating} · ${pick.title}`;
    return `${t.penTo} ${t.penToGeneral(pick.title)}${myRating != null ? ` — ${t.penKeeps}` : ""}`;
  })();

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar src={me.avatar} name={me.name} size={40} alt={t.avatarAlt} />
        <textarea
          ref={box}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void post();
            }
          }}
          placeholder={t.newPostPlaceholder}
          aria-label={t.newPostTitle}
          rows={1}
          dir="auto"
          className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-base leading-relaxed outline-none focus:border-accent transition"
        />
      </div>

      {pick ? <PickedTitle pick={pick} info={info} t={t} onClear={clearPick} /> : null}

      {pick && info && asks ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 ps-[52px]">
          <span className="text-12 font-bold">{t.penWatchedQ}</span>
          {mv ? (
            <>
              <button type="button" className={chipClass(answer === "yes", "sm")} onClick={() => setAnswer("yes")}>
                ✓ {t.penYes}
              </button>
              <button type="button" className={chipClass(answer === "not", "sm")} onClick={() => { setAnswer("not"); setRating(0); }}>
                {t.penNotYet}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={chipClass(answer === "all", "sm")} onClick={() => setAnswer("all")}>
                {t.penAll}
              </button>
              <button type="button" className={chipClass(answer === "not", "sm")} onClick={() => { setAnswer("not"); setRating(0); }}>
                {t.penNotYet}
              </button>
            </>
          )}
        </div>
      ) : pick && info && myRating != null ? (
        <p className="mt-2 ps-[52px] text-12 font-semibold text-[color:var(--success)]">
          ✓ {t.penWatched} · {t.penYourRating} ★ {myRating}
        </p>
      ) : null}

      {showStars ? (
        <div className="mt-2 ps-[52px]">
          <StarRatingRow rating={rating} onPick={(n) => setRating((r) => (r === n ? 0 : n))} locale={locale} label={t.penRateOpt} />
          <p className="mt-0.5 text-[11px] text-muted">{t.penRateOpt}</p>
        </div>
      ) : null}

      {finding ? <TitleFinder t={t} onPick={choose} onClose={() => setFinding(false)} /> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 ps-[52px]">
        <button type="button" onClick={() => setFinding((v) => !v)} className={chipClass(finding, "sm")} aria-expanded={finding}>
          <span className="inline-flex max-w-56 items-center gap-1.5">
            <Icon name="film" size={14} className="shrink-0" />
            <span className="truncate">{pick ? pick.title : t.newPostAddTitle}</span>
          </span>
        </button>
        <button type="button" onClick={() => setSpoiler((v) => !v)} className={chipClass(spoiler, "sm")} aria-pressed={spoiler}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="eye-off" size={14} className="shrink-0" />
            {t.spoilerMark}
          </span>
        </button>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted" dir="auto">
          {to}
        </span>
        <button type="button" disabled={!ready} onClick={() => void post()} className={buttonClass({ variant: "primary", size: "sm", className: "shrink-0 min-w-20" })}>
          {busy ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : t.newPostSend}
        </button>
      </div>
    </div>
  );
}

function PickedTitle({ pick, info, t, onClear }: { pick: SearchTitle; info: TitlePayload | null; t: Dict; onClear: () => void }) {
  return (
    <div className="mt-3 ms-[52px] flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
      <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- رابطُ البحث جاهزٌ من TMDB بمقاسه */}
        {pick.poster ? <img src={pick.poster} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{pick.title}</span>
        <span className="block text-12 text-muted">
          {pick.mediaType === "tv" ? t.typeSeries : t.typeMovie}
          {pick.year ? ` · ${pick.year}` : ""}
          {!info ? " · …" : ""}
        </span>
      </span>
      <button type="button" onClick={onClear} aria-label={t.closeLabel} title={t.closeLabel} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/** البحثُ عن عملٍ داخل المربّع — `GET /api/v1/search?type=titles` الذي يقرؤه تطبيقُ «أضف عملاً» نفسُه */
function TitleFinder({ t, onPick, onClose }: { t: Dict; onPick: (r: SearchTitle) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchTitle[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      v1Get<{ titles: SearchTitle[] }>(`/api/v1/search?type=titles&q=${encodeURIComponent(term)}`).then((d) => {
        if (!alive) return;
        setRows((d?.titles ?? []).slice(0, 8));
        setLoading(false);
      });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);
  const shown = q.trim().length < 2 ? [] : rows;
  return (
    <div className="mt-3 ms-[52px] rounded-xl border border-border bg-surface-2 p-2">
      <div className="flex items-center gap-2">
        <Icon name="search" size={16} className="ms-1 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder={t.newPostSearch}
          aria-label={t.newPostSearch}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-base outline-none"
        />
        {loading ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-transparent" /> : null}
      </div>
      {shown.length > 0 ? (
        <ul className="mt-1 max-h-72 overflow-y-auto">
          {shown.map((r) => (
            <li key={`${r.mediaType}-${r.id}`}>
              <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start hover:bg-surface transition">
                <span className="block h-12 w-8 shrink-0 overflow-hidden rounded bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- رابطُ البحث جاهزٌ من TMDB بمقاسه */}
                  {r.poster ? <img src={r.poster} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  <span className="block text-12 text-muted">
                    {r.mediaType === "tv" ? t.typeSeries : t.typeMovie}
                    {r.year ? ` · ${r.year}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
