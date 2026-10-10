"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  follow,
  applyOnboardingProgress,
  suggestPeople,
  requestOrFollowUser,
  checkUsername,
  saveWelcomeIdentity,
  completeOnboarding,
  type UsernameState,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { fitForUpload, UPLOAD_MAX_BYTES } from "@/lib/imageFile";
import { getDict, type Locale } from "@/core/i18n";
import { GENRES, posterUrl } from "@/core/media";
import { avatarStoragePath } from "@/core/avatarPath";
import { cleanUsername, usernameIssue, USERNAME_MAX } from "@/core/username";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";

/**
 * 🆕 D-1341 (Phase 11-U · U0) — **الترحيبُ خمسُ خطواتٍ وبوّابة**:
 *   ١ «هذا أنت» (مقفولة: اسمُ مستخدمٍ إجباريّ) · ٢ الأعمال (مقفولة: عملٌ واحدٌ على الأقلّ) ·
 *   ٣ «أين وصلت» · ٤ الأنواع · ٥ الأشخاص — والثلاثُ الأخيرة «تخطّي» فيها يتخطّى فعلاً
 *   (قرارا أحمد ٨ و١٧: «تخطي يتخطى فعلا .. الا ف اختيار الاعمال»).
 * والخروجُ من الترحيب بالوصول إلى آخره وحدَه: «يالله نبدأ» يكتب ثمّ يختم (`completeOnboarding`).
 */
const STEPS = 5;
const ME = 1;
const PICK = 2;
const PROGRESS = 3;
const TASTE = 4;
const PEOPLE = 5;

