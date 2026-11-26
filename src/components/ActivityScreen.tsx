"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getDict, num, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { chipRow, segmentedItem, segmentedTrack } from "./ui/controls";
import { Icon } from "./Icon";
import { BackCrumb } from "./BackButton";
import { HistoryRowMenu } from "./activity/HistoryRowMenu";
import { WeekAside, sourceName } from "./activity/WeekAside";
import { HISTORY_WORDS } from "./activity/historyWords";
import { HistoryShareSheet } from "./HistoryShareSheet";

/**
 * **صفحةُ النشاط — ما فعلتَه أنت، يوماً بيوم** (D-537، تصميمُ أحمد
 * بلقطةٍ معلَّمة: «فلترة النشاط حسب النوع · عرضٌ زمنيٌّ مضغوطٌ بدلاً من
 * الكاردات الكبيرة · تجميعٌ واضحٌ حسب اليوم مع عدد الأنشطة»).
 *
 * ================= وهي بديلةُ اليوميات لا جارتُها =================
 *
 * **اليومياتُ كانت تعرض المشاهدةَ وحدَها** — والمشاهدةُ واحدةٌ من أربعةِ
 * أشياء تفعلها في Loopz. **وبابان يعرضان الرحلةَ نفسَها بشكلين هو ما
 * تمنعه القاعدة ٦** (وقرارُ أحمد: `‎/diary` يُحوَّل إلى هنا).
 *
 * ================= ولماذا التجميعُ في العميل =================
 *
 * **حدُّ اليوم يتبع ساعةَ القارئ لا ساعةَ الخادم** — واليومياتُ كانت
 * تقسم بتوقيت UTC، **فسهرةٌ بعد منتصف الليل تنقسم يومين** (عطلٌ معلَنٌ
 * في الأرشيف). **والخادمُ لا يعرف منطقةَ وقته** ولا عمودَ لها في
 * `profiles`.
 * **و`useSyncExternalStore` تحلّها بلا اختلافِ ترطيبٍ ولا تأثير**
 * (نمطُ `HomeGreeting`/D-434 حرفاً): **الخادمُ يقسم بـUTC، والمتصفّحُ
 * يعيد القسمةَ بساعته في أوّل ترطيب** — **ولا `useEffect` يكتب حالة.**
 *
 * ================= والصفُّ سطران لا بطاقة =================
 *
 * **ملصقٌ ٤٤ · فعلٌ واسمٌ · نجمةٌ ووقت.** **والكاردُ الكبير يعرض ستّةَ
 * أنشطةٍ في شاشة، والصفُّ يعرض عشرة** — **وسجلٌّ يُقرأ بالمسح لا
 * بالتصفّح** (حجّةُ D-232 نفسُها).
 */

export type { ActivityKind, ActivityItem } from "@/core/activityDays";
import { SCOPES, clock, episodeOf, groupWeeks, keep, label, nowDayKey, dayKey, totalsLine, verbOf, watchSummary, weekRange, weekStartKey, weekTotals, type ActivityItem, type Scope } from "@/core/activityDays";


/* الساعةُ مصدرٌ خارجيٌّ عن React — ولا اشتراكَ لأنها لا تُبثّ */
const subscribeNever = () => () => {};
const localTrue = () => true;
const serverFalse = () => false;

