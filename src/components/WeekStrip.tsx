import Link from "next/link";
import Image from "next/image";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import { Icon } from "./Icon";

export interface WeekEntry {
  /** YYYY-MM-DD */
  date: string;
  showTmdbId: number;
  title: string;
  label: string;
  /** 🆕 D-1587 — ملصقُ العمل لورقة اليوم في التطبيق (يومٌ فيه أكثرُ من عمل) — الويبُ لا يقرؤه */
  posterPath?: string | null;
  /** 🆕 D-1614 — موعدٌ متوقَّعٌ من الإيقاع الأسبوعيّ لا معلَن — الخانةُ باهتةٌ بإطارٍ متقطّع */
  expected?: boolean;
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
  variant = "strip",
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
  /** 🆕 T398 — `list`: الأيّامُ صفوفٌ بعضُها تحت بعض — للعمود الجانبيّ في رئيسيّة الحاسوب (`a_home`)، أسبوعٌ واحد */
  variant?: "strip" | "list";
}) {
  const t = getDict(locale);
  const byDay = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  /* 🆕 T398 — **الأسبوعُ عموداً على الحاسوب** (التصميم المعتمد `a_home`): سبعةُ مربّعاتٍ بعرض الصفحة كانت فارغةَ
     الوسط (ع6 في تقرير المقارنة)، وفي العمود الجانبيّ يصير كلُّ يومٍ سطراً: رقمُه واسمُه، ثمّ ملصقاتُ ما ينزل فيه —
     والعنوانُ بابُ التقويم كما في الشريط. البياناتُ نفسُها والحكمُ نفسُه (المتوقَّعُ باهتٌ بحدٍّ متقطّع). */
  if (variant === "list") {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-15 font-bold">
            <Icon name="calendar" size={16} className="text-accent" />
            <span className="truncate">{t.weekTitle}</span>
          </h2>
          {href ? (
            <Link href={href} className="shrink-0 text-12 font-medium text-muted hover:text-accent transition">
              {t.drawerCalendar} <span aria-hidden>›</span>
            </Link>
          ) : null}
        </div>
        {entries.length === 0 ? (
          <p className="mb-2 text-12 text-muted" dir="auto">
            {t.weekNothing}
          </p>
        ) : null}
        <ul className="divide-y divide-[color:var(--divider)]">
          {days.slice(0, 7).map((d, i) => {
            const list = byDay.get(d.date) ?? [];
            const guess = list.length > 0 && list.every((e) => e.expected);
            return (
              <li key={d.date} className="flex items-center gap-3 py-2">
                <span className="w-12 shrink-0">
                  <span className={`block text-15 font-bold leading-none tabular-nums ${i === 0 ? "text-accent" : ""}`}>{d.dayNum}</span>
                  <span className="mt-1 block text-[11px] leading-none text-muted">{d.weekday}</span>
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  {list.length === 0 ? (
                    <span className="text-12 text-muted" aria-hidden>
                      —
                    </span>
                  ) : (
                    list.slice(0, 4).map((e) => {
                      const src = posterUrl(e.posterPath ?? null, "w185");
                      return (
                        <Link
                          key={`${e.showTmdbId}-${e.label}`}
                          href={`/show/${e.showTmdbId}`}
                          prefetch={false}
                          title={`${e.title} — ${e.label}`}
                          aria-label={`${e.title} — ${e.label}`}
                          className={`relative block h-12 w-8 shrink-0 overflow-hidden rounded-md bg-surface-2 ${guess ? "opacity-60 outline outline-1 outline-dashed outline-accent-2/40" : ""} hover:ring-2 hover:ring-accent-2 transition`}
                        >
                          {src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" /> : null}
                        </Link>
                      );
                    })
                  )}
                  {list.length > 4 ? <span className="text-12 text-muted tabular-nums">+{list.length - 4}</span> : null}
                  {list.length === 1 ? (
                    <span className="min-w-0 truncate text-12 text-muted" dir="auto">
                      {list[0].title}
                    </span>
                  ) : null}
                </span>
                {i === 0 ? (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">{t.whenToday}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section>
      <div className={`flex items-center justify-between gap-3 ${entries.length === 0 ? "mb-1" : "mb-3"}`}>
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
      {/* ⚖️ 🆕 D-1113 — **الوصفُ سقط، وبقي سطرُ الفراغ وحدَه** (أحمد بقوسين على اللقطة: «احذفه»، ثمّ
          «نفذ على اقتراحك»): «حلقاتُ أعمالك في الأسبوعين القادمين» تقولها الأيّامُ نفسُها، **أمّا «لا حلقات
          هذا الأسبوع» فخبرٌ لا تقوله المربّعاتُ الفارغة** — بدونه لا يُفرَّق أسبوعٌ فارغٌ من صفحةٍ لم تُحمَّل.
          فالسطرُ يظهر حين يفرغ الأسبوعُ وحدَه، والفراغُ تحت العنوان يعود `mb-3` حين يغيب. (نقضٌ لشطر D-596.) */}
      {entries.length === 0 && (
        <p className="text-12 text-muted mb-3" dir="auto">
          {t.weekNothing}
        </p>
      )}

      {/* الحشوةُ السفليّةُ للالتقاط: بلا `pb` يُقصّ ظلُّ الحدّ المضيء */}
      <div className="flex gap-1 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d, i) => {
          const list = byDay.get(d.date) ?? [];
          const has = list.length > 0;
          const first = list[0];
          /* 🆕 D-1614 — يومٌ كلُّ ما فيه متوقَّعٌ يُرسم باهتاً (شكلُ خانة التقويم نفسُه) */
          const guess = has && list.every((e) => e.expected);
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
                className={`mt-1.5 block h-1 rounded-full ${has ? (guess ? "bg-accent-2/40" : "bg-accent-2") : "bg-border"}`}
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
              className={`${cell} border ${guess ? "border-dashed border-accent-2/30 opacity-75" : "border-accent-2/35 bg-accent-2/[0.06]"} hover:border-accent-2 transition`}
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