/** حالةُ حقل اسم المستخدم كما تُعرض تحته — `idle` فارغ، `checking` في الطريق */
type NameCheck = UsernameState | "idle" | "checking";

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
  userId,
  seeds,
  initialGenres,
  nickname,
  avatarUrl,
  username,
  emptyHint,
}: {
  locale: Locale;
  /** مجلّدُ صاحب الصورة في المخزن (`avatars/<id>/…`) */
  userId: string;
  seeds: SeedTitle[];
  initialGenres: number[];
  nickname: string;
  avatarUrl: string | null;
  username: string;
  emptyHint: string;
}) {
  const t = getDict(locale);

  const [step, setStep] = useState(ME);
  const [error, setError] = useState<string | null>(null);

  /* ===== خطوة «هذا أنت» (القرارات ١٠ · ١٥ · ١٦) =====
     الاسمُ والصورةُ كما جاءا من Google — **يراهما قبل أن يدخل بهما** (كان يدخل باسمه الحقيقيّ ولا يعلم).
     واسمُ المستخدم **يبدأ فارغاً** لمن لم يختر بعد؛ ومن له اسمٌ اختاره من قبل يجده مكتوباً. */
  const [name, setName] = useState(nickname);
  const [photo, setPhoto] = useState(avatarUrl);
  const [handle, setHandle] = useState(username);
  /* جوابُ الخادم عن اسمٍ بعينه — يُقرأ فقط ما دام الحقلُ على الاسم نفسِه (جوابُ اسمٍ تجاوزه الكاتبُ يُهمل) */
  const [verdict, setVerdict] = useState<{ name: string; state: UsernameState }>({ name: "", state: "unknown" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cleanHandle = cleanUsername(handle);

  /* الفحصُ وهو يكتب: الشكلُ محلّيّاً فوراً (يُشتقّ في الرسم)، والتوفّرُ بسؤالٍ مؤجَّلٍ ٣٥٠ م.ث (لا سؤالَ لكلِّ
     حرف). `alive` يُسقط جوابَ اسمٍ تجاوزه الكاتب. و`unknown` لا يقفل: الفهرسُ الفريدُ عند الحفظ هو القاضي. */
  const tooShort = !!cleanHandle && usernameIssue(cleanHandle) === "short";
  useEffect(() => {
    if (!cleanHandle || tooShort) return;
    let alive = true;
    const timer = setTimeout(() => {
      checkUsername(cleanHandle)
        .then((r) => {
          if (alive) setVerdict({ name: cleanHandle, state: r });
        })
        .catch(() => {
          if (alive) setVerdict({ name: cleanHandle, state: "unknown" });
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cleanHandle, tooShort]);
  const check: NameCheck = !cleanHandle
    ? "idle"
    : tooShort
      ? "short"
      : verdict.name === cleanHandle
        ? verdict.state
        : "checking";

  const handleOk = check === "free" || check === "unknown";

  /* الرفعُ بوصفة `EditProfileForm` حرفاً: تصغيرٌ ثمّ قياس، ومجلّدُ صاحبها. المحفوظةُ لا تُمسّ هنا —
     يحذفها `updateProfile` بعد أن يثبت الحفظ (D-1108)؛ ما يُحذف رفعةٌ سابقةٌ في هذه الجلسة لم تُحفظ. */
  async function uploadPhoto(picked: File) {
    setError(null);
    if (!picked.type.startsWith("image/")) return setError(t.errPickImage);
    setUploading(true);
    try {
      const file = await fitForUpload(picked);
      if (file.size > UPLOAD_MAX_BYTES) {
        setError(t.errTooLarge);
        return;
      }
      const supabase = await createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const oldPath = photo !== avatarUrl ? avatarStoragePath(photo, userId) : null;
      setPhoto(data.publicUrl);
      if (oldPath && oldPath !== path) await supabase.storage.from("avatars").remove([oldPath]);
    } catch (e) {
      setError(t.errUpload + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }
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
    if (step !== PEOPLE || peopleLoaded) return;
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

  function go(next: number) {
    setError(null);
    setStep(next);
    /* كلُّ خطوةٍ تبدأ من عنوانها — من نزل في شبكة الأعمال كان يهبط في منتصف الخطوة التالية */
    window.scrollTo(0, 0);
  }

  /** «تخطّي» يتخطّى فعلاً: ما لم يُجب عنه يُحفظ فارغاً، لا ما كان ظاهراً على الشاشة */
  function skip() {
    if (step === PROGRESS) setProgress({});
    if (step === TASTE) setGenres([]);
    go(step + 1);
  }

  function finish() {
    setError(null);
    start(async () => {
      /* 🔑 **الهويّةُ أوّلاً، قبل أيِّ كتابةٍ أخرى**: اسمُ المستخدم قد يُؤخذ بين فحصه وحفظه (الفهرسُ
         الفريدُ هو القاضي) — فإن رُفض عاد إلى خطوته **ولم يُكتب شيء**، لا مكتبةٌ بلا صاحبِ اسم. */
      const id = await saveWelcomeIdentity({
        nickname: name,
        username: cleanHandle,
        avatarUrl: photo,
        favoriteGenres: genres,
      }).catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (!id.ok) {
        if (id.reason === "failed") {
          setError(t.obFinishFailed);
          return;
        }
        setVerdict({ name: cleanHandle, state: id.reason });
        setStep(ME);
        return;
      }

      // المتابعات حتى تمتلئ المكتبة
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

      /* المتابعات الاجتماعية (D-126): فشلُها لا يمسّ المكتبة ولا
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

      /* 🔑 **الختمُ آخرُ سطر، والقاعدةُ تتحقّق بنفسها** (اسمٌ مختار · عملٌ في المكتبة). فشلُه يُقال:
         من لم يُختم يعيده الحارسُ إلى هنا، وشاشةٌ تمضي به ثمّ تعيده تكذب عليه. */
      const done = await completeOnboarding().catch(() => ({ ok: false as const, reason: "failed" as const }));
      if (!done.ok) {
        if (done.reason === "username") {
          setError(t.obFinishFailed);
          setStep(ME);
        } else if (done.reason === "titles") {
          setError(t.obFinishFailed);
          setStep(PICK);
        } else setError(t.obFinishFailed);
        return;
      }

      /* تحميلُ مستندٍ لا تنقّلُ راوتر: الحارسُ في `proxy` يقرأ الختمَ الجديدَ ويكتب كوكيَّه، وغلافُ
         التطبيق يرى التنقّلَ يقيناً على المنصّتين (تنقّلُ التاريخ لا يُبلَّغ به في iOS). وقبله رسالةٌ
         للغلاف: «انتهى الترحيب» — فيُسقط علامتَه ويعود شريطُه. */
      try {
        (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView?.postMessage(
          JSON.stringify({ type: "welcome", done: true }),
        );
      } catch {
        /* خارج الغلاف — لا شيء */
      }
      window.location.replace("/");
    });
  }

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <header className="text-center mb-6">
        <p className="text-xs font-bold text-accent">{t.obStep(step, STEPS)}</p>
        <h1 className="text-2xl font-extrabold mt-2">
          {step === ME
            ? t.obMeTitle
            : step === PICK
              ? t.obPickTitle
              : step === PROGRESS
                ? t.obProgressTitle
                : step === TASTE
                  ? t.obGenresTitle
                  : t.obPeopleTitle}
        </h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {step === ME
            ? t.obMeHint
            : step === PICK
              ? t.obPickHint
              : step === PROGRESS
                ? t.obProgressHint
                : step === TASTE
                  ? t.obGenresHint
                  : t.obPeopleHint}
        </p>
      </header>

      {error && (
        <Alert className="mb-4" center>
          {error}
        </Alert>
      )}

      {/* ١ — هذا أنت: الصورةُ والاسمُ من Google (يُعدَّلان)، واسمُ المستخدم إجباريّ (القرار ١٥).
          `@` خارج الحقل: لا تُكتب ولا تُخزَّن. والحقلُ ١٦ بكسلاً — أصغرُ منها يقرّب سفاري الصفحة. */}
      {step === ME && (
        <div className="bg-surface border border-border rounded-xl divide-y divide-[color:var(--divider)]">
          <div className="px-4 py-5 flex flex-col items-center gap-3">
            <span className="relative">
              <Avatar src={photo} name={name || cleanHandle} size={88} alt={t.avatarAlt} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                aria-label={t.setEditAvatar}
                title={t.setEditAvatar}
                className="absolute bottom-0 end-0 grid place-items-center w-8 h-8 rounded-full bg-accent text-[color:var(--on-accent)] ring-2 ring-[color:var(--surface)] active:scale-95 transition disabled:opacity-60"
              >
                <Icon name={uploading ? "hourglass" : "image"} size={14} />
              </button>
            </span>
          </div>

          <div className="px-4 py-3.5">
            <label className="block text-12 font-semibold text-muted mb-1.5" htmlFor="ob-name">
              {t.displayNameSection}
            </label>
            <input
              id="ob-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={t.displayNamePlaceholder}
              className="w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--disabled)]"
            />
          </div>

          <div className="px-4 py-3.5">
            <label className="block text-12 font-semibold text-muted mb-1.5" htmlFor="ob-user">
              {t.usernameSection}
            </label>
            <div className="flex items-center gap-1" dir="ltr">
              <span className="text-[16px] text-muted">@</span>
              <input
                id="ob-user"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={USERNAME_MAX}
                placeholder="username"
                dir="ltr"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={check === "taken" || check === "reserved" || check === "short"}
                aria-describedby="ob-user-state"
                className="flex-1 min-w-0 bg-transparent text-[16px] outline-none text-left placeholder:text-[color:var(--disabled)]"
              />
            </div>
            {/* سطرٌ واحدٌ تحت الحقل يقول حالَه: القاعدةُ، ثمّ ما سيُحفظ إن اختلف عمّا كُتب، ثمّ الحكم */}
            <p
              id="ob-user-state"
              aria-live="polite"
              className={`text-12 mt-1.5 leading-relaxed ${
                check === "free"
                  ? "text-[color:var(--success)]"
                  : check === "taken" || check === "reserved" || check === "short"
                    ? "text-[color:var(--error)]"
                    : "text-muted"
              }`}
            >
              {check === "free"
                ? t.obUserFree(cleanHandle)
                : check === "taken" || check === "reserved"
                  ? t.apiUsernameTaken
                  : check === "short"
                    ? t.usernameShort
                    : check === "checking"
                      ? t.obUserChecking
                      : cleanHandle && cleanHandle !== handle.trim().toLowerCase()
                        ? t.willSaveAs(cleanHandle)
                        : t.obUserRule}
            </p>
          </div>
        </div>
      )}

      {/* ٢ — اختيار ما شاهده */}
      {step === PICK && (
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

      {/* ٣ — أين وصل في كل عمل */}
      {step === PROGRESS && (
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

      {/* ٤ — الأنواع المفضّلة */}
      {step === TASTE && (
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

      {/* ٥ — أشخاصٌ قد ترغب بمتابعتهم (D-126 · والعنوانُ قرارُ أحمد ١٢: دعوةٌ لا أمرٌ برقم)
          الحساب الجديد كان يدخل ودائرته صفر، فيفتح «مجتمعي» على فراغٍ
          يقول له إن الموقع ميّت. الاقتراح بتقاطع الذوق مع ما اختاره في
          الخطوة الأولى — لا بقائمةٍ عشوائية. الصفّ زرٌّ واحد يبدّل
          الاختيار: لا متابعةَ تُكتب هنا، كلّها في «يالله نبدأ». */}
      {step === PEOPLE && (
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

      {seeds.length === 0 && step === PICK && (
        <p className="text-center text-muted py-10">{emptyHint}</p>
      )}

      {/* شريط الإجراء الثابت */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)] to-transparent">
        <div className="max-w-2xl mx-auto">
          <button
            disabled={
              pending ||
              uploading ||
              (step === ME && (!cleanHandle || !handleOk)) ||
              (step === PICK && picked.size === 0)
            }
            onClick={() => (step < PEOPLE ? go(step + 1) : finish())}
            className={buttonClass({ size: "lg", full: true })}
          >
            {pending
              ? t.obSaving
              : step === PICK
                ? t.obPickedN(picked.size)
                : step === PEOPLE
                  ? toFollow.size > 0
                    ? t.obPeopleNext(toFollow.size)
                    : t.obPeopleSkip
                  : t.obNext}
          </button>
          {/* الصفُّ الثاني: رجوعٌ (بعد الأولى) و«تخطّي» (في الاختياريّتين وحدَهما). الخطوتان المقفولتان بلا
              «تخطّي»، والأخيرةُ زرُّها نفسُه يقول «أكمل بدون متابعة». لا بابَ هنا يخرج من الترحيب. */}
          {step > ME && (
            <div className="flex items-center justify-between mt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => go(step - 1)}
                aria-label={t.obBack}
                className="text-xs text-muted py-1 px-3"
              >
                {/* سهمُ الرجوع يتبع اتّجاهَ القراءة: يمينٌ في العربيّة، يسارٌ في الإنجليزيّة (كان «→» في الاثنتين) */}
                {locale === "en" ? "←" : "→"}
              </button>
              {(step === PROGRESS || step === TASTE) && (
                <button type="button" disabled={pending} onClick={skip} className="text-xs text-muted py-1 px-3">
                  {t.obSkip}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
