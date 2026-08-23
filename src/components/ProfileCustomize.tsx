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
import { CardCountRow, PosterSizeRow, ToggleRow } from "./ui/SectionOrderList";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsSaveBar } from "./settings/SettingsSaveBar";
import { SettingsArrangeSheet } from "./settings/SettingsArrangeSheet";
import { toast } from "@/lib/toast";
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
  /** **ما هو محفوظٌ فعلاً** — به وحده يستيقظ شريطُ الحفظ (D-555) */
  const [base, setBase] = useState<ProfilePrefs>(() => sanitizeProfilePrefs(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [arrange, setArrange] = useState(false);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(base);

  /* سجلٌّ واحد تقرؤه هذه الشاشة وصفحةُ البروفايل معاً (D-152) */
  const sectionMeta = profileSectionMeta(t);

  function set(next: ProfilePrefs) {
    setPrefs(next);
  }

  /* **الاستعادةُ صعدت إلى الترويسة** (D-465): كانت زرَّ نصٍّ صغيراً داخل
     بطاقة الأقسام **فتستعيد ترتيبَها وحدَه**، **والآن تستعيد اللوحَ
     كلَّه** — وهو ما يقوله اسمُها في التصميم. */
  useEffect(() => {
    registerReset?.(() => {
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
        setBase(prefs);
        toast(t.savedToast, { tone: "success" });
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

      {/* ===== ١) أعلى البروفايل ===== */}
      <SettingsGroup label={t.custProfileHeader}>
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
                className="appearance-none rounded-full border border-border bg-surface-2 ps-3 pe-7 h-8 text-12 font-medium outline-none focus:border-accent disabled:opacity-40 transition"
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
      </SettingsGroup>

      {/* ===== ٢) الأقسام — **السجلُّ خرج إلى ورقة** (D-555) ===== */}
      <SettingsGroup label={t.custSectionsTitle}>
        <SettingsRow
          icon="grip"
          title={t.custArrange}
          subtitle={t.custSectionsHint}
          value={t.custShownN(prefs.order.length)}
          onClick={() => setArrange(true)}
        />
      </SettingsGroup>

      {/* **إخراجٌ لا خصوصية** — والسطرُ يقولها كي لا يظنّ أن الإخفاء قفل */}
      <p className="px-1 -mt-4 text-12 text-muted leading-relaxed">
        {t.custProfileHint}
        {/* الفراغ مسموحٌ هنا بخلاف الرئيسية — لكنه يُقال بصوتٍ عالٍ */}
        {prefs.order.length === 0 && ` — ${t.custProfileEmpty}`}
      </p>

      {/* ===== ٣) العرض ===== */}
      <SettingsGroup label={t.custDisplay}>
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5">
          <span className="shrink-0 text-15 font-semibold">{t.custLayout}</span>
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
          <span className="min-w-0 flex-1 text-15 font-semibold">{t.custPosterSize}</span>
          <PosterSizeRow
            value={prefs.density}
            labels={posterLabel}
            onChange={(density) => set({ ...prefs, density })}
          />
        </div>
      </SettingsGroup>

      <SettingsArrangeSheet
        open={arrange}
        title={t.custArrange}
        hint={t.custOrderHint}
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
        onCancel={() => setArrange(false)}
        onDone={(order) => {
          set({ ...prefs, order });
          setArrange(false);
        }}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      />

      {error && <Alert>{error}</Alert>}

      <SettingsSaveBar
        visible={dirty}
        pending={pending}
        onSave={save}
        saveLabel={t.saveChanges}
        savingLabel={t.saving}
      />
    </div>
  );
}
