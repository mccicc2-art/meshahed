"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_PROFILE_PREFS,
  PROFILE_SECTIONS,
  profileSectionMeta,
  sanitizeProfilePrefs,
  VISIT_AUDIENCES,
  type ProfilePrefs,
  type VisitAudience,
} from "@/lib/profilePrefs";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import {
  CardCountRow,
  PosterSizeRow,
  SectionOrderList,
  ToggleRow,
} from "./ui/SectionOrderList";
import { CustomizePreview } from "./CustomizePreview";
import type { Density } from "@/lib/density";

/**
 * تخصيص البروفايل (D-129 → D-465) — **توأم `HomeCustomize` لا نسخته**.
 *
 * نفس `SectionOrderList` ونفس `ToggleRow` ونفس `updateProfile`؛ الفرق
 * سجلُّ الأقسام وحده.
 *
 * **والفرق الجوهري عن شاشة الرئيسية، وهو مكتوبٌ للمستخدم لا لنا:** ما
 * يخفيه هنا يختفي **عن الزائر** — **وخلطُ الإخراج بالخصوصية أخطرُ سوء
 * فهمٍ ممكنٍ في هذه الشاشة**، فالسطرُ الشارح يقولها صراحةً.
 *
 * 🆕 **والترتيبُ صار ترتيبَ تصميم أحمد** (D-465): معاينةٌ · «أعلى
 * البروفايل» · «الأقسام» بعنوانٍ خارج البطاقة · بطاقةُ «التنسيق وحجم
 * الملصق» · وزرُّ حفظٍ يملأ العرض.
 */
