import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { getProfile, getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { isPlus } from "@/lib/plan";
import {
  asStatsPeriod,
  buildPeriodStats,
  statsRange,
  type StatsPeriod,
} from "@/lib/periodStats";
import { ReportView } from "@/components/ReportView";
import { SettingsHeader } from "@/components/settings/SettingsHeader";
import { PlusPill } from "@/components/ui/PlusPill";
import { ShareCard } from "@/components/ShareCard";
import { Icon } from "@/components/Icon";

/**
 * ============ «تقريرك» (D-799 — تصميمُ أحمد المرفق) ============
 *
 * **الصورةُ هي المرجعُ النهائيّ** بنصّه، **ولا إعادةَ تفسيرٍ للتصميم.**
 *
 * ⚠️ **والمدّةُ في الرابط لا في حالةِ عميل** (D-438/D-463): الحسابُ على
 * الخادم — **فالتبويبُ رابطٌ يُشارَك ويعود إليه زرُّ الرجوع.**
 *
 * 🔒 **والقفلُ يقول الثمنَ ولا يصمت** (D-786): **شاشةٌ فارغةٌ بلا سببٍ
 * تُقرأ عطلاً لا قفلاً.**
 *
 * ⬜ **وزرُّ «Share your report» الكبيرُ لم يُرسم بعد**: **مشاركةُ
 * التقرير صورةٌ تُولَّد** (`/api/share` أختُها) — **وزرٌّ يشارك بطاقةَ
 * إحصائيّاتٍ باسم «تقريرك» يَعِد بما لا يُسلِّمه** (D-217). **ورمزُ
 * المشاركة في الترويسة يشارك ما يملكه فعلاً.**
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [{ locale, t }, params, profile] = await Promise.all([
    getT(),
    searchParams,
    getProfile(),
  ]);
  const ar = locale !== "en";
  /* 🆕 **والشهرُ هو الافتراضيّ لا الأسبوع** (D-805، حكمُ أحمد: «إذا
     دخلت على التقرير خلّه مباشرةً يفتح لي على الشهر»). **والحجّةُ
     تسنده**: **أسبوعٌ فيه ثلاثُ حلقاتٍ ليس تقريراً**، **والشهرُ أوّلُ
     مدّةٍ يكون فيها لما يُرسم شكلٌ يُقرأ** — عمودٌ لكلِّ يومٍ ومزيجُ
     أنواعٍ لا نوعٌ واحدٌ ومقارنةٌ بشهرٍ مضى. **والأسبوعُ يبقى بضغطة.**
     ⚠️ **و`asStatsPeriod` لم تُمسّ**: افتراضُها الأسبوعُ لبقيّة
     القارئين — **والسطحُ يقرّر بابَه، والمحلِّلُ يقرّر ما يقبله.** */
  const period = params.p ? asStatsPeriod(params.p) : "month";
  const plus = isPlus(profile);

  /* **و«كلُّ الأوقات» ليست في «تقريرك»** (الصورة: ثلاثةُ تبويبات) —
     **تقريرٌ عن كلِّ الأوقات ليس تقريراً، هو الملفُّ نفسُه.** ومكانُها
     في الإحصائيات الكاملة كما في صورتها. */
  const label: Record<StatsPeriod, string> = ar
    ? { week: "الأسبوع", month: "الشهر", year: "السنة", all: "كل الأوقات" }
    : { week: "Week", month: "Month", year: "Year", all: "All time" };

  return (
    <div>
      {/* 🆕 **والمدّةُ في الاسم لا في سطرٍ تحته** (D-804، حكمُ أحمد):
          **«٢٠٢٦» وحدَها في سطرٍ متوسّطٍ تأخذ ارتفاعَ سطرٍ كاملٍ لتقول
          كلمةً** — **والترويسةُ تقولها في الصفِّ نفسِه بلا زيادةِ
          بكسل.** ⚠️ **و`statsRange` نداءٌ نقيٌّ بلا قاعدة** فلا يكلّف
          الترويسةَ انتظارَ الجسم، **وهي الدالّةُ نفسُها التي يقرؤها
          `buildPeriodStats`** — **فلا تاريخان لمدّةٍ واحدة** (D-145).

          🆕 **ورقاقةُ PLUS بجانب الاسم** (D-801 — الصورة المرفقة):
          **الصفحةُ مدفوعةٌ كلُّها**، **ووسمٌ يقول ذلك عند بابها أصدقُ من
          قفلٍ يُكتشف بعد الدخول** — ولا يُرسم لغير المشترك، فبابُه هو
          شاشةُ الثمن نفسُها. */}
      <SettingsHeader
        title={`${ar ? "تقريرك" : "Your Report"} · ${statsRange(period, 0, locale).label}`}
        badge={plus ? <PlusPill /> : undefined}
        fallbackHref="/stats"
        action={plus ? <ShareCard locale={locale} icon /> : undefined}
      />

      {plus ? (
        <div className="mt-1">
          {/* ═══ تبويباتُ المدّة — **خطٌّ تحت النشط لا رقاقةٌ مطوَّقة**،
              كما في الصورة. **وروابطُ لا أزرار**: المدّةُ في الرابط. ═══ */}
          <div role="tablist" aria-label={ar ? "المدّة" : "Period"} className="flex">
            {(["week", "month", "year"] as const).map((p) => {
              const on = p === period;
              return (
                <Link
                  key={p}
                  role="tab"
                  aria-selected={on}
                  href={p === "month" ? "/reports" : `/reports?p=${p}`}
                  scroll={false}
                  /* 🔴 🆕 **وتبديلُ المدّة يستبدل ولا يُكدّس** (D-805،
                     حكمُ أحمد: «إذا ضغطت سهم الرجوع المفروض يرجع
                     للصفحة الي قبلها مباشرة»): **كلُّ ضغطةِ تبويبٍ
                     كانت تدفع مدخلاً في التاريخ** — **فمن قلّب المدد
                     الثلاث ثمّ ضغط الرجوع مشى بينها بدل أن يخرج.**
                     **والتبويبُ وجهٌ ثانٍ لصفحةٍ واحدة لا وجهةٌ
                     ثانية** — وهو حرفُ D-643. */
                  replace
                  className={`flex-1 basis-0 min-w-0 text-center pb-2.5 pt-1 text-15 border-b-2 transition ${
                    on
                      ? "font-bold text-foreground border-accent"
                      : "text-muted border-transparent hover:text-foreground"
                  }`}
                >
                  {label[p]}
                </Link>
              );
            })}
          </div>

          <Suspense key={period} fallback={<ReportSkeleton />}>
            <ReportBody period={period} locale={locale} />
          </Suspense>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center px-4">
          <Icon name="sparkle-star" size={28} className="text-accent" />
          <p className="text-15 font-bold leading-tight">{t.plusGateTitle}</p>
          <p className="text-12 text-muted leading-relaxed max-w-sm">
            {ar
              ? "التقارير والإحصائيات الكاملة من مزايا Loopz+ — وإحصاءاتك في صفحة الإحصائيات تبقى مجّانيةً كما هي."
              : "Reports and full statistics are a Loopz+ feature — your stats page stays free exactly as it is."}
          </p>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3 mt-1">
            <p className="text-15 font-bold leading-none">{t.plusPrice}</p>
            <p className="mt-1 text-12 text-muted leading-none">{t.plusPriceRenew}</p>
            <p className="mt-1.5 text-12 text-muted leading-none">{t.plusSoon}</p>
          </div>
          <Link href="/plus" className="text-12 font-bold text-accent hover:underline">
            {t.plusLearnMore}
          </Link>
        </div>
      )}
    </div>
  );
}

