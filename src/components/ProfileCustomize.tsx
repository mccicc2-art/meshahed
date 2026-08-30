"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { openPlusGate } from "@/lib/plusGate";
import {
  DEFAULT_PROFILE_PREFS,
  HIDEABLE_PROFILE_TABS,
  PROFILE_SECTIONS,
  profileSectionMeta,
  sanitizeProfilePrefs,
  type HideableProfileTab,
  type ProfilePrefs,
} from "@/lib/profilePrefs";
import { Alert } from "./ui/Alert";
import { CardCountRow, PosterSizeRow, ToggleRow } from "./ui/SectionOrderList";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsSaveBar } from "./settings/SettingsSaveBar";
import { SettingsArrangeSheet } from "./settings/SettingsArrangeSheet";
import { toast } from "@/lib/toast";
import { CustomizePreview } from "./CustomizePreview";
import { PrefTemplatesRow } from "./PrefTemplatesRow";
import { type PrefTemplate } from "@/lib/prefTemplates";
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
  templates = [],
  plus = false,
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
  /* 🆕 **قوالبُ التخصيص** (D-822) — تمرّ كما هي، **والمكوّنُ يملك حالتَها** */
  templates?: PrefTemplate[];
  /* 🆕 **الخطّة** (D-633) — افتراضٌ صامتٌ `false` (D-028) */
  plus?: boolean;
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
    /* ⚖️ **القفلُ عند الحفظ لا عند الرسم** (D-633) — الحجّةُ كاملةً في
       `HomeCustomize`: المعاينةُ تُباع، والمنعُ من رؤيتها يُخرج الزائرَ
       بلا معرفةِ ما فاته. */
    if (!plus) {
      openPlusGate();
      return;
    }
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
          follow: t.followingUser,
        }}
        showStats={prefs.stats}
        rows={prefs.order.map((k) => ({ key: k, ...sectionMeta[k] }))}
        density={prefs.density}
      />

      {/* 🆕 **قوالبُ التخصيص** (D-822) — **موضعُها هنا كموضعِها في توأمها**
          (`HomeCustomize`): **سطحان بشكلٍ واحد، والمستخدمُ يتعلّم مرّةً.**
          ⚠️ **وقوالبُ هذا السطح وحدَه تُعرض** — **وقالبُ رئيسيّةٍ يُطبَّق
          على الملفّ يغيّر شاشةً لم يفتحها صاحبُها** (D-644). */}
      <PrefTemplatesRow
        locale={locale}
        surface="profile"
        initial={templates}
        current={prefs as unknown as Record<string, unknown>}
        onApply={(p) => setPrefs(sanitizeProfilePrefs(p))}
        plus={plus}
      />

      {/* ===== ١) أعلى البروفايل ===== */}
      <SettingsGroup label={t.custProfileHeader}>
        <ToggleRow
          icon="chart"
          label={t.custStatsShort}
          checked={prefs.stats}
          onChange={() => set({ ...prefs, stats: !prefs.stats })}
        />
        {/* 🗑️ ⚖️ **ومفتاحُ المستوى سقط معه** (D-807، حكمُ أحمد: «احذف
            نظام الليفل بالكامل»): **مفتاحٌ يضبط ما لا يُرسم وعدٌ بفعلٍ
            لا يقع** (D-217) — **وهو مصيرُ مفتاح الزيارات في D-584
            حرفاً.** **والحقلُ يُهمَل في `profile_prefs` ولا يُتلف.** */}
        {/* ⚖️ 🆕 **ومفتاحُ الزيارات وجمهورُه سقطا** (D-584، حكمُ أحمد:
            «احذف visit، غير مهمّة») — **العدّادُ لم يعد يُرسم في
            الصفحة، ومفتاحٌ يضبط ما لا يظهر وعدٌ بفعلٍ لا يقع** (D-217،
            وهي حجّةُ تعطيل الجمهور نفسِها وقد بلغت غايتَها). **والحقلان
            باقيان في `profile_prefs`** فلا ينكسر مخزونٌ قديم، **وعودةُ
            الميزة يوماً تعيد الصفوفَ كما كانت.** */}
      </SettingsGroup>

      {/* ===== ٢) 🆕 التبويبات (D-617، حكمُ أحمد: «حدّث هذي — التخصيص
          الحالي لا يناسب شكل البروفايل الحالي، بحيث أقدر أخفي تبويب
          أو أخفي قسم داخل تبويب») — **الشاشةُ صارت بلغة الصفحة**:
          البروفايلُ تبويباتٌ منذ D-438/D-561، والتحكّمُ كان ما زال
          يخاطب صفحةً واحدةً قديمة.

          ⚖️ 🆕 **و«نظرة عامة» دخلت القائمة مطفأةً افتراضاً، و«المفضّلة»
          حلّت محلَّها باباً بلا مفتاح** (D-658، حكمُ أحمد: «هنا يكون فيه
          أوفر فيو وفيفورت — وأوفر فيو يكون مقفل والي يبغاه يفعّله»).
          **والبابُ باقٍ وإن تبدّلت هويّتُه** (حجّةُ D-617) — **والسطرُ
          تحت القائمة يقول أيُّهما هو.** */}
      <SettingsGroup label={t.custTabsTitle}>
        {/* ⚖️ 🆕 **و«المفضّلة» صارت مفتاحاً كغيرها** (D-667، حكمُ أحمد
            بلقطةٍ على صفّها: «هذا خلّه مثل الباقي تقدر تطفيه وتشغّله»).

            🔴 **نقضٌ صريحٌ لـ D-658** («لا تُطفأ — هي الباب») **ولصفِّ
            D-663 المقفل بعدها بساعة** — **بكلمةِ صاحب الحكمين.**
            **والذي حلّ محلَّ البابِ المسمَّى: الصفحةُ تفتح على أوّلِ
            تبويبٍ ظاهر** (`page.tsx`) — **ترتيبٌ لا اسم.**

            ⚠️ **وصارت «كلُّها مطفأة» حالةً ممكنة** — **ولها نصُّها
            الصريح**، **ولا تمسّ صاحبَ الصفحة**: يرى تبويباتِه كلَّها. */}
        {(
          [
            { key: "favorites", icon: "heart", label: t.profileTabFavorites },
            { key: "overview", icon: "grid", label: t.profileTabOverview },
            { key: "activity", icon: "clock", label: t.communityTabMine },
            { key: "reviews", icon: "comment", label: t.communityTabReviews },
            { key: "lists", icon: "list", label: t.profileTabLists },
          ] as const
        ).map((row) => (
          <ToggleRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            checked={!prefs.hiddenTabs.includes(row.key)}
            onChange={() =>
              set({
                ...prefs,
                hiddenTabs: prefs.hiddenTabs.includes(row.key)
                  ? prefs.hiddenTabs.filter((k) => k !== row.key)
                  : /* بترتيب السجلّ الثابت لا ترتيبِ الضغطات — فالمخزونُ قانونيٌّ دائماً */
                    HIDEABLE_PROFILE_TABS.filter(
                      (k): k is HideableProfileTab =>
                        k === row.key || prefs.hiddenTabs.includes(k),
                    ),
              })
            }
          />
        ))}
      </SettingsGroup>
      <p className="px-1 -mt-4 text-12 text-muted leading-relaxed">{t.custTabsHint}</p>

      {/* ===== ٣) داخل «نظرة عامة» — **السجلُّ خرج إلى ورقة** (D-555) ===== */}
      <SettingsGroup label={t.custOverviewTab}>
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

      {/* ===== ٤) 🆕 داخل «القوائم» (D-617) — **مفتاحُ D-594 نفسُه من
          بابٍ ثانٍ لا مفتاحٌ ثانٍ**: الرايةُ `savedLists` واحدةٌ، ورقاقةُ
          «متوقّفة» على بطاقة القسم باقيةٌ كما حكم يومَها. */}
      <SettingsGroup label={t.custListsTab}>
        <ToggleRow
          icon="bookmark"
          label={t.savedListsSection}
          checked={prefs.savedLists}
          onChange={() => set({ ...prefs, savedLists: !prefs.savedLists })}
        />
      </SettingsGroup>

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
