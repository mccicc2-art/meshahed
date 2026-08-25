"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_HOME_PREFS,
  HOME_SECTIONS,
  HOME_VIEWS,
  HEADER_STATS,
  STATS_PICK_MIN,
  STATS_PICK_MAX,
  sanitizeHomePrefs,
  homeSectionMeta,
  type HomePrefs,
  type HeaderStatKey,
} from "@/lib/homePrefs";
import { type IconName } from "./Icon";
import { Alert } from "./ui/Alert";
import { CardCountRow, PosterSizeRow, ToggleRow } from "./ui/SectionOrderList";
import { chipClass, pillTrack } from "./ui/controls";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsSaveBar } from "./settings/SettingsSaveBar";
import { SettingsArrangeSheet } from "./settings/SettingsArrangeSheet";
import { toast } from "@/lib/toast";
import { CustomizePreview } from "./CustomizePreview";
/* **بابٌ ثانٍ للوضع نفسِه** — فيُخبَر مخزنُ التبويب بما حُفظ هنا */
import { rememberHomeView } from "./HomeViewProvider";
import { type Density } from "@/lib/density";

/**
 * تخصيص الرئيسية.
 *
 * ثلاثة أقسام: مفاتيح إظهارٍ لعناصر الترويسة، وخانات بطاقة الأرقام،
 * وترتيب أقسام المحتوى. الأخيران يرسمهما `SectionOrderList` نفسه الذي
 * ترسم به شاشة البروفايل (D-129) — سجلّاتٌ ثلاثة، مصنعٌ واحد.
 *
 * الحفظ يمرّ عبر `updateProfile` نفسه الذي تكتب به بقية أقسام
 * الإعدادات: نموذجٌ واحد لجدولٍ واحد.
 */