async function ReportBody({ period, locale }: { period: StatsPeriod; locale: "ar" | "en" }) {
  const stats = await buildPeriodStats(period, 0, locale);
  return <ReportView stats={stats} locale={locale} />;
}

/** هيكلٌ عظميٌّ **بمواضع المحتوى نفسِها** (شرطُه) — لا مستطيلٌ واحدٌ كبير */
function ReportSkeleton() {
  return (
    <div className="pt-4 space-y-6" aria-hidden>
      <div className="h-3 w-24 mx-auto rounded bg-surface-2 animate-pulse" />
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-12 w-3/5 rounded bg-surface-2 animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-surface-2 animate-pulse" />
        </div>
        <div className="w-[104px] h-[104px] rounded-full bg-surface-2 animate-pulse" />
      </div>
      <div className="flex items-end gap-2 h-[132px]">
        {[40, 62, 30, 88, 46, 104, 120].map((h, i) => (
          <div key={i} className="flex-1 rounded-md bg-surface-2 animate-pulse" style={{ height: h }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-[1.6] aspect-[2/3] rounded-2xl bg-surface-2 animate-pulse" />
        <div className="flex-1 aspect-[2/3] rounded-2xl bg-surface-2 animate-pulse" />
        <div className="flex-1 aspect-[2/3] rounded-2xl bg-surface-2 animate-pulse" />
      </div>
    </div>
  );
}
