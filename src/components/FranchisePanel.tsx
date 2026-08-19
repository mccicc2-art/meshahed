"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { follow, unfollow, toggleMovieWatched } from "@/lib/actions";
import { coalescedRefresh } from "@/lib/refresh";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

interface Part {
  id: number;
  title: string;
  year: string;
  poster: string | null;
  watched: boolean;
  saved: boolean;
}

/**
 * أجزاء السلسلة، تظهر تحت صفّ الإجراء مباشرةً بعد ضغطة ✓.
 *
 * المشكلة التي تحلّها بعينها: من أنهى «توي ستوري ١» يريد الثاني والثالث —
 * وكان عليه أن يخرج إلى البحث ويكتب الاسم أربع مرّات. اللحظة التي يُطرح
 * فيها السؤال هي لحظة إنهاء الجزء، والجواب يجب أن يكون في المكان الذي
 * وقعت فيه الضغطة، لا في ذيل الصفحة.
 *
 * **زرّان على كل ملصق، لا فتح صفحة:** ✓ يحفظه في المكتبة ويؤشّره مُشاهَداً،
 * والعلامة تحفظه في «للمشاهدة». أن تفتح صفحة الجزء الثاني ثم تضغط ثم
 * ترجع — ثلاث خطواتٍ لفعلٍ واحد يتكرّر خمس مرّات.
 *
 * والزرّان **خارج** الرابط لا داخله: زرٌّ داخل `<a>` عنصرٌ تفاعليّ داخل
 * عنصرٍ تفاعليّ — يكسر قارئ الشاشة ولوحة المفاتيح. الملصق رابط، والصفّ
 * تحته أزرار.
 *
 * ولا يظهر شيءٌ لعملٍ بلا سلسلة: TMDB يصرّح بالسلسلة في
 * `belongs_to_collection` ولا يخمّنها، فغيابها يعني غيابها.
 */
export function FranchisePanel({
  collectionId,
  excludeId,
  locale,
}: {
  collectionId: number;
  /** العمل الذي نحن في صفحته — لا يُعرض داخل أجزائه */
  excludeId: number;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [parts, setParts] = useState<Part[] | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/franchise?id=${collectionId}&exclude=${excludeId}`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        setParts(data.parts ?? []);
      } catch {
        setParts([]);
      }
    })();
    return () => ctrl.abort();
  }, [collectionId, excludeId]);

  /** تحديث بطاقةٍ واحدة محلياً — التفاؤل أولاً، والرجوع عند الفشل */
  function patch(id: number, next: Partial<Part>) {
    setParts((prev) => prev?.map((p) => (p.id === id ? { ...p, ...next } : p)) ?? prev);
  }

  function markWatched(p: Part) {
    const was = { watched: p.watched, saved: p.saved };
    patch(p.id, { watched: !p.watched, saved: !p.watched ? true : p.saved });
    tap(p.watched ? 10 : [12, 40, 12]);
    start(async () => {
      try {
        if (!p.watched && !p.saved) {
          await follow({ tmdbId: p.id, mediaType: "movie", title: p.title, posterPath: null });
        }
        await toggleMovieWatched({
          movieTmdbId: p.id,
          runtime: null,
          watched: !p.watched,
        });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        patch(p.id, was);
      }
    });
  }

  function toggleSaved(p: Part) {
    const was = { saved: p.saved };
    patch(p.id, { saved: !p.saved });
    tap(p.saved ? 10 : [12, 30]);
    start(async () => {
      try {
        if (p.saved) await unfollow({ tmdbId: p.id, mediaType: "movie" });
        else
          await follow({ tmdbId: p.id, mediaType: "movie", title: p.title, posterPath: null });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
        patch(p.id, was);
      }
    });
  }

  // لا سلسلة، أو لا جزء غير الذي نحن فيه: لا شيء يُعرض ولا مساحة تُحجز
  if (parts !== null && parts.length === 0) return null;

  return (
    <section
      className="mt-4 rounded-card border border-border bg-surface p-3.5 sheet-pop"
      aria-label={t.franchiseTitle}
    >
      {/* دليلٌ بأيقونات النظام لا بإيموجي (D-002): الزرّان صامتان، والرمز
          وحده لا يقول ماذا يفعل في أوّل مرّة */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Icon name="film" size={16} className="text-accent shrink-0" />
        <h3 className="text-12 font-bold me-auto">{t.franchiseTitle}</h3>
        <span className="inline-flex items-center gap-1 text-12 text-muted">
          <Icon name="check-line" size={12} strokeWidth={2.4} />
          {t.markWatchedBtn}
        </span>
        <span className="inline-flex items-center gap-1 text-12 text-muted">
          <Icon name="bookmark" size={12} strokeWidth={2.4} />
          {t.libToWatch}
        </span>
      </div>

      {parts === null ? (
        <div className="flex gap-3 overflow-hidden" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shrink-0 w-[104px]">
              <div className="skeleton aspect-[2/3] rounded-poster" />
              <div className="skeleton h-8 rounded-full mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="-mx-3.5 px-3.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-3 w-max pb-1">
            {parts.map((p) => (
              <li key={p.id} className="shrink-0 w-[104px]">
                <Link
                  href={`/movie/${p.id}`}
                  prefetch={false}
                  className="group block relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border"
                >
                  {p.poster ? (
                    <Image
                      src={p.poster}
                      alt={p.title}
                      fill
                      sizes="104px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name="film" size={20} />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-1.5 pt-6 bg-gradient-to-t from-black/90 to-transparent">
                    <span className="block text-12 font-semibold leading-tight text-white line-clamp-2">
                      {p.title}
                    </span>
                    {p.year && (
                      <span className="block text-[10px] text-white/60">{p.year}</span>
                    )}
                  </span>
                </Link>

                {/* الزرّان تحت الملصق لا فوقه: فوقه يغطّيان الصورة، وداخل
                    الرابط يصيران عنصراً تفاعلياً داخل آخر */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => markWatched(p)}
                    aria-pressed={p.watched}
                    aria-label={`${t.markWatchedBtn} — ${p.title}`}
                    title={t.markWatchedBtn}
                    className={`flex-1 h-9 rounded-full grid place-items-center border-[1.5px] active:scale-95 transition ${
                      p.watched
                        ? "border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : "border-border text-foreground/80 hover:border-[color:var(--success)]/60"
                    }`}
                  >
                    <Icon name="check-line" size={16} strokeWidth={2.2} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSaved(p)}
                    aria-pressed={p.saved}
                    aria-label={`${t.libToWatch} — ${p.title}`}
                    title={t.libToWatch}
                    className={`flex-1 h-9 rounded-full grid place-items-center border-[1.5px] active:scale-95 transition ${
                      p.saved
                        ? "border-transparent bg-accent/15 text-accent"
                        : "border-border text-foreground/80 hover:border-accent/60"
                    }`}
                  >
                    <Icon
                      name="bookmark"
                      size={16}
                      strokeWidth={2.2}
                      style={p.saved ? { fill: "currentColor" } : undefined}
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
