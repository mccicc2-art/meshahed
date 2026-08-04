"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { follow, updateProfile, applyOnboardingProgress } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { GENRES, posterUrl } from "@/lib/media";
import { Icon } from "./Icon";

export interface SeedTitle {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
}

type Progress = "none" | "some" | "done";

export function Onboarding({
  locale,
  seeds,
  initialGenres,
  nickname,
  avatarUrl,
  username,
  emptyHint,
}: {
  locale: Locale;
  seeds: SeedTitle[];
  initialGenres: number[];
  nickname: string;
  avatarUrl: string | null;
  username: string;
  emptyHint: string;
}) {
  const t = getDict(locale);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const [genres, setGenres] = useState<number[]>(initialGenres);
  const [pending, start] = useTransition();

  const chosen = seeds.filter((s) => picked.has(s.id));

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function finish() {
    start(async () => {
      // المتابعات أولاً حتى تمتلئ المكتبة، ثم الأنواع المفضّلة
      for (const s of chosen) {
        try {
          await follow({
            tmdbId: s.id,
            mediaType: s.mediaType,
            title: s.title,
            posterPath: s.posterPath,
          });
        } catch {
          // عمل واحد فشل لا يوقف البقية
        }
      }
      // «شفته كامل» يُترجم إلى تأشير فعلي، لا وسم فقط
      try {
        await applyOnboardingProgress(
          chosen.map((c) => ({
            tmdbId: c.id,
            mediaType: c.mediaType,
            progress: progress[c.id] ?? "none",
          })),
        );
      } catch {
        // التقدّم اختياري — المتابعة نفسها نجحت
      }

      try {
        await updateProfile({
          nickname,
          username,
          avatarUrl,
          favoriteGenres: genres,
        });
      } catch {
        // الأنواع اختيارية
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <header className="text-center mb-6">
        <p className="text-xs font-bold text-accent">{t.obStep(step, 3)}</p>
        <h1 className="text-2xl font-extrabold mt-2">
          {step === 1 ? t.obPickTitle : step === 2 ? t.obProgressTitle : t.obGenresTitle}
        </h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {step === 1 ? t.obPickHint : step === 2 ? t.obProgressHint : t.obGenresHint}
        </p>
      </header>

      {/* ١ — اختيار ما شاهده */}
      {step === 1 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {seeds.map((s) => {
            const on = picked.has(s.id);
            const url = posterUrl(s.posterPath, "w342");
            return (
              <button
                key={`${s.mediaType}-${s.id}`}
                onClick={() => toggle(s.id)}
                aria-pressed={on}
                className="text-start group"
              >
                <span
                  className={`relative block aspect-[2/3] rounded-xl overflow-hidden border bg-surface-2 transition ${
                    on ? "border-accent-2 ring-2 ring-accent-2" : "border-border"
                  }`}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={s.title}
                      fill
                      sizes="(max-width: 640px) 33vw, 160px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="w-full h-full grid place-items-center text-2xl text-muted">
                      <Icon name="film" size={22} />
                    </span>
                  )}
                  {on && (
                    <span className="absolute top-1.5 start-1.5 w-6 h-6 rounded-full bg-accent-2 text-[color:var(--on-accent-2)] grid place-items-center text-sm font-extrabold">
                      ✓
                    </span>
                  )}
                </span>
                <span className="block text-[11px] mt-1.5 line-clamp-2 leading-snug">
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ٢ — أين وصل في كل عمل */}
      {step === 2 && (
        <div className="space-y-3">
          {chosen.map((s) => {
            const cur = progress[s.id] ?? "none";
            const url = posterUrl(s.posterPath, "w185");
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3"
              >
                <span className="relative w-11 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
                  {url && <Image src={url} alt="" fill sizes="44px" className="object-cover" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{s.title}</span>
                  <span className="flex gap-1.5 mt-2 flex-wrap">
                    {(
                      [
                        ["none", t.obNotStarted],
                        ["some", t.obSomeOf],
                        ["done", t.obFinished],
                      ] as [Progress, string][]
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setProgress((p) => ({ ...p, [s.id]: key }))}
                        aria-pressed={cur === key}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                          cur === key
                            ? "border-accent-2 bg-accent-2/15 text-accent-2 font-bold"
                            : "border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ٣ — الأنواع المفضّلة */}
      {step === 3 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {GENRES.map((g) => {
            const on = genres.includes(g.id);
            return (
              <button
                key={g.id}
                onClick={() =>
                  setGenres((prev) =>
                    prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                  )
                }
                aria-pressed={on}
                className={`text-sm px-4 py-2.5 rounded-full border transition ${
                  on
                    ? "border-accent bg-accent/15 text-accent font-bold"
                    : "border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                {locale === "en" ? g.en : g.ar}
              </button>
            );
          })}
        </div>
      )}

      {seeds.length === 0 && step === 1 && (
        <p className="text-center text-muted py-10">{emptyHint}</p>
      )}

      {/* شريط الإجراء الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)] to-transparent">
        <div className="max-w-2xl mx-auto">
          <button
            disabled={pending || (step === 1 && picked.size === 0)}
            onClick={() => (step < 3 ? setStep(step + 1) : finish())}
            className="w-full py-3.5 rounded-xl bg-accent-2 text-[color:var(--on-accent-2)] font-extrabold text-sm hover:brightness-110 transition disabled:opacity-50"
          >
            {pending
              ? t.obSaving
              : step === 1
                ? t.obPickedN(picked.size)
                : step === 3
                  ? t.obFinish
                  : t.obPickedN(picked.size)}
          </button>
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.replace("/"))}
            className="block w-full text-center text-xs text-muted mt-3 py-1"
          >
            {step > 1 ? "→" : t.obSkip}
          </button>
        </div>
      </div>
    </div>
  );
}
