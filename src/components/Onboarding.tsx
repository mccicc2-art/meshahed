"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  follow,
  updateProfile,
  applyOnboardingProgress,
  suggestPeople,
  requestOrFollowUser,
} from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { GENRES, posterUrl } from "@/lib/media";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";

/** الشكل الذي تُرجعه `people_to_follow` — مُعرَّفٌ هنا كي لا يستورد العميل `data.ts` */
interface Suggested {
  id: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  shared: number;
  followers: number;
  /* 🆕 **وحالةُ الحساب** (D-773ب) — **ولا `hide_name` هنا**: دالّةُ SQL
     لا تقترح من أخفى اسمَه أصلاً، **وحارسٌ لحالةٍ لا تصل حشوٌ يكذب**.
     **واختياريّةٌ فغيابُها «بلا شارة» لا انكسار.** */
  plan?: string | null;
  founder?: boolean | null;
  verified_at?: string | null;
}

/** كم شخصاً نقترح: ستّةٌ تملأ الشاشة بلا تمرير، والمطلوب منها ثلاثة */
const PEOPLE_LIMIT = 6;

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

  /* ===== خطوة الأشخاص (D-126) =====
     الاقتراح يُطلب **عند الوصول للخطوة الرابعة لا قبلها**: البذرة هي ما
     اختاره في الخطوة الأولى، وطلبُه مبكّراً يقترح على ذوقٍ لم يُصرَّح به
     بعد. و`loaded` يفرّق بين «ما وصلت الإجابة» و«لا أحد» — الأول هيكلٌ
     ينتظر، والثاني جملةٌ صادقة. */
  const [people, setPeople] = useState<Suggested[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [toFollow, setToFollow] = useState<Set<string>>(new Set());

  const chosen = seeds.filter((s) => picked.has(s.id));

  useEffect(() => {
    if (step !== 4 || peopleLoaded) return;
    let alive = true;
    suggestPeople(
      seeds.filter((s) => picked.has(s.id)).map((s) => s.id),
      PEOPLE_LIMIT,
    )
      .then((rows) => {
        if (alive) setPeople(rows as Suggested[]);
      })
      // الدالّة غائبة أو الشبكة سقطت؟ خطوةٌ فارغةٌ تُتخطّى، لا شاشة خطأ
      .catch(() => {})
      .finally(() => {
        if (alive) setPeopleLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [step, peopleLoaded, seeds, picked]);

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

      /* المتابعات الاجتماعية آخر شيء (D-126): فشلُها لا يمسّ المكتبة ولا
         الملف، ومتابعةٌ واحدة تسقط لا توقف البقيّة. و`requestOrFollow`
         لا `follow` لأن الحسابَ الخاص يردّ بطلبٍ لا بمتابعة — والاقتراح
         لا يقترح خاصّاً أصلاً، فهذا دفاعٌ في العمق. */
      for (const uid of toFollow) {
        try {
          await requestOrFollowUser(uid);
        } catch {
          // شخصٌ واحد فشل لا يوقف البقية
        }
      }

      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <header className="text-center mb-6">
        <p className="text-xs font-bold text-accent">{t.obStep(step, 4)}</p>
        <h1 className="text-2xl font-extrabold mt-2">
          {step === 1
            ? t.obPickTitle
            : step === 2
              ? t.obProgressTitle
              : step === 3
                ? t.obGenresTitle
                : t.obPeopleTitle}
        </h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {step === 1
            ? t.obPickHint
            : step === 2
              ? t.obProgressHint
              : step === 3
                ? t.obGenresHint
                : t.obPeopleHint}
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
                  className={`relative block aspect-[2/3] rounded-poster overflow-hidden border bg-surface-2 transition ${
                    on ? "border-accent ring-2 ring-accent" : "border-border"
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
                    <span className="absolute top-1.5 start-1.5 w-6 h-6 rounded-full bg-[color:var(--success)] text-white grid place-items-center">
                      <Icon name="check-line" size={14} strokeWidth={2.2} />
                    </span>
                  )}
                </span>
                <span className="block text-12 mt-1.5 line-clamp-2 leading-snug">
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
                        className={chipClass(cur === key, "sm")}
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
                className={chipClass(on)}
              >
                {locale === "en" ? g.en : g.ar}
              </button>
            );
          })}
        </div>
      )}

      {/* ٤ — تابع ٣ أشخاص (D-126)
          الحساب الجديد كان يدخل ودائرته صفر، فيفتح «مجتمعي» على فراغٍ
          يقول له إن الموقع ميّت. الاقتراح بتقاطع الذوق مع ما اختاره في
          الخطوة الأولى — لا بقائمةٍ عشوائية. الصفّ زرٌّ واحد يبدّل
          الاختيار: لا متابعةَ تُكتب هنا، كلّها في «يالله نبدأ». */}
      {step === 4 && (
        <div className="space-y-2">
          {!peopleLoaded ? (
            Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-[68px] bg-surface border border-border rounded-xl animate-pulse"
              />
            ))
          ) : people.length === 0 ? (
            <p className="text-center text-muted py-10 text-sm">{t.obPeopleNone}</p>
          ) : (
            people.map((p) => {
              const on = toFollow.has(p.id);
              const name = p.nickname || p.username || t.anonymousUser;
              const reason =
                p.shared > 0
                  ? t.suggestShared(p.shared)
                  : p.followers > 0
                    ? t.suggestFollowers(p.followers)
                    : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setToFollow((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                  className={`w-full flex items-center gap-3 text-start bg-surface border rounded-xl p-3 transition ${
                    on ? "border-accent ring-2 ring-accent" : "border-border"
                  }`}
                >
                  <Avatar src={p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
                  <span className="flex-1 min-w-0">
                    {/* 🆕 **وأوّلُ ما يرى الوافدُ الجديدُ الشارات** (D-773ب):
                        **السببُ تحت الاسم يقول «لماذا هو»، والشارةُ تقول
                        «من هو»** — وقرارُ المتابعة يحتاج الاثنين. */}
                    <span className="flex items-center min-w-0" style={{ gap: 4 }}>
                      <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                      <AccountBadges profile={p} t={t} />
                    </span>
                    {reason && (
                      <span className="block text-12 text-muted truncate">{reason}</span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 w-6 h-6 rounded-full grid place-items-center border ${
                      on
                        ? "bg-[color:var(--success)] text-white border-transparent"
                        : "border-border text-muted"
                    }`}
                  >
                    <Icon name={on ? "check-line" : "plus"} size={14} strokeWidth={2.2} />
                  </span>
                </button>
              );
            })
          )}
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
            onClick={() => (step < 4 ? setStep(step + 1) : finish())}
            className={buttonClass({ size: "lg", full: true })}
          >
            {pending
              ? t.obSaving
              : step === 3
                ? t.obNext
                : step === 4
                  ? toFollow.size > 0
                    ? t.obPeopleNext(toFollow.size)
                    : t.obPeopleSkip
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
