"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, backdropUrl } from "@/lib/media";
import { toggleEpisode } from "@/lib/actions";
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
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [, start] = useTransition();

  // التفاؤل محلّي: العدّاد والشريط يتقدّمان قبل ردّ الخادم
  const [bump, setBump] = useState(0);
  const [phase, setPhase] = useState<"idle" | "marked" | "leaving">("idle");
  const [toast, setToast] = useState<{ s: number; e: number } | null>(null);
  const [err, setErr] = useState(false);

  const w = watched + bump;
  const pct = Math.max(
    0,
    Math.min(100, aired > 0 ? Math.round((w / aired) * 100) : Math.round(progress)),
  );
  const left = aired > w ? aired - w : 0;

  const url = backdropPath
    ? backdropUrl(backdropPath, "w780")
    : posterUrl(posterPath, "w342");

  const canMark = season != null && episode != null && phase === "idle";

  function mark() {
    if (season == null || episode == null) return;
    setErr(false);
    setBump(1);
    setPhase("marked");
    try {
      navigator.vibrate?.(12);
    } catch {
      /* لا شيء */
    }
    start(async () => {
      try {
        await toggleEpisode({
          showTmdbId: tmdbId,
          season,
          episode,
          runtime: runtime ?? null,
          watched: true,
        });
        setToast({ s: season, e: episode });
        // انزلاق الوداع ثم تجديد البيانات: الحلقة التالية تحلّ في نفس المكان
        setTimeout(() => setPhase("leaving"), 350);
        setTimeout(() => {
          router.refresh();
        }, 600);
        setTimeout(() => setToast(null), 5000);
      } catch {
        setBump(0);
        setPhase("idle");
        setErr(true);
        setTimeout(() => setErr(false), 3000);
      }
    });
  }

  function undo() {
    if (season == null || episode == null) return;
    setToast(null);
    setBump(0);
    setPhase("idle");
    start(async () => {
      try {
        await toggleEpisode({
          showTmdbId: tmdbId,
          season,
          episode,
          runtime: runtime ?? null,
          watched: false,
        });
      } finally {
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`relative transition-all duration-300 ${
        phase === "leaving" ? "opacity-0 scale-95 translate-x-3 rtl:-translate-x-3" : ""
      }`}
    >
      <Link href={href} prefetch={false} className="group block active:scale-[0.98] transition">
        <div className="relative aspect-[16/10] rounded-[18px] overflow-hidden bg-surface border border-border">
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
                {episodeLabel && <span dir="ltr">{episodeLabel}</span>}
                {episodeLabel && left > 0 && <span className="text-white/45"> · </span>}
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
              className="block h-full transition-[width] duration-500"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, var(--brand-3) 0%, var(--accent-2) 55%, var(--accent) 100%)",
              }}
            />
          </span>
        </div>
      </Link>

      {/* دائرة ✓ الزجاجية — شقيقة الرابط لا ابنته، فلا ضغطة تفتح الصفحة خطأً */}
      {season != null && episode != null && (
        <button
          type="button"
          onClick={mark}
          disabled={!canMark}
          aria-label={t.markWatchedAria}
          title={t.markWatchedAria}
          className={`absolute top-2.5 end-2.5 z-10 grid place-items-center w-11 h-11 rounded-full border transition-all duration-200 active:scale-90 ${
            phase !== "idle"
              ? "border-transparent text-white scale-105"
              : "bg-black/40 backdrop-blur-md border-white/25 text-white/90 hover:bg-black/55"
          }`}
          style={
            phase !== "idle"
              ? {
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-2))",
                }
              : undefined
          }
        >
          <Icon name="check" size={19} strokeWidth={2.4} />
        </button>
      )}

      {/* توست التراجع: الخطأ يُصلح حيث وقع، خلال خمس ثوانٍ */}
      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-50 flex justify-center pointer-events-none">
          <div className="sheet-pop pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-[color:var(--elevated,#1A1A1A)] px-4 py-2.5 shadow-2xl">
            <span className="text-[13px] font-semibold">
              <span dir="ltr">
                S{toast.s} E{toast.e}
              </span>{" "}
              ✓
            </span>
            <button
              type="button"
              onClick={undo}
              className="text-[13px] font-bold text-accent hover:brightness-110 transition"
            >
              {t.undoWatched}
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="fixed inset-x-4 bottom-24 z-50 flex justify-center pointer-events-none">
          <div className="sheet-pop flex items-center rounded-full border border-red-400/30 bg-red-500/15 px-4 py-2.5 shadow-2xl">
            <span className="text-[13px] text-red-300">{t.errSave}✗</span>
          </div>
        </div>
      )}
    </div>
  );
}
