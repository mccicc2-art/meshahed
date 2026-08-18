"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, backdropUrl } from "@/lib/media";
import { saveRating } from "@/lib/actions";
import { runOrQueue } from "@/lib/offline";
import { tap } from "@/lib/haptics";
import { flashError, toast as showToast } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { Sheet } from "./ui/Sheet";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * بطاقة «الحلقة التالية».
 *
 * البطاقة كلها فعل الاستئناف — لا زرّ Continue: الضغط في أي مكان يفتح
 * صفحة المسلسل. ودائرة ✓ الزجاجية وحدها استثناء: تؤشّر الحلقة من مكانها
 * تأشيراً متفائلاً — الدائرة تمتلئ والشريط يزحف فوراً، والخادم يلحق في
 * الخلفية، ثم تتجدّد البيانات فتحلّ الحلقة التالية محلّها دون مغادرة
 * الرئيسية. توست «تراجع» خمس ثوانٍ يصلح الخطأ حيث وقع.
 *
 * صورة المشهد لا الملصق: القسم يجيب «أين توقّفت»، والمشهد يعيدك إلى
 * الحلقة أسرع من غلافٍ دعائي. والنسبة انتقلت من شارةٍ فوق الصورة إلى
 * طرف سطر المعلومات — معلومة واحدة في مكان واحد.
 */
