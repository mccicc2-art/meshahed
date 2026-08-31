import { Icon } from "@/components/Icon";
import { ProfileStatSheet } from "@/components/ProfileStatSheet";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { WeeklyRank } from "@/lib/data";

/**
 * ====== شارةُ المراتب — لا تختفي، وتفتح أسابيعَها (D-838) ======
 *
 * **حكمُ أحمد**: «الشارة لا تختفي · يمكن جنبها عدد المرّات الي حصل
 * عليها رقم فقط · وإذا ضغط عليها تطلع قائمة بالأسابيع الي حقّق فيها
 * مركز · لو مركز متأخر، أهمّ شي من التوب ١٠ فقط».
 *
 * ⚖️ **وهذا يوسّع D-835 ولا ينقضها**: **الجدولُ كان سجلّاً منذ يومه
 * الأوّل** (صفٌّ لكلِّ أسبوعٍ ومرتبة) — **والذي كان يختفي هو القراءةُ
 * لا البيانات**: `weekly_top_now` تُرجع آخرَ أسبوعٍ وحدَه، **فمن فاز
 * أمسِ يخسر شارتَه الأسبوعَ القادم وإن لم يخسر شيئاً.**
 * 🔑 **وجائزةٌ تُصرف مرّةً وشارةٌ تُكسب إلى الأبد شيئان لا شيءٌ واحد** —
 * **والأيّامُ تنقضي، والمرتبةُ وقعت ولا تُنزع.**
 *
 * 🔑 **والوجهُ عددٌ لا مرتبة** (نصُّ الطلب: «رقم فقط»): **المرتبةُ
 * الأخيرةُ تصف أسبوعاً، والعددُ يصف حساباً** — **وشارةٌ على ملفٍّ تصف
 * صاحبَها لا أسبوعَه.** **والتفصيلُ خلف الضغطة** (D-809: أوّلُ حقيقةٍ
 * بلا ثمن).
 *
 * ⚠️ **والمراتبُ عشرٌ والجوائزُ ثلاث** (الهجرة ١٦٧): **٤ → ١٠ تُسجَّل
 * وتُعرض ولا تُصرف بها أيّام** — **ولم يأمر بغير ٣٠/١٤/٧** (D-217).
 * **والفرقُ يُقرأ في الورقة**: الثلاثةُ الأوائل بلون الهوية، وما
 * بعدهم خافتٌ، **وسطرٌ في الذيل يقول القاعدةَ بكلماتها** — **وتمييزٌ
 * بلونٍ وحدَه لا يُقرأ** (D-142).
 *
 * ⚠️ **ولا ورقةَ جديدةٌ ولا زرَّ جديد** (D-018/D-017/القاعدة ٣):
 * `ProfileStatSheet` بعينها ووصفةُ الشارة كما رُسمت في D-835 —
 * **والمتغيّرُ ما بداخلها.**
 *
 * ⚠️ **وصفرُ مراتبَ يعني `null`** (D-219/D-280): **بابٌ يُفتح على قائمةٍ
 * فارغةٍ وعدٌ فارغ**، **والغيابُ يُكتب غياباً** (D-063).
 */
export function WeeklyRanksDoor({
  rows,
  locale,
}: {
  rows: WeeklyRank[];
  locale: Locale;
}) {
  if (rows.length === 0) return null;
  const t = getDict(locale);
  const count = num(rows.length, locale);
  /* **والوصفُ يأخذ العددَ لا نصَّه**: الإعرابُ يُبنى على الرقم
     (مفردٌ · مثنّى · جمعُ قلّة) — **ونصٌّ جاهزٌ لا يُعرب** */
  const tip = t.weeklyRanksTimes(rows.length);

  /* **تاريخُ الأسبوع يُكتب بـ`Intl` لا بقائمة أشهرٍ بخطِّ اليد** (D-800)،
     **وبـ`UTC` لأنّ `week_start` تاريخٌ لا لحظة** — **ومنطقةُ القارئ
     تزحزحه يوماً إلى الوراء عند من يسبق غرينتش** (درسُ D-806 معكوساً:
     ما لا لحظةَ له لا يُترجَم إلى منطقة). */
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <ProfileStatSheet
      title={t.weeklyRanksTitle}
      closeLabel={t.closeLabel}
      /* **المرئيُّ رتبةٌ وهدفُ اللمس أوسعُ منه** (D-033/D-634) —
         **و`-my-1 py-1` تكفي هنا** لأنّ الشارةَ نفسَها أطولُ من الكلمة
         المجاورة، **ولا تزيح صفَّ «عضو منذ»** الذي تشاركه. */
      className="-my-1 py-1 active:opacity-70 transition"
      content={
        <>
          <ul className="divide-y divide-[color:var(--divider)]">
            {rows.map((r) => (
              <li
                key={r.week}
                className="flex items-center gap-3 py-3"
                dir="auto"
              >
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-12 font-bold ${
                    r.rank <= 3
                      ? "border border-accent/40 bg-accent/10 text-accent"
                      : "border border-border text-muted"
                  }`}
                >
                  <Icon name="trophy" size={12} className="shrink-0" />
                  {t.weeklyRankOrd(r.rank)}
                </span>
                <span className="min-w-0 flex-1 truncate text-14">
                  {t.weeklyRanksWeek(fmt.format(new Date(`${r.week}T00:00:00Z`)))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-12 text-muted leading-relaxed" dir="auto">
            {t.weeklyRanksHint}
          </p>
        </>
      }
    >
      {/* **وصفةُ الشارة كما رُسمت في D-835** — **والمتغيّرُ ما تقوله** */}
      <span
        className="hero-halo inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-12 font-bold text-accent"
        title={tip}
        aria-label={tip}
      >
        <Icon name="trophy" size={12} className="shrink-0" />
        <bdi className="tabular-nums">{count}</bdi>
      </span>
    </ProfileStatSheet>
  );
}
