"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { StarRatingRow } from "./ListReviewForm";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";
import { v1Get, v1Post } from "./InboxComposer";
import { getDict, type Locale } from "@/core/i18n";
import { coalescedRefresh } from "@/core/refresh";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import type { SearchTitle } from "@/core/searchTypes";
import type { TitlePayload } from "@/core/contracts/title";
import type { EpisodeRateBody, RateBody, ShowRefBody, ToggleMovieBody } from "@/core/contracts/track";
import { PenEpisodeSheet, type PenEpisode } from "./PenEpisodeSheet";
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
/* 🆕 R255 — `ep`: «حلقة ›» من ورقة «أي حلقة؟» (توأمُ التطبيق — R58) */
type Answer = "yes" | "all" | "ep" | "not" | null;
type Dict = ReturnType<typeof getDict>;

export function NewPostBox({ locale, me }: { locale: Locale; me: { name: string; avatar: string | null } }) {
  const t = getDict(locale);
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pick, setPick] = useState<SearchTitle | null>(null);
  const [info, setInfo] = useState<TitlePayload | null>(null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [rating, setRating] = useState(0);
  const [spoiler, setSpoiler] = useState(false);
  const [ep, setEp] = useState<PenEpisode | null>(null);
  const [sheet, setSheet] = useState(false);
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
  /* 🆕 R255 — أين وصل (أعلى «م:ح» مشاهَدة) — الورقةُ تفتح عليه (قاعدةُ التطبيق) */
  const at = (() => {
    let best: { season: number; episode: number } | null = null;
    for (const k of tv?.me.watched ?? []) {
      const [sn, en] = k.split(":").map(Number);
      if (!Number.isInteger(sn) || !Number.isInteger(en) || sn <= 0) continue;
      if (!best || sn > best.season || (sn === best.season && en > best.episode)) best = { season: sn, episode: en };
    }
    return best;
  })();
  const asks = !!pick && !!info && (mv ? !movieWatched : !seriesDone);
  const watchedNow = movieWatched || seriesDone || answer === "yes" || answer === "all" || answer === "ep";
  /* النجوم: حلقةٌ مختارةٌ لم تُقيَّم · أو العملُ شاهدتَه ولم تقيّمه (التطبيق حرفاً) */
  const epStars = !!ep && ep.myRating == null;
  const titleStars = !ep && !!pick && watchedNow && myRating == null && answer !== "not";
  const showStars = epStars || titleStars;
  const stars = showStars && rating > 0 ? rating : null;
  const needsAnswer = asks && answer === null;
  const text = body.trim();
  const ready = !busy && (pick ? !!info && !needsAnswer && (!!text || !!stars) : !!text);

  function choose(r: SearchTitle) {
    setPick(r);
    setInfo(null);
    setAnswer(null);
    setRating(0);
    setEp(null);
    setFinding(false);
    setTimeout(() => box.current?.focus(), 30);
  }
  function clearPick() {
    setPick(null);
    setInfo(null);
    setAnswer(null);
    setRating(0);
    setEp(null);
  }
  function pickEpisode(e: PenEpisode) {
    setEp(e);
    setAnswer(asks ? "ep" : answer);
    setRating(0);
    /* منشورٌ عن حلقةٍ بعينها محجوبٌ افتراضاً (أحمد «١ أ» في التطبيق) — ويُطفأ باليد */
    setSpoiler(true);
    setSheet(false);
  }
  function clearEpisode() {
    setEp(null);
    if (answer === "ep") setAnswer(null);
    setSpoiler(false);
  }

  async function post() {
    if (!ready) return;
    setBusy(true);
    tap([12, 30]);
    try {
      if (pick && answer === "yes" && mv && !movieWatched)
        await v1Post("/api/v1/track/movie", { movieTmdbId: pick.id, runtime: mv.runtime ?? null, watched: true } satisfies ToggleMovieBody, t);
      if (pick && answer === "all" && tv && !seriesDone) await v1Post("/api/v1/track/show-watched", { showTmdbId: pick.id } satisfies ShowRefBody, t);
      if (pick && ep && stars) {
        /* تقييمُ الحلقة — والخادمُ يعلّمها وما قبلها مشاهَدة */
        await v1Post(
          "/api/v1/track/episode-rate",
          { showTmdbId: pick.id, season: ep.season, episode: ep.episode, rating: stars, review: text || null, spoiler } satisfies EpisodeRateBody,
          t,
        );
      } else if (pick && stars) {
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
            ...(pick && ep && pick.mediaType === "tv" ? { season: ep.season, episode: ep.episode } : {}),
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
    if (ep) return stars ? `${t.penTo} ${t.penToRating} · ${t.epChip(ep.season, ep.episode, 0)}` : `${t.penTo} ${t.penToEpisode(ep.episode)} — ${t.penCovered}`;
    if (stars) return `${t.penTo} ${t.penToRating} · ${pick.title}`;
    return `${t.penTo} ${t.penToGeneral(pick.title)}${myRating != null ? ` — ${t.penKeeps}` : ""}`;
  })();

  /* «حلقة ›» — والمختارةُ حبّةٌ مضاءةٌ «م٢ · ح٤ ✕» تُلغى بضغطة */
  const epPill = ep ? (
    <button type="button" className={chipClass(true, "sm")} onClick={clearEpisode} aria-label={`${t.epChip(ep.season, ep.episode, 0)} — ${t.closeLabel}`}>
      {t.epChip(ep.season, ep.episode, 0)}  ✕
    </button>
  ) : (
    <button type="button" className={chipClass(false, "sm")} onClick={() => setSheet(true)} aria-haspopup="dialog">
      {t.penEpisode} ›
    </button>
  );

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
              <button type="button" className={chipClass(answer === "all", "sm")} onClick={() => { clearEpisode(); setAnswer("all"); }}>
                {t.penAll}
              </button>
              {epPill}
              <button type="button" className={chipClass(answer === "not", "sm")} onClick={() => { clearEpisode(); setAnswer("not"); setRating(0); }}>
                {t.penNotYet}
              </button>
            </>
          )}
        </div>
      ) : pick && info && (myRating != null || tv) ? (
        /* 🆕 R255 — والمسلسلُ المخلَّص يبقى له «حلقة ›» في آخر السطر (التطبيق: «اذا بيحدد اخر حلقة») */
        <div className="mt-2 flex flex-wrap items-center gap-1.5 ps-[52px]">
          {myRating != null ? (
            <span className="text-12 font-semibold text-[color:var(--success)]">
              ✓ {t.penWatched} · {t.penYourRating} ★ {myRating}
            </span>
          ) : null}
          {tv ? epPill : null}
        </div>
      ) : null}
      {sheet && tv && pick ? (
        <PenEpisodeSheet
          showId={pick.id}
          seasons={tv.seasons}
          at={at}
          done={seriesDone}
          locale={locale}
          onPick={pickEpisode}
          onGeneral={() => {
            clearEpisode();
            setSheet(false);
          }}
          onClose={() => setSheet(false)}
        />
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
        {/* عبر `next/image` لا `<img>` (T407): image.tmdb.org محجوبٌ عند مستخدمينا (D-726)، فالرابطُ المباشر ظهر فارغاً،
            ومحمِّلُ الموقع (`src/core/imageLoader.ts`) يمرّره من ممرّنا المخزَّن ‎/i/‎ كبقيّة ملصقات الموقع */}
        {pick.poster ? <Image src={pick.poster} alt="" fill sizes="40px" className="object-cover" /> : null}
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
                <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded bg-surface">
                  {r.poster ? <Image src={r.poster} alt="" fill sizes="32px" className="object-cover" /> : null}
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