export function ProfileCustomize({
  locale,
  nickname,
  avatarUrl,
  genres,
  initial,
  username,
  bio,
  coverUrl,
  coverPos,
  avatarPos,
  counters,
  registerReset,
}: {
  locale: Locale;
  /** يمرّران كما هما — `updateProfile` يكتب الصفّ كاملاً */
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  initial: unknown;
  username?: string | null;
  bio?: string | null;
  coverUrl?: string | null;
  coverPos?: number;
  avatarPos?: number;
  counters?: { followers: number; following: number; visits: number };
  /** يسلّم زرَّ «استعادة» في الترويسة مقبضاً على هذا اللوح (D-465) */
  registerReset?: (fn: () => void) => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => sanitizeProfilePrefs(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /* سجلٌّ واحد تقرؤه هذه الشاشة وصفحةُ البروفايل معاً (D-152) */
  const sectionMeta = profileSectionMeta(t);

  function set(next: ProfilePrefs) {
    setSaved(false);
    setPrefs(next);
  }

  /* **الاستعادةُ صعدت إلى الترويسة** (D-465): كانت زرَّ نصٍّ صغيراً داخل
     بطاقة الأقسام **فتستعيد ترتيبَها وحدَه**، **والآن تستعيد اللوحَ
     كلَّه** — وهو ما يقوله اسمُها في التصميم. */
  useEffect(() => {
    registerReset?.(() => {
      setSaved(false);
      setPrefs({ ...DEFAULT_PROFILE_PREFS });
    });
  }, [registerReset]);

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({
          nickname,
          avatarUrl,
          favoriteGenres: genres,
          profilePrefs: prefs,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  const whoLabel: Record<VisitAudience, string> = {
    everyone: t.custWhoEveryone,
    followers: t.custWhoFollowers,
    me: t.custWhoMe,
  };
  const posterLabel: Record<Density, string> = {
    compact: t.custPosterS,
    comfortable: t.custPosterM,
    large: t.custPosterL,
  };

  return (
    <div className="space-y-5">
      <CustomizePreview
        kind="profile"
        title={t.custPreview}
        name={nickname}
        avatarUrl={avatarUrl}
        username={username}
        bio={bio}
        coverUrl={coverUrl}
        coverPos={coverPos}
        avatarPos={avatarPos}
        counters={counters}
        labels={{
          followers: t.followersLabel,
          following: t.followingLabel,
          visits: t.visitsLabel,
          level: t.custLevelShort,
          follow: t.followingUser,
        }}
        showStats={prefs.stats}
        showLevel={prefs.level}
        showVisits={prefs.visits}
        rows={prefs.order.map((k) => ({ key: k, ...sectionMeta[k] }))}
        density={prefs.density}
      />

      {/* ===== أعلى البروفايل ===== */}
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <h2 className="px-4 pt-3.5 pb-1 text-[15px] font-bold">{t.custProfileHeader}</h2>
        <ToggleRow
          icon="chart"
          label={t.custStatsShort}
          checked={prefs.stats}
          onChange={() => set({ ...prefs, stats: !prefs.stats })}
        />
        <ToggleRow
          icon="star"
          label={t.custLevelShort}
          checked={prefs.level}
          onChange={() => set({ ...prefs, level: !prefs.level })}
        />
        <ToggleRow
          icon="people"
          label={t.custVisitsShort}
          checked={prefs.visits}
          onChange={() => set({ ...prefs, visits: !prefs.visits })}
          trailing={
            /* 🆕 **ومن يراه** (D-465) — **قائمةٌ أصليّةٌ لا منسدلةٌ ثانية**
               (القاعدة ٦: منسدلةٌ واحدة، وهذه حقلُ نموذجٍ لا قائمةُ أفعال).
               **وتُعطَّل حين يكون العدّادُ مطفأً**: خيارُ جمهورٍ لرقمٍ لا
               يظهر لأحدٍ وعدٌ بفعلٍ لا يقع (D-217). */
            <span className="relative shrink-0">
              <select
                value={prefs.visitsWho}
                disabled={!prefs.visits}
                aria-label={t.custWhoAria}
                onChange={(e) =>
                  set({ ...prefs, visitsWho: e.target.value as VisitAudience })
                }
                className="appearance-none rounded-full border border-border bg-surface-2 ps-3 pe-7 h-8 text-[12px] font-medium outline-none focus:border-accent disabled:opacity-40 transition"
              >
                {VISIT_AUDIENCES.map((k) => (
                  <option key={k} value={k}>
                    {whoLabel[k]}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-2 text-muted text-[10px]">
                ▾
              </span>
            </span>
          }
        />
      </section>

      {/* ===== الأقسام — **عنوانٌ خارج البطاقة** كما في التصميم ===== */}
      <section>
        <h2 className="px-1 text-[15px] font-bold">{t.custSectionsTitle}</h2>
        <p className="px-1 mt-0.5 mb-2 text-[12px] text-muted leading-relaxed">
          {t.custSectionsHint}
        </p>

        <SectionOrderList
          all={PROFILE_SECTIONS}
          picked={prefs.order}
          meta={sectionMeta}
          labels={{
            up: t.custMoveUp,
            down: t.custMoveDown,
            hide: t.custHide,
            show: t.custShow,
            drag: t.custReorder,
          }}
          onChange={(order) => set({ ...prefs, order })}
        />

        {/* **إخراجٌ لا خصوصية** — والسطرُ يقولها كي لا يظنّ أن الإخفاء قفل */}
        <p className="px-1 mt-2 text-[12px] text-muted leading-relaxed">
          {t.custProfileHint}
        </p>

        {/* الفراغ مسموحٌ هنا بخلاف الرئيسية — لكنه يُقال بصوتٍ عالٍ */}
        {prefs.order.length === 0 && (
          <p className="px-1 mt-1 text-[12px] text-muted">{t.custProfileEmpty}</p>
        )}
      </section>

      {/* ===== التنسيق وحجم الملصق — **بطاقةٌ واحدةٌ بصفّين** ===== */}
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5 border-b border-[color:var(--divider)]">
          <span className="shrink-0 text-[15px] font-bold">{t.custLayout}</span>
          <span className="min-w-0 flex-1">
            <CardCountRow
              value={prefs.cards}
              labels={{
                compact: t.cardsCompact,
                medium: t.cardsMedium,
                full: t.cardsFull,
              }}
              onChange={(cards) => set({ ...prefs, cards })}
            />
          </span>
        </div>
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5">
          <span className="min-w-0 flex-1 text-[15px] font-bold">{t.custPosterSize}</span>
          <PosterSizeRow
            value={prefs.density}
            labels={posterLabel}
            onChange={(density) => set({ ...prefs, density })}
          />
        </div>
      </section>

      {error && <Alert>{error}</Alert>}

      <div className="space-y-2">
        <button
          onClick={save}
          disabled={pending}
          className={buttonClass({ size: "lg", full: true })}
        >
          {pending ? t.saving : t.saveChanges}
        </button>
        {saved && (
          <p role="status" className="text-center text-[14px] text-[color:var(--success)]">
            {t.savedOk}
          </p>
        )}
      </div>
    </div>
  );
}