export function ActivityScreen({
  items,
  locale,
  crumb = true,
  initial,
  editable = false,
  initialScope = "all",
  reviewOwner,
}: {
  items: ActivityItem[];
  locale: Locale;
  /**
   * 🆕 **فتاتُ الرجوع اختياريّة** (D-586): الشاشةُ صارت تُرسم داخل
   * تبويبٍ في ملفّ المستخدم أيضاً — **وفتاتُ «المكتبة» داخل ملفِّ
   * شخصٍ كذبةُ موضع**، ورأسُ الصفحة هناك يملك زرَّ رجوعه.
   */
  crumb?: boolean;
  /**
   * 🆕 **سقفُ أوّلِ نظرة** (D-710، مواصفةُ أحمد: «في البروفايل في
   * اكتيفتي إذا ضغط اكتيفتي لا يظهرها كلها فقط ٢٠ وتحت فيه خيار
   * المزيد»).
   *
   * **والسقفُ للتبويب لا للصفحة**: `‎/activity` وجهةٌ قصدَها القارئُ
   * ليقرأ سجلَّه كلَّه، **وتبويبٌ داخل ملفٍّ جارٌ لتبويبات أخرى** —
   * **وجارٌ يمدّ ذيلَه بلا نهاية يدفن ما بعده.** فتُترك بلا قيمةٍ هناك.
   */
  initial?: number;
  /**
   * 🆕 T412 — **سجلُّك أنت قابلٌ للتحرير** (`/activity` وحدَها، لا تبويبُ «النشاط» في ملفّ شخصٍ آخر): ⋯ على صفِّ المشاهدة
   * («غيّر يوم المشاهدة» · «ما شفتها، احذفها من السجل» — `HistoryRowMenu`)، وعمودُ الأسبوع الجانبيُّ على الحاسوب (`WeekAside`).
   */
  editable?: boolean;
  /** 🆕 T412 — «سجلّ المشاهدة» في الشريط الجانبيّ يفتح على رقاقة «مشاهدة» (`?scope=watch`) كبابه في التطبيق (D-1504) */
  initialScope?: Scope;
  /** 🆕 T525 — صاحبُ السجلّ: صفُّ «راجع» يفتح مراجعتَه (`/review/…/<id>`) لا صفحةَ العمل («٣أ»). غيابُه ⇒ صفحةُ العمل كما كانت */
  reviewOwner?: string;
}) {
  const t = getDict(locale);
  const [scope, setScope] = useState<Scope>(initialScope);
  /* 🆕 ورقةُ «شارك سجلّك» */
  const [sharing, setSharing] = useState(false);
  /** `null` = بلا سقف — **وفتحُ السقف لا يُغلق** بتبديل الرقاقة */
  const [limit, setLimit] = useState<number | null>(initial ?? null);
  /** هل نحن في المتصفّح؟ **فتُقسَم الأيامُ بساعته لا بـUTC** */
  const local = useSyncExternalStore(subscribeNever, localTrue, serverFalse);

  /* **والسقفُ على المعروض لا على المصدر**: الرقاقةُ تفرز السجلَّ كلَّه
     ثمّ يُقصّ — **ورقاقةٌ تفرز مقصوصاً تكذب** (D-374: العدُّ والعرضُ
     بشرطٍ واحد). **والحصيلةُ الأسبوعيّةُ تُحسب قبل القصّ** لأنها تصف
     الأسبوع لا الشاشة. */
  const matching = items.filter((it) => keep(it, scope));
  const shown = limit === null ? matching : matching.slice(0, limit);
  const hiddenCount = matching.length - shown.length;

  /** يومُ القارئ الآن — **أصلٌ واحدٌ للوسمِ وللعدّ معاً** (D-656) */
  const todayKey = useSyncExternalStore(
    subscribeNever,
    () => nowDayKey(true),
    () => nowDayKey(false),
  );

  /* **أسبوعٌ من الآن لا «الأسبوع الميلاديّ»**: القارئُ يسأل «كم فعلتُ
     مؤخّراً» لا «كم فعلتُ منذ الأحد» — **وسبعةُ أيامٍ جوابٌ ثابتٌ في
     كلِّ يومٍ من الأسبوع.**
     ⚖️ 🆕 **والمقارنةُ بمفاتيح الأيام لا بطوابعَ زمنيّة** (D-656):
     **مفتاحُ اليوم `YYYY-MM-DD` يترتّب أبجديّاً كما يترتّب زمنيّاً**،
     **ويُحسب بالساعة نفسِها التي تُجمَّع بها المجموعات** — **وطابعٌ
     زمنيٌّ يُقارَن بمنطقةٍ ومفاتيحُ تُجمَّع بأخرى هو كيف يقع صفٌّ في
     يومٍ ويُعدّ في غيره.** */
  /* ⚖️ 🆕 **نُقض «سبعةُ أيّامٍ تنتهي اليوم»**: الأسبوعُ يبدأ بالأحد (أحمد ٢٦ نوفمبر «ق٢أ») كالإحصائيات وبطاقة السجلّ وعناوين الأسابيع */
  const weekStart = weekStartKey(todayKey);
  const weekRows = matching.filter((it) => dayKey(it.at, local) >= weekStart);
  /* 🆕 T412 — رقاقةُ «مشاهدة» تعرض حصيلتَها بثلاثة أرقام كالتطبيق (D-1504)؛ وغيرُها سطرُ العدّ كما كان */
  const week = scope === "watch" ? watchSummary(weekRows) : null;
  const w = HISTORY_WORDS[locale === "en" ? "en" : "ar"];

  /* 🆕 T526 — أسابيعُ بعناوينها وحصيلتها (`groupWeeks`)؛ وعلى «مشاهدة» بطاقةُ هذا الأسبوع فوقها بلا عنوانٍ مكرّر */
  const weeks = groupWeeks(shown, local, t, locale, todayKey);
  const thisWeek = weekTotals(weekRows);
  const card = scope === "watch" && (thisWeek.episodes || thisWeek.movies) ? thisWeek : null;

  const body = (
    <div className="min-w-0 space-y-4">
      {crumb && <BackCrumb label={t.navLibrary} fallback="/library" />}
      {editable && (
        <header aria-hidden className="hidden desk:block">
          <h1 className="text-[28px] font-extrabold">{initialScope === "watch" ? t.drawerHistory : t.activityTitle}</h1>
          <p className="mt-1 text-sm text-muted">{w.sub}</p>
        </header>
      )}
      {/* 🆕 «شارك سجلّك» («٤ب»: الزرُّ في رأس السجلّ) — لصاحب السجلّ وحدَه */}
      {editable && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setSharing(true)} className="inline-flex items-center gap-2 min-h-11 px-3 rounded-full text-sm font-semibold text-muted hover:text-foreground">
            <Icon name="share" size={18} />
            {t.historyShareTitle}
          </button>
        </div>
      )}
      {sharing && <HistoryShareSheet locale={locale} onClose={() => setSharing(false)} />}

      {/* «ت٥أ» (أحمد ٢٦ نوفمبر، استوديو المشاركة): صفُّ الفلتر عائلةُ المقسّم بخطٍّ أصفر يتمرّر — لا كبسولات */}
      <div className={chipRow}>
        <div className={segmentedTrack}>
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => {
                if (s === scope) return;
                tap(8);
                setScope(s);
              }}
              className={segmentedItem(scope === s)}
            >
              {label(s, t)}
            </button>
          ))}
        </div>
      </div>

      {/* **بطاقةُ الأسبوع** على «مشاهدة» — ما ليس صفراً وحدَه (لا «٠ أفلام»)، والساعاتُ إن عُرفت المدّة؛ وغيرُ «مشاهدة» يقرأ
          حصيلتَه في عنوان أسبوعه (T526). على الحاسوب يقولها عمودُ الأسبوع الجانبيّ */}
      {card && (
        <div className={`rounded-2xl border border-border bg-surface p-4 ${editable ? "desk:hidden" : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-13 text-muted">
            <span>{t.activityThisWeek}</span>
            <span className="tabular-nums">{weekRange(todayKey, 0, locale)}</span>
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-17 font-bold">
            {[
              card.episodes ? t.actNEpisodes(card.episodes) : null,
              card.shows ? t.actNShows(card.shows) : null,
              card.movies ? t.actNMovies(card.movies) : null,
              week?.hours ? `${num(week.hours, locale)} ${t.activityWeekHours}` : null,
            ]
              .filter((x): x is string => !!x)
              .map((x) => (
                <span key={x}>{x}</span>
              ))}
          </p>
        </div>
      )}

      {weeks.length === 0 ? (
        <p className="text-center text-muted py-16 px-5 leading-relaxed">{t.activityEmpty}</p>
      ) : (
        <div className="space-y-6">
          {weeks.map((wk) => (
            <section key={wk.index}>
              {card && wk.index === 0 ? null : (
                <div className="flex items-baseline justify-between gap-3 pb-2 mb-1 border-b border-[color:var(--divider)]">
                  <h2 className="text-17 font-extrabold">{wk.label}</h2>
                  <span className="truncate text-12 text-muted">{totalsLine(wk.totals, t)}</span>
                </div>
              )}
              {wk.days.map((d) => (
                <div key={d.key} className="mt-3">
                  {/* اليومُ عنوانٌ صغيرٌ فوق صفوفه — كان عنواناً كبيراً بعدّاده ثمّ صفّاً واحداً ثمّ فراغاً (T526) */}
                  <h3 className="text-13 font-semibold text-muted">{d.label}</h3>
                  <ol>
                    {d.rows.map((r) => (
                      <li key={r.id} className="group/row relative flex items-center gap-2 py-2">
                        <Row item={r} locale={locale} local={local} manual={w.manual} reviewOwner={reviewOwner} verb={scope !== "watch"} openHint={!editable} />
                        {editable && r.kind === "watch" && <HistoryRowMenu item={r} locale={locale} local={local} todayKey={todayKey} />}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          ))}

          {/* 🆕 **بابُ الباقي** (D-710) — **والعددُ بجانبه** لأن «المزيد»
              وحدَها لا تقول كم، **وزرٌّ لا يقول ما خلفه يُضغط تجربةً لا
              قصداً** (D-217). **ويُفتح مرّةً بلا رجعة**: من طلب الكلَّ
              لا يريد سقفاً يعود عليه بتبديل رقاقة. */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                tap(6);
                setLimit(null);
              }}
              className="flex items-center gap-1.5 text-14 font-bold text-accent"
            >
              {t.showMore}
              <span className="tabular-nums font-normal text-muted">
                {num(hiddenCount, locale)}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (!editable) return body;
  /* 🆕 T412 — عمودان على الحاسوب العريض (التصميم «أ»): السجلُّ وعمودُ الأسبوع الثابت؛ وما دونه السجلُّ وحدَه كما كان */
  return (
    <div className="desk:grid desk:grid-cols-[minmax(0,1fr)_330px] desk:items-start desk:gap-8">
      {body}
      <aside className="hidden desk:flex desk:sticky desk:top-6 flex-col gap-4">
        <WeekAside items={items} locale={locale} local={local} todayKey={todayKey} />
      </aside>
    </div>
  );
}


function Row({
  item,
  locale,
  local,
  manual,
  reviewOwner,
  verb: showVerb = true,
  openHint = false,
}: {
  item: ActivityItem;
  locale: Locale;
  local: boolean;
  manual: string;
  reviewOwner?: string;
  /** 🆕 T526 — الفعلُ سطرٌ صغيرٌ فوق العنوان؛ ويسقط على «مشاهدة» (كلُّ صفٍّ هناك مشاهدة) */
  verb?: boolean;
  /** 🆕 T526 — «افتح المراجعة ›» في نشاط الملفّ وحدَه («في اكتفتي الملف يبقى أ»)؛ سجلُّك بلاه («١ب») */
  openHint?: boolean;
}) {
  const t = getDict(locale);
  /* 🆕 T525 — «راجع» بنصّه يفتح المراجعةَ نفسَها («٣أ»): الصفُّ صار يقول ما كُتب، فوجهتُه ما كُتب */
  const written = item.kind === "review" && (item.review || item.spoiler) && reviewOwner;
  const href = written
    ? `/review/${item.mediaType}/${item.tmdbId}/${reviewOwner}`
    : `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`;
  const verb = verbOf(item, t);
  /* **مدى الحلقات يسكن `listName` بعد الدمج** — وإلّا فحلقةٌ واحدة (`core/activityDays`) */
  const ep = episodeOf(item, t);

  return (
    <Link href={href} prefetch={false} className="flex min-w-0 flex-1 items-center gap-3 group">
      <span className="relative shrink-0 w-11 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
        {item.poster ? (
          <Image src={item.poster} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
            <Icon name={item.mediaType === "tv" ? "tv" : "film"} size={14} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        {/* 🆕 T526 — الفعلُ سطرٌ صغيرٌ فوق العنوان، والعنوانُ وحدَه بخطٍّ عريض («ج» أحمد ٢٣ نوفمبر) */}
        {showVerb && (
          <span className="block truncate text-12 text-muted">
            {verb}
            {item.kind === "list" && item.listName ? ` ${t.actVerbTo} ${item.listName}` : ""}
          </span>
        )}
        <span className="block truncate text-15 font-bold leading-snug group-hover:text-accent transition-colors">{item.title}</span>

        {/* نصُّ المراجعة مكانَ السطر الثاني تحت العنوان (T526 «ج»، بعد T525 «٣أ»): سطران، واتّجاهُه من نصّه (`dir="auto"`)؛
            والحرقُ يُقال ولا يُعرض */}
        {item.kind === "review" &&
          (item.spoiler ? (
            <span className="block text-12 text-muted">{t.spoilerMark}</span>
          ) : item.review ? (
            <span dir="auto" className="block text-13 leading-snug text-foreground/85 line-clamp-2 [overflow-wrap:anywhere]">
              {item.review}
            </span>
          ) : null)}

        <span className="flex flex-wrap items-center gap-2 text-12 text-muted">
          {/* قرصُ الحلقة بشكل قرص المكتبة — «S1 · E1–2» لا «أنهيت … · حلقتان» */}
          {ep && (
            <span dir="ltr" className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-12 font-semibold text-foreground tabular-nums">
              {ep}
            </span>
          )}
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Icon name="star" size={12} style={{ color: "var(--accent)" }} />
              <span className="tabular-nums">{num(item.rating, locale)}</span>
            </span>
          )}
          <span className="tabular-nums" dir="ltr">
            {clock(item.at, locale, local)}
          </span>
          {/* 🆕 T412 — شارةُ المصدر كالتطبيق (D-1505): «تلقائي» بلون التمييز، وغيرُه رماديّ؛ ويدويٌّ بلا شارة */}
          {item.kind === "watch" && item.source && (
            <span
              className={`rounded-full px-2 py-px text-[10.5px] font-bold ${
                item.source === "auto" ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"
              }`}
            >
              <bdi>{sourceName(item.source, t, manual)}</bdi>
            </span>
          )}
        </span>
        {written && openHint && !item.spoiler && (
          <span className="block text-12 font-bold text-accent">{t.activityOpenReview} ›</span>
        )}
      </span>
    </Link>
  );
}