export function ContinueCard({
  tmdbId,
  href,
  title,
  backdropPath,
  posterPath,
  progress,
  watched,
  aired,
  episodeLabel,
  season,
  episode,
  runtime,
  variant = "card",
  locale,
}: {
  tmdbId: number;
  href: string;
  title: string;
  backdropPath: string | null;
  posterPath: string | null;
  /** ٠–١٠٠ */
  progress: number;
  watched: number;
  aired: number;
  /** مثل S2 E15 — يُحذف السطر إن لم يُعرف */
  episodeLabel?: string | null;
  season?: number | null;
  episode?: number | null;
  runtime?: number | null;
  /**
   * **وجهان لبطاقةٍ واحدة** (D-434): `card` بطاقةُ مشهدٍ عريضة للوضع
   * البصريّ، و`row` صفٌّ مضغوط للوضع المختصر.
   *
   * **ولماذا معامِلٌ لا مكوّنٌ ثانٍ:** كلُّ ما في هذا الملفّ من منطق —
   * التأشيرُ المتفائل والانزلاقُ والتراجعُ وورقةُ الإنجاز والتقييم —
   * **مشتركٌ بين الوجهين حرفاً بحرف**، **ونسخةٌ ثانيةٌ منه كانت ستفترق
   * عند أوّل إصلاح** (قاعدة ٦، ودرسُ D-289: نسخةٌ بقيت رماديّةً سبعةَ
   * أيام). **والذي يتبدّل هو الرسمُ وحدَه.**
   */
  variant?: "card" | "row";
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [, start] = useTransition();

  // التفاؤل محلّي: العدّاد والشريط والحلقة نفسها تتقدّم قبل ردّ الخادم —
  // البطاقة لا تغادر مكانها: تنزلق يساراً وتدخل الحلقة التالية من اليمين
  const [bump, setBump] = useState(0);
  const [slide, setSlide] = useState<"idle" | "out" | "in">("idle");
  const [ep, setEp] = useState<{ s: number; e: number } | null>(
    season != null && episode != null ? { s: season, e: episode } : null,
  );
  /** آخر حلقةٍ أُشّرت — هدف التراجع الذي يحمله زرّ الرسالة العابرة */
  const undoRef = useRef<{ s: number; e: number } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [stars, setStars] = useState(0);
  const [rated, setRated] = useState(false);

  // وصلت بيانات الخادم الجديدة؟ تُصفّر المحلّية — هي الحقيقة، ومعها
  // يصحّ حتى الانتقال بين المواسم الذي لا تعرفه البطاقة
  const [srv, setSrv] = useState({ watched, season, episode });
  if (srv.watched !== watched || srv.season !== season || srv.episode !== episode) {
    setSrv({ watched, season, episode });
    setBump(0);
    setEp(season != null && episode != null ? { s: season, e: episode } : null);
    setSlide("idle");
  }

  function rate(n: number) {
    if (rated) return;
    setStars(n);
    try {
      tap(8);
    } catch {
      /* لا شيء */
    }
    start(async () => {
      try {
        await saveRating({
          tmdbId,
          mediaType: "tv",
          rating: n,
          review: "",
          title,
          posterPath,
        });
        setRated(true);
        setTimeout(() => setCelebrate(false), 1100);
      } catch {
        setStars(0);
      }
    });
  }

  const w = watched + bump;
  const pct = Math.max(
    0,
    Math.min(100, aired > 0 ? Math.round((w / aired) * 100) : Math.round(progress)),
  );
  const left = aired > w ? aired - w : 0;

  const url = backdropPath
    ? backdropUrl(backdropPath, "w780")
    : posterUrl(posterPath, "w342");

  const canMark = ep != null && slide === "idle" && !celebrate;

  function mark() {
    if (!ep || slide !== "idle") return;
    const cur = { ...ep };
    try {
      tap(12);
    } catch {
      /* لا شيء */
    }

    const finishedAll = aired > 0 && w + 1 >= aired;
    setBump((b) => b + 1);

    if (finishedAll) {
      setCelebrate(true);
    } else {
      undoRef.current = cur;
      showToast(`S${cur.s} E${cur.e} ✓`, {
        tone: "success",
        action: { label: t.undoWatched, run: undo },
      });
      // البطاقة تبقى: القديمة تنزلق يساراً، والتالية تدخل من اليمين فوراً
      setSlide("out");
      setTimeout(() => {
        setEp({ s: cur.s, e: cur.e + 1 });
        setSlide("in");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setSlide("idle")),
        );
      }, 200);
    }

    start(async () => {
      try {
        // انقطاع الشبكة لا يفقد التأشيرة: تدخل الطابور وتُزامن عند العودة
        await runOrQueue("toggleEpisode", {
          showTmdbId: tmdbId,
          season: cur.s,
          episode: cur.e,
          runtime: runtime ?? null,
          watched: true,
        });
        // تجديدٌ هادئ مُجمَّع: تأشيراتٌ متتالية = تجديدٌ واحد لا أربعة
        if (finishedAll) router.refresh();
        else coalescedRefresh(router, 900);
      } catch (e) {
        setBump((b) => Math.max(0, b - 1));
        setEp(cur);
        setSlide("idle");
        setCelebrate(false);
        undoRef.current = null;
        // `errSave` بادئةٌ تنتهي بنقطتين — تُتبع بالسبب لا تُعرض وحدها
        flashError(t.errSave + (e as Error).message);
      }
    });
  }

  function undo() {
    const target = undoRef.current;
    if (!target) return;
    const back = { ...target };
    undoRef.current = null;
    setBump((b) => Math.max(0, b - 1));
    setEp(back);
    setSlide("idle");
    start(async () => {
      try {
        await runOrQueue("toggleEpisode", {
          showTmdbId: tmdbId,
          season: back.s,
          episode: back.e,
          runtime: runtime ?? null,
          watched: false,
        });
        router.refresh();
      } catch (e) {
        // فشل التراجع (حدّ المعدّل مثلاً): تُعاد الحالة المتقدمة وتظهر
        // رسالة الخطأ — كان الاستثناء يهرب حتى error boundary الصفحة
        setBump((b) => b + 1);
        setEp({ s: back.s, e: back.e + 1 });
        flashError(t.errSave + (e as Error).message);
      }
    });
  }

  // انزلاق التبديل: الخروج يساراً بانتقالٍ ناعم، والدخول يقفز إلى اليمين
  // بلا انتقالٍ ثم ينساب إلى مكانه — فتُقرأ حركةً واحدة من اليمين لليسار
  const slideCls =
    slide === "out"
      ? "transition-all duration-200 ease-in -translate-x-8 opacity-0"
      : slide === "in"
        ? "transition-none translate-x-8 opacity-0"
        : "transition-all duration-200 ease-out translate-x-0 opacity-100";

  return (
    <div className="relative">
      <div className={`relative ${slideCls}`}>
      {variant === "row" ? (
      <Link
        href={href}
        prefetch={false}
        className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-2 pe-16 active:scale-[0.99] transition"
      >
        <span className="relative w-[104px] shrink-0 aspect-[16/10] rounded-xl overflow-hidden bg-surface-2">
          {url ? (
            <Image src={url} alt="" fill sizes="104px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name="film" size={20} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-tight truncate" dir="auto">
            {title}
          </span>
          <span className="block text-[12px] text-muted leading-tight truncate mt-1">
            {ep ? (
              <span dir="ltr">{`S${ep.s} E${ep.e}`}</span>
            ) : (
              episodeLabel && <span dir="ltr">{episodeLabel}</span>
            )}
            {(ep || episodeLabel) && left > 0 && <span className="opacity-50"> · </span>}
            {left > 0 && t.leftEps(left)}
          </span>
          {/* الخيطُ والنسبةُ في سطرٍ واحد — نفسُ معنى شريط البطاقة، بمقاسِ صفّ */}
          <span className="mt-2 flex items-center gap-2">
            <span className="h-1 flex-1 rounded-full bg-[color:var(--divider)] overflow-hidden">
              <span
                className="block h-full w-full origin-left rtl:origin-right transition-transform duration-500"
                style={{
                  transform: `scaleX(${pct / 100})`,
                  background: "var(--gradient-brand-x)",
                }}
              />
            </span>
            <span
              className="shrink-0 text-[11px] font-bold text-muted tabular-nums"
              dir="ltr"
            >
              {pct}%
            </span>
          </span>
        </span>
      </Link>
      ) : (
      <Link href={href} prefetch={false} className="group block active:scale-[0.98] transition">
        {/* نسبة 7/5 بدل 16/10: العرض نقص ~١٢٪ (بطاقات أخفّ وأكثر ظهوراً) والارتفاع بقي مريحاً كما هو */}
        <div className="relative aspect-[7/5] rounded-poster overflow-hidden bg-surface border border-border">
          {url ? (
            <Image
              src={url}
              alt={title}
              fill
              sizes="(max-width: 640px) 70vw, 320px"
              className="object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name="film" size={26} />
            </span>
          )}

          {/* حجاب سفليّ يحمل النصّ: يبقي الصورة مرئية ويضمن قراءة الاسم */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

          <div className="absolute inset-x-0 bottom-0 p-3 pb-3.5">
            <p className="text-[15px] font-bold leading-tight text-white line-clamp-1 drop-shadow pe-10">
              {title}
            </p>
            {/* سطر المعلومات: الحلقة · الباقي — والنسبة في طرفه لا فوق الصورة */}
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-[12px] font-semibold text-white/75 truncate">
                {ep ? (
                  <span dir="ltr">{`S${ep.s} E${ep.e}`}</span>
                ) : (
                  episodeLabel && <span dir="ltr">{episodeLabel}</span>
                )}
                {(ep || episodeLabel) && left > 0 && <span className="text-white/45"> · </span>}
                {left > 0 && t.leftEps(left)}
              </span>
              <span className="shrink-0 text-[11px] font-bold text-white/70 tabular-nums" dir="ltr">
                {pct}%
              </span>
            </div>
          </div>

          {/* شريط التقدّم على حافّة البطاقة نفسها — يزحف مع التأشير المتفائل */}
          <span className="absolute inset-x-0 bottom-0 h-1 bg-[color:var(--divider)]">
            <span
              className="block h-full w-full origin-left rtl:origin-right transition-transform duration-500"
              style={{
                transform: `scaleX(${pct / 100})`,
                background:
                  "var(--gradient-brand-x)",
              }}
            />
          </span>
        </div>
      </Link>
      )}

      {/* دائرة ✓ الزجاجية — شقيقة الرابط لا ابنته، فلا ضغطة تفتح الصفحة خطأً.
          تمتلئ لحظة التأشير ثم تعود زجاجيةً للحلقة التالية */}
      {ep != null && (
        <button
          type="button"
          onClick={mark}
          disabled={!canMark}
          aria-label={t.markWatchedAria}
          title={t.markWatchedAria}
          className={`absolute z-10 grid place-items-center w-11 h-11 rounded-full border transition-all duration-200 active:scale-90 ${
            variant === "row" ? "top-1/2 -translate-y-1/2 end-3" : "top-2.5 end-2.5"
          } ${
            slide !== "idle" || celebrate
              ? "border-transparent text-white scale-105"
              : "bg-black/40 backdrop-blur-md border-white/25 text-white/90 hover:bg-black/55"
          }`}
          style={
            slide !== "idle" || celebrate
              ? {
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-2))",
                }
              : undefined
          }
        >
          <Icon name="check" size={20} strokeWidth={2.2} />
        </button>
      )}
      </div>

      {/* ورقة الإنجاز: وسط الشاشة، طراطيع بألوان الهوية — ولا تُغلق إلا
          بالتقييم: الخلفية ليست زرّاً، فاللحظة تنتهي برأيك لا بتجاهلها */}
      <Sheet open={celebrate} closeLabel={t.closeLabel} variant="bare" dismissible={false}>
        <>

          {/* الطراطيع: ٢٨ قصاصة بمواضع وسرعات محسوبة من رقمها — لا عشوائية تكسر الرسم */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {Array.from({ length: 28 }, (_, i) => {
              // ألوان الاحتفال من الهوية: أصفر العلامة ودرجاته وأبيض — لا قوس قزح
                  const colors = ["#FFD200", "#FBBF24", "#F59E0B", "#FFFFFF", "#22C55E"];
              return (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{
                    left: `${(i * 37 + 11) % 100}%`,
                    background: colors[i % colors.length],
                    animationDuration: `${1.7 + (i % 5) * 0.28}s`,
                    animationDelay: `${(i % 7) * 0.13}s`,
                    width: `${7 + (i % 3) * 3}px`,
                    height: `${11 + (i % 3) * 4}px`,
                  }}
                />
              );
            })}
          </div>

          <div
            className="sheet-pop glow-celebrate relative w-full max-w-[300px] rounded-3xl p-[1.5px]"
            style={{
              background:
                "var(--gradient-brand)",
            }}
          >
            <div className="rounded-[calc(1.5rem-1.5px)] bg-[color:var(--background)] px-5 pt-6 pb-5 text-center">
              <p className="text-3xl mb-2" aria-hidden>
                🎉
              </p>
              <p className="text-base font-extrabold leading-snug">
                {t.finishedShowTitle(title)}
              </p>
              <p className="text-xs text-muted mt-1.5">{t.finishedShowSub(aired)}</p>

              {/* التقييم داخل الورقة: عشر نجوم، لمسة واحدة تحفظ وتُغلق */}
              <p
                className={`text-[13px] font-bold mt-5 transition ${
                  rated ? "text-[color:var(--success)]" : ""
                }`}
                role="status"
              >
                {rated ? t.ratedThanks : t.rateQuestion}
              </p>
              <div className="flex justify-center gap-0.5 mt-2.5" dir="ltr">
                {Array.from({ length: 10 }, (_, i) => {
                  const n = i + 1;
                  const on = n <= stars;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={rated}
                      onClick={() => rate(n)}
                      aria-label={`${n}/10`}
                      className={`text-[21px] leading-none px-0.5 transition active:scale-125 ${
                        on ? "" : "opacity-30"
                      }`}
                      style={{ color: on ? "var(--verified)" : "var(--muted, #A3A3A3)" }}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              {stars > 0 && (
                <p className="text-[11px] text-muted mt-1.5 tabular-nums" dir="ltr">
                  {stars}/10
                </p>
              )}
            </div>
          </div>
        </>
      </Sheet>
    </div>
  );
}