export function HomeCustomize({
  locale,
  nickname,
  avatarUrl,
  genres,
  initial,
  registerReset,
}: {
  locale: Locale;
  /** يمرّران كما هما — `updateProfile` يكتب الصفّ كاملاً */
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  initial: unknown;
  /** يسلّم زرَّ «استعادة» في الترويسة مقبضاً على هذا اللوح (D-465) */
  registerReset?: (fn: () => void) => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [prefs, setPrefs] = useState<HomePrefs>(() => sanitizeHomePrefs(initial));
  /** **ما هو محفوظٌ فعلاً في القاعدة** — به وحده يُعرف «هل هناك ما يُحفظ» */
  const [base, setBase] = useState<HomePrefs>(() => sanitizeHomePrefs(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** أيُّ سجلٍّ مفتوحٌ في ورقة الترتيب — ولا اثنان معاً */
  const [arrange, setArrange] = useState<"sections" | "stats" | null>(null);

  /* **المقارنةُ نصّاً لا حقلاً حقلاً**: `HomePrefs` كائنٌ من قيمٍ أوّليّةٍ
     ومصفوفاتٍ مرتَّبة — **والترتيبُ معنًى فيه**، فالنصُّ يقارنه كلَّه
     بسطرٍ واحد، **ومقارنةٌ يدويّةٌ تنسى حقلاً عند أوّل حقلٍ يُضاف.** */
  const dirty = JSON.stringify(prefs) !== JSON.stringify(base);

  /* ⚖️ 🆕 **وثلاثةُ مفاتيحَ سقطت من هنا** (D-434): «المستوى» و«المتابعون»
     و«التعليقات والتقييمات» **كانت تتحكّم في ترويسة الحساب**، **وقد
     غادرت الرئيسيةَ إلى الملفّ العامّ** — **ومفتاحٌ لا يغيّر ما يراه
     صاحبُه أسوأ من مفتاحٍ غائب** (D-346: زرٌّ لا أثرَ له). **وقيمُها
     باقيةٌ في العمود بلا مساس** فلا تُفقد إن عادت.

     ⬜ **ومكانُها الطبيعيُّ تبويبُ «الملفّ» في صفحة التخصيص الموحَّدة**
     (المرحلة ٤ من خطّة أحمد) — **دَينٌ مكتوبٌ لا سهو.** */
  const toggles: { key: "stats"; label: string; icon: IconName }[] = [
    { key: "stats", label: t.custStatsShort, icon: "chart" },
  ];

  /* ⚖️ 🆕 **السجلُّ خرج إلى `homeSectionMeta`** (D-595): جاء قارئُه
     الثاني (ورقةُ الترتيب من عناوين الرئيسية) فحانت لحظةُ الاستخراج
     (D-376) — نظيرُ `profileSectionMeta` حرفاً. */
  const sectionMeta = homeSectionMeta(t);

  const statMeta: Record<HeaderStatKey, { icon: IconName; label: string }> = {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    towatch: { icon: "bookmark", label: t.libToWatch },
    time: { icon: "clock", label: t.statWatchTime },
    episodes: { icon: "play", label: t.statsWatchedEpisodes },
    upcoming: { icon: "hourglass", label: t.libUpcoming },
    completed: { icon: "check", label: t.libTabFinished },
    dropped: { icon: "card", label: t.droppedBadge },
    ratings: { icon: "star", label: t.panelRatings },
  };

  const orderLabels = {
    up: t.custMoveUp,
    down: t.custMoveDown,
    hide: t.custHide,
    show: t.custShow,
    drag: t.custReorder,
  };

  const posterLabel: Record<Density, string> = {
    compact: t.custPosterS,
    comfortable: t.custPosterM,
    large: t.custPosterL,
  };

  function set(next: HomePrefs) {
    setPrefs(next);
  }

  /* **الاستعادةُ صعدت إلى الترويسة** (D-465) — وتستعيد اللوحَ كلَّه */
  useEffect(() => {
    registerReset?.(() => {
      setPrefs({ ...DEFAULT_HOME_PREFS });
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
          homePrefs: prefs,
        });
        /* **الرئيسيةُ تحمل وضعَ العرض في ذاكرة التبويب** (D-434):
           **ومن غيّره من هنا تغييرٌ صريح** — فلولا هذا السطر لبقيت
           الرئيسيةُ على اختيارٍ سابقٍ من مبدّلها حتى إعادة الفتح. */
        rememberHomeView(prefs.view);
        /* **الخطُّ الأساسُ يلحق بما حُفظ** — فيختفي شريطُ الحفظ لأنه لم
           يعد هناك ما يُحفظ، **ورشّةٌ تقول ثمّ تمضي** (D-555) */
        setBase(prefs);
        toast(t.savedToast, { tone: "success" });
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* 🆕 **المعاينةُ أوّلَ الشاشة** (D-441): **ما تُغيّره يُرى قبل أن
          تحفظ**، **وشاشةُ إعداداتٍ تصف أثرَها بالكلمات تجعل الحفظَ
          تخميناً.** */}
      <CustomizePreview
        kind="home"
        title={t.custPreview}
        name={nickname}
        avatarUrl={avatarUrl}
        greeting={t.greetNeutral + "،"}
        showStats={prefs.stats}
        stats={prefs.statsPick.map((k) => ({ key: k, ...statMeta[k] }))}
        rows={prefs.order.map((k) => ({ key: k, ...sectionMeta[k] }))}
        density={prefs.density}
      />

      {/* ===== ١) الترويسة ===== */}
      <SettingsGroup label={t.custHeaderSection}>
        {toggles.map(({ key, label, icon }) => (
          <ToggleRow
            key={key}
            icon={icon}
            label={label}
            checked={prefs[key]}
            onChange={() => set({ ...prefs, [key]: !prefs[key] })}
          />
        ))}
        {/* 🆕 **سجلُّ الأرقام خرج إلى ورقة** (D-555): **تسعُ خاناتٍ
            تُسحب داخل صفحةٍ تُمرَّر** — والصفُّ يقول كم منها ظاهرٌ الآن
            **فلا يُفتح ليُعرف.** */}
        <SettingsRow
          icon="chart"
          title={t.custStatsCard}
          value={t.custShownN(prefs.statsPick.length)}
          onClick={() => setArrange("stats")}
        />
      </SettingsGroup>

      {/* ===== ٢) الأقسام ===== */}
      <SettingsGroup label={t.custSectionsTitle}>
        <SettingsRow
          icon="grip"
          title={t.custArrange}
          subtitle={t.custSectionsHint}
          value={t.custShownN(prefs.order.length)}
          onClick={() => setArrange("sections")}
        />
      </SettingsGroup>

      {/* ===== ٣) العرض =====
          ⚖️ **ونقضُ D-441 مسجَّلٌ باسمه**: جمعتُ هناك «كم بطاقةً في الصفّ»
          و«كم يكبر الملصق» في مفتاحٍ واحدٍ لأنهما بدَوا سؤالاً واحداً —
          **وهما رقمان مخزَّنان أصلاً** (`cards` سقفٌ يقصّ، و`density`
          عرضٌ يكبّر)، **وتصميمُ أحمد يفصلهما فصار الحقُّ معه.** */}
      <SettingsGroup label={t.custDisplay}>
        {/* **وضعُ العرض صفٌّ لا بطاقة** (D-466): **البصريُّ والمختصرُ
            والتنسيقُ وحجمُ الملصق أوجهٌ لسؤالٍ واحد — «كيف تُرسم
            الرئيسية»** — **وثلاثُ بطاقاتٍ لسؤالٍ واحد تُقرأ ثلاثةَ
            أقسام.** **والمبدّلُ في الرئيسية هو المبدّلُ نفسُه**،
            والقيمةُ واحدةٌ في العمود (قاعدة ٦). */}
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5">
          <span className="shrink-0 text-15 font-semibold">{t.custHomeView}</span>
          <span className="min-w-0 flex-1">
            <span className={pillTrack}>
              {HOME_VIEWS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={prefs.view === k}
                  onClick={() => set({ ...prefs, view: k })}
                  className={chipClass(prefs.view === k, "sm", "flex-1 basis-0 min-w-0 h-8")}
                >
                  {k === "visual" ? t.viewVisual : t.viewCompact}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5">
          <span className="shrink-0 text-15 font-semibold">{t.custLayout}</span>
          <span className="min-w-0 flex-1">
            <CardCountRow
              value={prefs.cards}
              labels={{ compact: t.cardsCompact, medium: t.cardsMedium, full: t.cardsFull }}
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

      {/* ===== أوراقُ الترتيب — واحدةٌ مفتوحةٌ لا اثنتان ===== */}
      <SettingsArrangeSheet
        open={arrange === "stats"}
        title={t.custArrangeStats}
        hint={t.custStatsPickHint}
        all={HEADER_STATS}
        picked={prefs.statsPick}
        meta={statMeta}
        labels={orderLabels}
        min={STATS_PICK_MIN}
        max={STATS_PICK_MAX}
        onCancel={() => setArrange(null)}
        onDone={(statsPick) => {
          set({ ...prefs, statsPick });
          setArrange(null);
        }}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      />
      <SettingsArrangeSheet
        open={arrange === "sections"}
        title={t.custArrange}
        hint={t.custOrderHint}
        all={HOME_SECTIONS}
        picked={prefs.order}
        meta={sectionMeta}
        labels={orderLabels}
        onCancel={() => setArrange(null)}
        onDone={(order) => {
          set({ ...prefs, order });
          setArrange(null);
        }}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      />

      {error && (
        <Alert>{error}</Alert>
      )}

      {/* **شريطُ الحفظ يستيقظ عند وجود ما يُحفظ** (D-555): **زرٌّ مقيمٌ
          في قاع صفحةٍ طولُها ثلاثُ شاشاتٍ يُقرأ نهايةَ الصفحة لا فعلاً
          معلَّقاً** — **ويُضغط على صفحةٍ لم يتبدّل فيها شيء.** */}
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
