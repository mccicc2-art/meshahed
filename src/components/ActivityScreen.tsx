"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { getDict, num, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { chipClass, chipRow } from "./ui/controls";
import { Icon } from "./Icon";
import { BackCrumb } from "./BackButton";

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
import { SCOPES, clock, episodeOf, groupDays, keep, label, nowDayKey, dayKey, shiftDay, verbOf, type ActivityItem, type Scope } from "@/core/activityDays";


/* الساعةُ مصدرٌ خارجيٌّ عن React — ولا اشتراكَ لأنها لا تُبثّ */
const subscribeNever = () => () => {};
const localTrue = () => true;
const serverFalse = () => false;

export function ActivityScreen({
  items,
  locale,
  crumb = true,
  initial,
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
}) {
  const t = getDict(locale);
  const [scope, setScope] = useState<Scope>("all");
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
  const weekStart = shiftDay(todayKey, -6);
  const weekCount = matching.filter((it) => dayKey(it.at, local) >= weekStart).length;

  const days = groupDays(shown, local, t, locale, todayKey);

  return (
    <div className="space-y-4">
      {crumb && <BackCrumb label={t.navLibrary} fallback="/library" />}

      <div className={chipRow}>
        <div className="flex items-center gap-2">
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
              className={chipClass(scope === s)}
            >
              {label(s, t)}
            </button>
          ))}
        </div>
      </div>

      {/* **سطرُ الحصيلة** — يقول كم فعلتَ قبل أن تعدّ بعينك (D-374:
          والعدُّ يعدّ ما يعرضه جسمُه بشرطه نفسِه — فهو يتبع الرقاقة). */}
      <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[color:var(--divider)] text-14">
        <span className="text-muted">{t.activityThisWeek}</span>
        <span className="text-muted tabular-nums">{t.activityCount(weekCount)}</span>
      </div>

      {days.length === 0 ? (
        <p className="text-center text-muted py-16 px-5 leading-relaxed">{t.activityEmpty}</p>
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.key}>
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-15 font-bold">{d.label}</h2>
                <span className="text-12 text-muted tabular-nums">
                  {num(d.rows.length, locale)}
                </span>
              </div>

              {/* **الخيطُ الرأسيُّ على حافّة البداية والنقطُ عليه** —
                  هو ما يقول «هذه لحظاتٌ متتابعة» (تصميمُ أحمد). */}
              <ol className="relative ms-1.5 ps-4 border-s border-[color:var(--divider)]">
                {d.rows.map((r) => (
                  <li key={r.id} className="relative py-2.5">
                    <span
                      aria-hidden
                      className="absolute -start-[21px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border border-[color:var(--divider)] bg-[color:var(--background)]"
                    />
                    <Row item={r} locale={locale} local={local} />
                  </li>
                ))}
              </ol>
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
}


function Row({
  item,
  locale,
  local,
}: {
  item: ActivityItem;
  locale: Locale;
  local: boolean;
}) {
  const t = getDict(locale);
  const href = `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`;
  const verb = verbOf(item, t);
  /* **مدى الحلقات يسكن `listName` بعد الدمج** — وإلّا فحلقةٌ واحدة (`core/activityDays`) */
  const ep = episodeOf(item, t);

  return (
    <Link href={href} prefetch={false} className="flex items-center gap-3 group">
      <span className="relative shrink-0 w-11 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
        {item.poster ? (
          <Image src={item.poster} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
            <Icon name={item.mediaType === "tv" ? "tv" : "film"} size={14} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-14 leading-snug truncate">
          <span className="text-muted">{verb} </span>
          <span className="font-bold group-hover:text-accent transition-colors">{item.title}</span>
          {ep && <span className="text-muted"> · {ep}</span>}
          {item.kind === "list" && item.listName && (
            <>
              <span className="text-muted"> {t.actVerbTo} </span>
              <span className="text-muted">{item.listName}</span>
            </>
          )}
        </span>

        <span className="mt-0.5 flex items-center gap-2 text-12 text-muted">
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Icon name="star" size={12} style={{ color: "var(--accent)" }} />
              <span className="tabular-nums">{num(item.rating, locale)}</span>
            </span>
          )}
          <span className="tabular-nums" dir="ltr">
            {clock(item.at, locale, local)}
          </span>
        </span>
      </span>
    </Link>
  );
}
