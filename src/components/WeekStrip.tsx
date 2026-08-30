import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

export interface WeekEntry {
  /** YYYY-MM-DD */
  date: string;
  showTmdbId: number;
  title: string;
  label: string;
}

/**
 * شريطُ الأيام القادمة.
 *
 * اليومُ الذي فيه حلقة يُلوَّن، والفارغ يبقى باهتاً: **الفراغُ نفسُه
 * معلومة** («ما فيه شيء الأربعاء»)، ولو أخفيناه لضاع معناه.
 *
 * ⚖️ 🆕 **وصار يُمرَّر بأسبوعين لا يقف عند سبعة** (D-491، طلبُ أحمد:
 * «أحتاج أقدر أكرّره بيدي وأشوف الأسبوع اللي بعده — يكون سموث أقدر
 * أمرّر وأوقف براحتي على أي يوم»).
 *
 * **ونقضُ «سبعةُ أعمدةٍ ثابتةٍ بلا تمرير» مسجَّل** — وحجّتُها كانت
 * «التقويمُ يُقرأ بالنظرة لا بالسحب». **وهي تصحّ للأسبوع الجاري
 * وتسكت عمّا بعده**: من رأى «الأحد فيه حلقة» سأل مباشرةً «وبعده؟»،
 * **وسؤالٌ بلا جوابٍ في الشاشة هو سببُ السحب.**
 *
 * **والسبعةُ تبقى هي المرئيّة**: عرضُ الخانة `(100% - الفجوات) / 7`،
 * **فالأسبوعُ الأوّلُ يملأ الشاشة كما كان** والثاني خلفه — **فلا
 * يتغيّر شيءٌ لمن لا يسحب** (D-152).
 *
 * **و«يقف براحته على أي يوم»** = `snap-x` بـ`snap-start` على كلِّ
 * خانة: **الالتقاطُ على اليوم لا على الأسبوع** — فيقف حيث رفع إصبعه.
 * **و`overscroll-x-contain`** كي لا يبتلع السحبُ الأفقيُّ إيماءةَ
 * الرجوع في iPhone (عُرفُ صفوف التطبيق كلِّها).
 */
export function WeekStrip({
  days,
  entries,
  locale,
  action,
  href,
}: {
  /** تواريخُ متتابعةٌ تبدأ من اليوم — أربعةَ عشرَ اليوم (D-491) */
  days: { date: string; weekday: string; dayNum: string }[];
  entries: WeekEntry[];
  locale: Locale;
  /** 🆕 عنصرٌ في طرف العنوان — مقبضُ ترتيب أقسام الرئيسية (D-595) */
  action?: React.ReactNode;
  /**
   * 🆕 **وجهةُ العنوان** (D-828) — **العنوانُ بابٌ حين تكون له وجهة**
   * (D-422/D-198)، **وهو عُرفُ `PosterRail` نفسُه لا وصفةٌ ثانية.**
   * ⚠️ **وخانةُ الفعل مشغولةٌ بمقبض الترتيب** (D-595) — **فالبابُ في
   * العنوان لا في طرفٍ ثالثٍ يُخترع له.**
   */
  href?: string;
}) {
  const t = getDict(locale);
  const byDay = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="min-w-0 text-22 font-bold">
          {href ? (
            <Link href={href} className="flex items-center gap-2 hover:opacity-80 transition">
              <Icon name="calendar" size={18} className="text-muted" />
              <span className="truncate">{t.weekTitle}</span>
              {/* **ولا اتّجاهَ مقسورٌ على السهم ولا شرطُ لغة** (D-801):
                  `›` مرآويٌّ في يونيكود **فينقلب مع الصفحة وحدَه** —
                  **وشرطٌ يكتب السهمَ بيده يقلبه مرّتين في العربيّة.** */}
              <span aria-hidden className="text-muted text-base">›</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2">
              <Icon name="calendar" size={18} className="text-muted" />
              {t.weekTitle}
            </span>
          )}
        </h2>
        {action}
      </div>
      {/* ⚖️ 🆕 **السطران صارا سطراً واحداً** (D-596، حكمُ أحمد بلقطةٍ
          دوّر فيها الاثنين: «هذي خلّهم سطر واحد مع بعض»): كان الوصفُ
          فوق الشريط وسطرُ «لا حلقات» تحته وسطاً — **سطران باهتان
          لرسالةٍ واحدةٍ حين يكون الأسبوعُ فارغاً**، يفصل بينهما
          الشريطُ كلُّه. **والفراغُ يلحق بالوصف في سطره** ويسقط سطرُ
          القاع — وحين توجد حلقاتٌ يبقى الوصفُ وحدَه كما كان. */}
      <p className="text-12 text-muted mb-3" dir="auto">
        {entries.length === 0 ? `${t.weekSub} ${t.weekNothing}` : t.weekSub}
      </p>

      {/* الحشوةُ السفليّةُ للالتقاط: بلا `pb` يُقصّ ظلُّ الحدّ المضيء */}
      <div className="flex gap-1 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d, i) => {
          const list = byDay.get(d.date) ?? [];
          const has = list.length > 0;
          const first = list[0];
          const body = (
            <>
              <span className="block text-[10px] text-muted leading-none">{d.weekday}</span>
              <span
                className={`block text-sm font-bold mt-1 leading-none ${
                  i === 0 ? "text-accent" : ""
                }`}
              >
                {d.dayNum}
              </span>
              <span
                className={`mt-1.5 block h-1 rounded-full ${has ? "bg-accent-2" : "bg-border"}`}
              />
              <span className="block text-[9px] text-muted mt-1 leading-tight h-6 overflow-hidden">
                {has ? (list.length > 1 ? `+${list.length}` : first.title) : ""}
              </span>
            </>
          );

          /* **سبعةٌ في الشاشة والباقي خلفها**: العرضُ نسبةٌ من مجال
             التمرير لا رقمٌ ثابت، **فيصحّ على كلِّ مقاس** — وستُّ
             فجواتٍ بـ4px بين السبع المرئيّة (`1.5rem`). */
          const cell =
            "snap-start shrink-0 w-[calc((100%-1.5rem)/7)] rounded-xl px-1 py-2 text-center";

          return has ? (
            <Link
              key={d.date}
              href={`/show/${first.showTmdbId}`}
              prefetch={false}
              title={list.map((e) => `${e.title} — ${e.label}`).join("\n")}
              className={`${cell} border border-accent-2/35 bg-accent-2/[0.06] hover:border-accent-2 transition`}
            >
              {body}
            </Link>
          ) : (
            <div
              key={d.date}
              className={`${cell} border border-border bg-surface opacity-60`}
            >
              {body}
            </div>
          );
        })}
      </div>

    </section>
  );
}
